import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import {
  UserOnboardingStep,
  OnboardingStepKey,
} from '../onboarding/entities/user-onboarding-step.entity';
import { AffiliateProfile } from '../affiliates/entities/affiliate-profile.entity';
import { AffiliateEvents } from '../affiliates/entities/affiliate-events.entity';
import { AffiliateUserPerformance } from '../affiliates/entities/affiliate-user-performance.entity';

export interface ActivationRateMetrics {
  overall: {
    total_approved: number;
    total_activated: number;
    activation_rate: number;
  };
  average_time_to_activation: string;
}

export interface StepConversionMetrics {
  step_key: string;
  entered_count: number;
  completed_count: number;
  completion_rate: number;
  conversion_to_next: number;
  average_time: string;
  drop_off_count: number;
}

export interface OnboardingFunnelMetrics {
  steps: StepConversionMetrics[];
  overall_summary: {
    total_started: number;
    total_completed: number;
    overall_completion_rate: number;
  };
}

export interface StalledUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  stalled_step: string;
  stalled_since: Date;
  stalled_duration: string;
  stalled_duration_hours: number;
  threshold_hours: number;
  hours_overdue: number;
  last_completed_step: string | null;
  last_completed_at: Date | null;
}

export interface StalledUsersMetrics {
  stalled_users: StalledUser[];
  summary: {
    total_stalled: number;
    by_step: Record<string, number>;
    average_overdue_hours: number;
  };
}

export interface AffiliatePerformanceMetric {
  affiliate_id: string;
  affiliate_type: 'profile' | 'user'; // Type of affiliate
  affiliate_name: string;
  affiliate_email: string;
  referral_code: string | null;
  referral_link: string;
  total_clicks: number;
  unique_visitors: number;
  signups: number;
  conversions: number;
  activation_rate: number;
  avg_time_to_activation: string;
  avg_time_to_activation_hours: number;
}

export interface AffiliatePerformanceMetrics {
  affiliate_profiles: AffiliatePerformanceMetric[];
  user_affiliates: AffiliatePerformanceMetric[];
  summary: {
    total_affiliate_profiles: number;
    total_user_affiliates: number;
    combined_total_signups: number;
    combined_total_conversions: number;
    combined_total_activated: number;
    overall_activation_rate: number;
  };
}

@Injectable()
export class AdminMetricsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserOnboardingStep)
    private readonly userOnboardingStepRepository: Repository<UserOnboardingStep>,
    @InjectRepository(AffiliateProfile)
    private readonly affiliateProfileRepository: Repository<AffiliateProfile>,
    @InjectRepository(AffiliateEvents)
    private readonly affiliateEventsRepository: Repository<AffiliateEvents>,
    @InjectRepository(AffiliateUserPerformance)
    private readonly affiliateUserPerformanceRepository: Repository<AffiliateUserPerformance>,
  ) {}

  /**
   * Get activation rate metrics
   */
  async getActivationRate(): Promise<ActivationRateMetrics> {
    // Count total approved users (agent or affiliate_only with active status)
    const totalApproved = await this.userRepository.count({
      where: {
        role: In([UserRole.AGENT, UserRole.AFFILIATE_ONLY]),
        status: UserStatus.ACTIVE,
      },
    });

    // Count total activated users (agent or affiliate_only with active status and activated_at set)
    const totalActivated = await this.userRepository.count({
      where: {
        role: In([UserRole.AGENT, UserRole.AFFILIATE_ONLY]),
        status: UserStatus.ACTIVE,
        activated_at: Not(IsNull()),
      },
    });

    // Calculate activation rate
    const overallRate =
      totalApproved > 0 ? (totalActivated / totalApproved) * 100 : 0;

    // Average time to activation (in seconds)
    const avgResult = await this.userRepository
      .createQueryBuilder('user')
      .select('AVG(user.time_to_activation)', 'avg_time')
      .where('user.role IN (:...roles)', {
        roles: [UserRole.AGENT, UserRole.AFFILIATE_ONLY],
      })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('user.activated_at IS NOT NULL')
      .andWhere('user.time_to_activation IS NOT NULL')
      .getRawOne();

    const avgTimeSeconds =
      avgResult?.avg_time && !isNaN(parseFloat(avgResult.avg_time))
        ? parseFloat(avgResult.avg_time)
        : 0;

    const formattedAvgTime = this.formatSeconds(avgTimeSeconds);

    return {
      overall: {
        total_approved: totalApproved,
        total_activated: totalActivated,
        activation_rate: parseFloat(overallRate.toFixed(2)),
      },
      average_time_to_activation: formattedAvgTime,
    };
  }

  /**
   * Get onboarding funnel step conversion metrics
   */
  async getStepConversionMetrics(): Promise<OnboardingFunnelMetrics> {
    const stepOrder = [
      OnboardingStepKey.ACCOUNT_CREATED,
      OnboardingStepKey.LICENSED_CHECK,
      OnboardingStepKey.EXAM_SCHEDULED,
      OnboardingStepKey.LICENSE_UPLOADED,
      OnboardingStepKey.EO_UPLOADED,
      OnboardingStepKey.ACTIVATION_UNLOCKED,
    ];

    const stepMetrics: StepConversionMetrics[] = [];

    for (let i = 0; i < stepOrder.length; i++) {
      const currentStepKey = stepOrder[i];
      const nextStepKey = stepOrder[i + 1];

      // Count users who entered this step
      const enteredCount = await this.userOnboardingStepRepository.count({
        where: { stepKey: currentStepKey },
      });

      // Count users who completed this step
      const completedCount = await this.userOnboardingStepRepository.count({
        where: {
          stepKey: currentStepKey,
          completedAt: Not(IsNull()),
        },
      });

      // Count users who entered the next step (conversion)
      const nextStepEntered = nextStepKey
        ? await this.userOnboardingStepRepository.count({
            where: { stepKey: nextStepKey },
          })
        : 0;

      // Calculate completion rate
      const completionRate =
        enteredCount > 0 ? (completedCount / enteredCount) * 100 : 0;

      // Calculate conversion to next step
      const conversionToNext =
        completedCount > 0 && nextStepKey
          ? (nextStepEntered / completedCount) * 100
          : 0;

      // Calculate drop-off (users who entered but didn't complete)
      const dropOffCount = enteredCount - completedCount;

      // Calculate average time spent in this step
      const avgTimeResult = await this.userOnboardingStepRepository
        .createQueryBuilder('step')
        .select(
          'AVG(EXTRACT(EPOCH FROM (step.completedAt - step.enteredAt)))',
          'avg_seconds',
        )
        .where('step.stepKey = :stepKey', { stepKey: currentStepKey })
        .andWhere('step.completedAt IS NOT NULL')
        .getRawOne();

      const avgSeconds = avgTimeResult?.avg_seconds
        ? parseFloat(avgTimeResult.avg_seconds)
        : 0;

      stepMetrics.push({
        step_key: currentStepKey,
        entered_count: enteredCount,
        completed_count: completedCount,
        completion_rate: parseFloat(completionRate.toFixed(2)),
        conversion_to_next: parseFloat(conversionToNext.toFixed(2)),
        average_time: this.formatSeconds(avgSeconds),
        drop_off_count: dropOffCount,
      });
    }

    // Calculate overall summary
    const totalStarted =
      stepMetrics.length > 0 ? stepMetrics[0].entered_count : 0;
    const totalCompleted =
      stepMetrics.length > 0
        ? stepMetrics[stepMetrics.length - 1].completed_count
        : 0;
    const overallCompletionRate =
      totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;

    return {
      steps: stepMetrics,
      overall_summary: {
        total_started: totalStarted,
        total_completed: totalCompleted,
        overall_completion_rate: parseFloat(overallCompletionRate.toFixed(2)),
      },
    };
  }

  /**
   * Get stalled users (users stuck at a step past threshold)
   */
  async getStalledUsers(): Promise<StalledUsersMetrics> {
    const thresholdHours = parseInt(
      process.env.ONBOARDING_STALL_THRESHOLD_HOURS || '72',
      10,
    );

    // Find all incomplete steps with user data
    const incompleteSteps = await this.userOnboardingStepRepository
      .createQueryBuilder('step')
      .innerJoinAndSelect('step.user', 'user')
      .where('step.completedAt IS NULL')
      .andWhere(
        `EXTRACT(EPOCH FROM (NOW() - step.enteredAt)) / 3600 > :thresholdHours`,
        { thresholdHours },
      )
      .orderBy('step.enteredAt', 'ASC')
      .getMany();

    const stalledUsers: StalledUser[] = [];
    const byStepCount: Record<string, number> = {};
    let totalOverdueHours = 0;

    for (const step of incompleteSteps) {
      const now = new Date();
      const stalledDurationSeconds =
        (now.getTime() - step.enteredAt.getTime()) / 1000;
      const stalledDurationHours = stalledDurationSeconds / 3600;
      const hoursOverdue = stalledDurationHours - thresholdHours;

      // Find last completed step for this user
      const lastCompletedStep = await this.userOnboardingStepRepository.findOne(
        {
          where: {
            userId: step.userId,
            completedAt: Not(IsNull()),
          },
          order: {
            completedAt: 'DESC',
          },
        },
      );

      stalledUsers.push({
        user_id: step.user.id,
        email: step.user.email,
        first_name: step.user.firstName,
        last_name: step.user.lastName,
        stalled_step: step.stepKey,
        stalled_since: step.enteredAt,
        stalled_duration: this.formatSeconds(stalledDurationSeconds),
        stalled_duration_hours: parseFloat(stalledDurationHours.toFixed(2)),
        threshold_hours: thresholdHours,
        hours_overdue: parseFloat(hoursOverdue.toFixed(2)),
        last_completed_step: lastCompletedStep?.stepKey || null,
        last_completed_at: lastCompletedStep?.completedAt || null,
      });

      // Count by step
      byStepCount[step.stepKey] = (byStepCount[step.stepKey] || 0) + 1;
      totalOverdueHours += hoursOverdue;
    }

    const averageOverdueHours =
      stalledUsers.length > 0
        ? parseFloat((totalOverdueHours / stalledUsers.length).toFixed(2))
        : 0;

    return {
      stalled_users: stalledUsers,
      summary: {
        total_stalled: stalledUsers.length,
        by_step: byStepCount,
        average_overdue_hours: averageOverdueHours,
      },
    };
  }

  /**
   * Get affiliate performance metrics (quality scoring)
   * Includes both affiliate profiles and user affiliates (role = affiliate_only)
   */
  async getAffiliatePerformance(): Promise<AffiliatePerformanceMetrics> {
    const affiliateProfileMetrics: AffiliatePerformanceMetric[] = [];
    const userAffiliateMetrics: AffiliatePerformanceMetric[] = [];

    let totalSignupsProfiles = 0;
    let totalConversionsProfiles = 0;
    let totalActivatedProfiles = 0;

    let totalSignupsUsers = 0;
    let totalConversionsUsers = 0;
    let totalActivatedUsers = 0;

    // ===== Part 1: Process Affiliate Profiles =====
    const affiliateProfiles = await this.affiliateProfileRepository.find({
      relations: ['events'],
    });

    for (const profile of affiliateProfiles) {
      const events = profile.events;

      // Get all users referred by this affiliate (using referral_link)
      const referredUsers = await this.userRepository.find({
        where: {
          referral_link: profile.referral_link,
        },
      });

      // Count activated users (those with activated_at set)
      const activatedUsers = referredUsers.filter(
        (user) => user.activated_at !== null && user.activated_at !== undefined,
      );

      // Calculate activation rate for this affiliate's referrals
      const activationRate =
        events.total_conversions > 0
          ? (activatedUsers.length / events.total_conversions) * 100
          : 0;

      // Calculate average time to activation for this affiliate's referrals
      const activatedUsersWithTime = activatedUsers.filter(
        (user) => user.time_to_activation !== null,
      );

      let avgTimeSeconds = 0;
      if (activatedUsersWithTime.length > 0) {
        const totalTime = activatedUsersWithTime.reduce(
          (sum, user) => sum + (user.time_to_activation || 0),
          0,
        );
        avgTimeSeconds = totalTime / activatedUsersWithTime.length;
      }

      affiliateProfileMetrics.push({
        affiliate_id: profile.id,
        affiliate_type: 'profile',
        affiliate_name: profile.name,
        affiliate_email: profile.email || 'N/A',
        referral_code: profile.referral_code,
        referral_link: profile.referral_link,
        total_clicks: events.total_clicks,
        unique_visitors: events.total_unique_visitors,
        signups: events.total_signups,
        conversions: events.total_conversions,
        activation_rate: parseFloat(activationRate.toFixed(2)),
        avg_time_to_activation: this.formatSeconds(avgTimeSeconds),
        avg_time_to_activation_hours: parseFloat(
          (avgTimeSeconds / 3600).toFixed(2),
        ),
      });

      // Accumulate summary totals for profiles
      totalSignupsProfiles += events.total_signups;
      totalConversionsProfiles += events.total_conversions;
      totalActivatedProfiles += activatedUsers.length;
    }

    // ===== Part 2: Process User Affiliates (role = affiliate_only) =====
    const userAffiliates = await this.userRepository.find({
      where: {
        role: UserRole.AFFILIATE_ONLY,
      },
      relations: ['performance'],
    });

    for (const user of userAffiliates) {
      // Get performance data from affiliate_user_performance table
      let performance = user.performance;
      if (!performance) {
        performance = await this.affiliateUserPerformanceRepository.findOne({
          where: { user_id: user.id },
        });
      }

      // Default to 0 if no performance record exists
      const referralsMade = performance?.referrals_made || 0;
      const referralsClicks = performance?.referrals_clicks || 0;
      const referralsConverted = performance?.referrals_converted || 0;

      // Get all users referred by this user affiliate (using referral_link)
      const referredUsers = await this.userRepository.find({
        where: {
          referral_link: user.referral_link,
        },
      });

      // Count activated users (those with activated_at set)
      const activatedUsers = referredUsers.filter(
        (u) => u.activated_at !== null && u.activated_at !== undefined,
      );

      // Calculate activation rate for this user affiliate's referrals
      const activationRate =
        referralsConverted > 0
          ? (activatedUsers.length / referralsConverted) * 100
          : 0;

      // Calculate average time to activation
      const activatedUsersWithTime = activatedUsers.filter(
        (u) => u.time_to_activation !== null,
      );

      let avgTimeSeconds = 0;
      if (activatedUsersWithTime.length > 0) {
        const totalTime = activatedUsersWithTime.reduce(
          (sum, u) => sum + (u.time_to_activation || 0),
          0,
        );
        avgTimeSeconds = totalTime / activatedUsersWithTime.length;
      }

      userAffiliateMetrics.push({
        affiliate_id: user.id,
        affiliate_type: 'user',
        affiliate_name: `${user.firstName} ${user.lastName}`,
        affiliate_email: user.email,
        referral_code: null, // User affiliates don't have referral codes
        referral_link: user.referral_link || 'N/A',
        total_clicks: referralsClicks,
        unique_visitors: 0, // Not tracked for user affiliates
        signups: referralsMade,
        conversions: referralsConverted,
        activation_rate: parseFloat(activationRate.toFixed(2)),
        avg_time_to_activation: this.formatSeconds(avgTimeSeconds),
        avg_time_to_activation_hours: parseFloat(
          (avgTimeSeconds / 3600).toFixed(2),
        ),
      });

      // Accumulate summary totals for user affiliates
      totalSignupsUsers += referralsMade;
      totalConversionsUsers += referralsConverted;
      totalActivatedUsers += activatedUsers.length;
    }

    // ===== Summary: Combine totals from both types =====
    const combinedSignups = totalSignupsProfiles + totalSignupsUsers;
    const combinedConversions = totalConversionsProfiles + totalConversionsUsers;
    const combinedActivated = totalActivatedProfiles + totalActivatedUsers;

    const overallActivationRate =
      combinedConversions > 0
        ? (combinedActivated / combinedConversions) * 100
        : 0;

    return {
      affiliate_profiles: affiliateProfileMetrics,
      user_affiliates: userAffiliateMetrics,
      summary: {
        total_affiliate_profiles: affiliateProfiles.length,
        total_user_affiliates: userAffiliates.length,
        combined_total_signups: combinedSignups,
        combined_total_conversions: combinedConversions,
        combined_total_activated: combinedActivated,
        overall_activation_rate: parseFloat(overallActivationRate.toFixed(2)),
      },
    };
  }

  /**
   * Format seconds to human-readable time (e.g., "5h 35m 46s")
   */
  private formatSeconds(totalSeconds: number): string {
    if (totalSeconds === 0) {
      return '0s';
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days}d`);
    }
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds}s`);
    }

    return parts.join(' ');
  }
}