import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliateProfile } from '../entities/affiliate-profile.entity';
import { AffiliateEvents } from '../entities/affiliate-events.entity';
import { CreateAffiliateProfileDto } from '../dto/create-affiliate-profile.dto';
import { UpdateAffiliateProfileDto } from '../dto/update-affiliate-profile.dto';
import { FilterAffiliateProfileDto } from '../dto/filter-affiliate-profile.dto';
import { generateReferralCode } from '../utils/generate-referral-code';

@Injectable()
export class AffiliateProfilesService {
  constructor(
    @InjectRepository(AffiliateProfile)
    private readonly affiliateProfileRepository: Repository<AffiliateProfile>,
    @InjectRepository(AffiliateEvents)
    private readonly affiliateEventsRepository: Repository<AffiliateEvents>,
  ) {}

  /**
   * Create new affiliate profile with auto-generated referral code
   */
  async create(
    createDto: CreateAffiliateProfileDto,
  ): Promise<AffiliateProfile> {
    // Check if slug already exists
    const existingSlug = await this.affiliateProfileRepository.findOne({
      where: { slug: createDto.slug },
    });

    if (existingSlug) {
      throw new ConflictException(
        `Affiliate profile with slug "${createDto.slug}" already exists`,
      );
    }

    // Generate unique referral code (retry if collision)
    let referralCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      referralCode = generateReferralCode();
      const existingCode = await this.affiliateProfileRepository.findOne({
        where: { referral_code: referralCode },
      });

      if (!existingCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException(
        'Failed to generate unique referral code. Please try again.',
      );
    }

    // Compute referral link from slug
    const referralLink = `${process.env.PUBLIC_SITE_URL}/${createDto.slug}`;

    // Create affiliate profile
    const profile = this.affiliateProfileRepository.create({
      ...createDto,
      referral_code: referralCode!,
      referral_link: referralLink,
      values: createDto.values || [],
    });

    const savedProfile = await this.affiliateProfileRepository.save(profile);

    // Auto-create AffiliateEvents record
    const events = this.affiliateEventsRepository.create({
      affiliate_profile_id: savedProfile.id,
      total_clicks: 0,
      total_unique_visitors: 0,
      total_signups: 0,
      total_conversions: 0,
      total_commission: 0.0,
    });

    await this.affiliateEventsRepository.save(events);

    // Reload profile with events
    return this.findOne(savedProfile.id);
  }

  /**
   * Find all affiliate profiles with optional filters
   */
  async findAll(
    filters: FilterAffiliateProfileDto,
  ): Promise<AffiliateProfile[]> {
    const queryBuilder = this.affiliateProfileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.events', 'events');

    // Apply search filter (name or slug)
    if (filters.search) {
      queryBuilder.andWhere(
        '(profile.name ILIKE :search OR profile.slug ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Apply audience_type filter
    if (filters.audience_type) {
      queryBuilder.andWhere('profile.audience_type = :audienceType', {
        audienceType: filters.audience_type,
      });
    }

    queryBuilder.orderBy('profile.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * Find affiliate profile by ID
   */
  async findOne(id: string): Promise<AffiliateProfile> {
    const profile = await this.affiliateProfileRepository.findOne({
      where: { id },
      relations: ['events'],
    });

    if (!profile) {
      throw new NotFoundException(`Affiliate profile with ID ${id} not found`);
    }

    return profile;
  }

  /**
   * Find affiliate profile by slug (for public landing pages)
   */
  async findBySlug(slug: string): Promise<AffiliateProfile> {
    const profile = await this.affiliateProfileRepository.findOne({
      where: { slug },
      relations: ['events'],
    });

    if (!profile) {
      throw new NotFoundException(
        `Affiliate profile with slug "${slug}" not found`,
      );
    }

    return profile;
  }

  /**
   * Find affiliate profile by email (for onboarding auto-matching)
   */
  async findByEmail(email: string): Promise<AffiliateProfile | null> {
    const profile = await this.affiliateProfileRepository.findOne({
      where: { email },
      relations: ['events'],
    });

    return profile;
  }

  /**
   * Update affiliate profile (slug cannot be changed)
   */
  async update(
    id: string,
    updateDto: UpdateAffiliateProfileDto,
  ): Promise<AffiliateProfile> {
    const profile = await this.findOne(id);

    // Apply updates
    Object.assign(profile, updateDto);

    await this.affiliateProfileRepository.save(profile);

    return this.findOne(id);
  }

  /**
   * Delete affiliate profile (only if no users are linked)
   */
  async remove(id: string): Promise<void> {
    const profile = await this.affiliateProfileRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!profile) {
      throw new NotFoundException(`Affiliate profile with ID ${id} not found`);
    }

    // Check if any user is linked
    if (profile.user) {
      throw new BadRequestException(
        'Cannot delete affiliate profile with linked user. Please unlink the user first.',
      );
    }

    // Delete will cascade to AffiliateEvents
    await this.affiliateProfileRepository.remove(profile);
  }
}
