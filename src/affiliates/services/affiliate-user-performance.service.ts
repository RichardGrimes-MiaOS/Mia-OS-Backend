import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AffiliateUserPerformance } from '../entities/affiliate-user-performance.entity';

@Injectable()
export class AffiliateUserPerformanceService {
  constructor(
    @InjectRepository(AffiliateUserPerformance)
    private readonly performanceRepository: Repository<AffiliateUserPerformance>,
  ) {}

  /**
   * Create performance record for affiliate user
   */
  async create(userId: string): Promise<AffiliateUserPerformance> {
    const performance = this.performanceRepository.create({
      user_id: userId,
      referrals_made: 0,
      referrals_clicks: 0,
      referrals_converted: 0,
      commission_earned: 0.0,
      payout_history: [],
    });

    return this.performanceRepository.save(performance);
  }

  /**
   * Find performance record by user ID
   */
  async findByUserId(userId: string): Promise<AffiliateUserPerformance> {
    const performance = await this.performanceRepository.findOne({
      where: { user_id: userId },
    });

    if (!performance) {
      throw new NotFoundException(
        `Performance record for user ${userId} not found`,
      );
    }

    return performance;
  }

  /**
   * Increment referral clicks (placeholder for future tracking)
   */
  async incrementReferralClicks(userId: string): Promise<void> {
    await this.performanceRepository.increment(
      { user_id: userId },
      'referrals_clicks',
      1,
    );
  }

  /**
   * Increment referrals made (placeholder for future tracking)
   */
  async incrementReferralsMade(userId: string): Promise<void> {
    await this.performanceRepository.increment(
      { user_id: userId },
      'referrals_made',
      1,
    );
  }

  /**
   * Increment referrals converted (placeholder for future tracking)
   */
  async incrementReferralsConverted(userId: string): Promise<void> {
    await this.performanceRepository.increment(
      { user_id: userId },
      'referrals_converted',
      1,
    );
  }

  /**
   * Add commission (placeholder for future payment integration)
   */
  async addCommission(userId: string, amount: number): Promise<void> {
    const performance = await this.findByUserId(userId);
    performance.commission_earned += amount;
    await this.performanceRepository.save(performance);
  }
}
