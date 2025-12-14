import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliateProfile } from '../entities/affiliate-profile.entity';
import { AffiliateEvents } from '../entities/affiliate-events.entity';
import { AffiliateVisitor } from '../entities/affiliate-visitor.entity';
import { AffiliateUserPerformance } from '../entities/affiliate-user-performance.entity';
import { User } from '../../users/entities/user.entity';
import { TrackVisitDto } from '../dto/track-visit.dto';
import { ActivationService } from '../../activation/activation.service';
import { ActivationActionType } from '../../users/enums/activation-action-type.enum';

@Injectable()
export class AffiliateTrackingService {
  constructor(
    @InjectRepository(AffiliateProfile)
    private readonly profileRepository: Repository<AffiliateProfile>,
    @InjectRepository(AffiliateEvents)
    private readonly eventsRepository: Repository<AffiliateEvents>,
    @InjectRepository(AffiliateVisitor)
    private readonly visitorRepository: Repository<AffiliateVisitor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AffiliateUserPerformance)
    private readonly userPerformanceRepository: Repository<AffiliateUserPerformance>,
    private readonly activationService: ActivationService,
  ) {}

  /**
   * Track a visit to an affiliate's page or referral link
   * Handles both AffiliateProfile (slug/referralCode) and affiliate_only users (referralLink)
   */
  async trackVisit(dto: TrackVisitDto) {
    // Validate that at least one identifier is provided
    if (!dto.slug && !dto.referralCode && !dto.referralLink) {
      throw new BadRequestException(
        'Must provide either slug, referralCode, or referralLink',
      );
    }

    // Route to appropriate tracking method
    if (dto.referralLink) {
      return await this.trackAffiliateUserVisit(dto);
    } else {
      return await this.trackAffiliateProfileVisit(dto);
    }
  }

  /**
   * Track visit for AffiliateProfile (companies/organizations)
   */
  private async trackAffiliateProfileVisit(dto: TrackVisitDto) {
    // Find affiliate profile by slug or referral code
    let profile: AffiliateProfile | null;

    if (dto.slug) {
      profile = await this.profileRepository.findOne({
        where: { slug: dto.slug },
        relations: ['events'],
      });
    } else {
      profile = await this.profileRepository.findOne({
        where: { referral_code: dto.referralCode },
        relations: ['events'],
      });
    }

    if (!profile) {
      throw new NotFoundException(
        `Affiliate profile not found for ${dto.slug ? 'slug: ' + dto.slug : 'referral code: ' + dto.referralCode}`,
      );
    }

    // Check if this is a unique visitor
    const existingVisitor = await this.visitorRepository.findOne({
      where: {
        affiliate_profile_id: profile.id,
        visitor_id: dto.visitorId,
      },
    });

    const isUniqueVisitor = !existingVisitor;

    if (existingVisitor) {
      // Returning visitor - increment visit count and update last visit
      existingVisitor.visit_count += 1;
      existingVisitor.last_visit = new Date();
      await this.visitorRepository.save(existingVisitor);

      console.log(
        `[AffiliateTrackingService] Returning visitor ${dto.visitorId} to affiliate ${profile.id}. Total visits: ${existingVisitor.visit_count}`,
      );
    } else {
      // New unique visitor - create record
      const newVisitor = this.visitorRepository.create({
        affiliate_profile_id: profile.id,
        visitor_id: dto.visitorId,
        referrer: dto.referrer,
        user_agent: dto.userAgent,
        visit_count: 1,
      });
      await this.visitorRepository.save(newVisitor);

      console.log(
        `[AffiliateTrackingService] New unique visitor ${dto.visitorId} to affiliate ${profile.id}`,
      );
    }

    // Get or create AffiliateEvents record
    let events: AffiliateEvents | null = profile.events;
    if (!events) {
      events = await this.eventsRepository.findOne({
        where: { affiliate_profile_id: profile.id },
      });
    }

    if (!events) {
      // Create initial events record if it doesn't exist
      events = this.eventsRepository.create({
        affiliate_profile_id: profile.id,
        total_clicks: 0,
        total_unique_visitors: 0,
        total_signups: 0,
      });
    }

    // Update AffiliateEvents
    // Always increment total_clicks
    events.total_clicks += 1;

    // Only increment unique visitors for first-time visitors
    if (isUniqueVisitor) {
      events.total_unique_visitors += 1;
    }

    await this.eventsRepository.save(events);

    console.log(
      `[AffiliateTrackingService] Updated events for affiliate ${profile.id}: clicks=${events.total_clicks}, unique_visitors=${events.total_unique_visitors}`,
    );

    return {
      success: true,
      type: 'affiliate_profile',
      isUniqueVisitor,
      affiliateProfileId: profile.id,
      totalClicks: events.total_clicks,
      totalUniqueVisitors: events.total_unique_visitors,
    };
  }

  /**
   * Track visit for affiliate_only users
   * Simplified tracking - only increments referrals_clicks (no unique visitor logic for MVP)
   */
  private async trackAffiliateUserVisit(dto: TrackVisitDto) {
    // Extract referral link and find user
    const user = await this.userRepository.findOne({
      where: { referral_link: dto.referralLink },
      relations: ['performance'],
    });

    if (!user) {
      throw new NotFoundException(
        `Affiliate user not found for referral link: ${dto.referralLink}`,
      );
    }

    // Get or create AffiliateUserPerformance record
    let performance: AffiliateUserPerformance | null = user.performance;
    if (!performance) {
      performance = await this.userPerformanceRepository.findOne({
        where: { user_id: user.id },
      });
    }

    if (!performance) {
      // Create initial performance record if it doesn't exist
      performance = this.userPerformanceRepository.create({
        user_id: user.id,
        referrals_clicks: 0,
        referrals_made: 0,
        referrals_converted: 0,
      });
    }

    // Check if this is the first click
    const isFirstClick = performance.referrals_clicks === 0;

    // Increment clicks (simplified - no unique visitor tracking for MVP)
    performance.referrals_clicks += 1;

    await this.userPerformanceRepository.save(performance);

    // Trigger activation on first referral click for affiliate_only users
    if (isFirstClick) {
      await this.activationService.triggerActivation(
        user.id,
        ActivationActionType.FIRST_REFERRAL_CLICK,
      );
    }

    console.log(
      `[AffiliateTrackingService] Updated performance for affiliate user ${user.id}: clicks=${performance.referrals_clicks}`,
    );

    return {
      success: true,
      type: 'affiliate_user',
      userId: user.id,
      totalClicks: performance.referrals_clicks,
    };
  }
}
