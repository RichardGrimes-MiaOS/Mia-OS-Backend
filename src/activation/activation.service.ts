import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, OnboardingStatus } from '../users/entities/user.entity';
import { Applicant } from '../applicants/entities/applicant.entity';
import { ActivationActionType } from '../users/enums/activation-action-type.enum';

@Injectable()
export class ActivationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Applicant)
    private readonly applicantRepository: Repository<Applicant>,
  ) {}

  /**
   * Trigger activation for a user
   * Idempotent - only activates once
   */
  async triggerActivation(
    userId: string,
    actionType: ActivationActionType,
  ): Promise<void> {
    try {
      // 1. Check if already activated
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        console.warn(`[ActivationService] User ${userId} not found`);
        return;
      }

      if (user.activated_at) {
        console.log(
          `[ActivationService] User ${userId} already activated on ${user.activated_at}`,
        );
        return; // Already activated
      }

      // 2. For agents, verify onboarding is complete
      if (user.role === UserRole.AGENT || user.role === UserRole.APPLICANT) {
        if (user.onboardingStatus !== OnboardingStatus.ONBOARDED) {
          console.log(
            `[ActivationService] User ${userId} (${user.role}) not yet onboarded (status: ${user.onboardingStatus}), skipping activation`,
          );
          return;
        }
      }

      // 3. Calculate activation metrics
      const activatedAt = new Date();
      const approvedAt = user.approved_at || user.createdAt;
      const timeToActivation = Math.floor(
        (activatedAt.getTime() - approvedAt.getTime()) / 1000,
      );
      const cadenceDay = this.calculateCadenceDay(approvedAt, activatedAt);

      // 4. Determine activation source
      const source = await this.determineActivationSource(userId);

      // 5. Update user with activation data
      await this.userRepository.update(userId, {
        activated_at: activatedAt,
        time_to_activation: timeToActivation,
        activation_source: source,
        activation_cadence_day: cadenceDay,
        activation_action_type: actionType,
      });

      console.log(
        `[ActivationService] ✅ User ${userId} activated via ${actionType} (source: ${source}, day: ${cadenceDay}, time: ${timeToActivation}s)`,
      );
    } catch (error) {
      console.error(
        `[ActivationService] Failed to activate user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Determine activation source from applicant referral data
   */
  private async determineActivationSource(userId: string): Promise<string> {
    const applicant = await this.applicantRepository.findOne({
      where: { userId },
    });

    if (!applicant) {
      return 'organic';
    }

    // referral_code exists and referral_link is null → affiliate
    if (applicant.referral_code && !applicant.referral_link) {
      return 'affiliate';
    }

    // referral_link exists and referral_code is null → affiliate_only
    if (applicant.referral_link && !applicant.referral_code) {
      return 'affiliate_only';
    }

    // Neither exists → organic/direct
    return 'organic';
  }

  /**
   * Calculate which cadence day the activation occurred on
   */
  private calculateCadenceDay(approvedAt: Date, activatedAt: Date): number {
    const diffMs = activatedAt.getTime() - approvedAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Day 1, 2, 3, etc.
  }
}