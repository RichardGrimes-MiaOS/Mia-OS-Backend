import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserOnboardingStep,
  OnboardingStepKey,
} from '../entities/user-onboarding-step.entity';
import { AnalyticsService } from '../../analytics/analytics.service';
import { EventType } from '../../analytics/entities/user-event.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class OnboardingStepsService {
  private readonly logger = new Logger(OnboardingStepsService.name);

  constructor(
    @InjectRepository(UserOnboardingStep)
    private readonly userOnboardingStepRepository: Repository<UserOnboardingStep>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Enter a new step (creates record with enteredAt = now)
   */
  async enterStep(
    userId: string,
    stepKey: OnboardingStepKey,
    enteredAt: Date = new Date(),
  ): Promise<UserOnboardingStep> {
    // Check if step already exists
    const existing = await this.userOnboardingStepRepository.findOne({
      where: { userId, stepKey },
    });

    if (existing) {
      this.logger.warn(
        `Step ${stepKey} already exists for user ${userId}. Skipping creation.`,
      );
      return existing;
    }

    const step = this.userOnboardingStepRepository.create({
      userId,
      stepKey,
      enteredAt,
      completedAt: null,
    });

    const saved = await this.userOnboardingStepRepository.save(step);

    // Get user for event tracking
    const user = await this.userRepository.findOne({ where: { id: userId } });

    // Track step_started event
    await this.analyticsService.trackEvent({
      userId,
      eventType: EventType.STEP_STARTED,
      role: user?.role,
      affiliateId: user?.affiliate_profile_id,
      metadata: { step: stepKey },
    });

    this.logger.log(
      `User ${userId} entered step: ${stepKey} at ${enteredAt.toISOString()}`,
    );

    return saved;
  }

  /**
   * Complete a step (updates completedAt = now)
   */
  async completeStep(
    userId: string,
    stepKey: OnboardingStepKey,
    completedAt: Date = new Date(),
  ): Promise<UserOnboardingStep | null> {
    const step = await this.userOnboardingStepRepository.findOne({
      where: { userId, stepKey },
    });

    if (!step) {
      this.logger.warn(
        `Step ${stepKey} not found for user ${userId}. Cannot complete.`,
      );
      return null;
    }

    if (step.completedAt) {
      this.logger.warn(
        `Step ${stepKey} already completed for user ${userId} at ${step.completedAt.toISOString()}`,
      );
      return step;
    }

    step.completedAt = completedAt;
    const updated = await this.userOnboardingStepRepository.save(step);

    // Get user for event tracking
    const user = await this.userRepository.findOne({ where: { id: userId } });

    // Track step_completed event
    await this.analyticsService.trackEvent({
      userId,
      eventType: EventType.STEP_COMPLETED,
      role: user?.role,
      affiliateId: user?.affiliate_profile_id,
      metadata: { step: stepKey },
    });

    this.logger.log(
      `User ${userId} completed step: ${stepKey} at ${completedAt.toISOString()}`,
    );

    return updated;
  }

  /**
   * Complete current step and automatically progress to next step
   */
  async completeAndProgress(
    userId: string,
    currentStep: OnboardingStepKey,
    nextStep: OnboardingStepKey,
  ): Promise<{
    completed: UserOnboardingStep | null;
    next: UserOnboardingStep;
  }> {
    const now = new Date();

    // Complete current step
    const completed = await this.completeStep(userId, currentStep, now);

    // Enter next step
    const next = await this.enterStep(userId, nextStep, now);

    this.logger.log(
      `User ${userId} progressed from ${currentStep} → ${nextStep}`,
    );

    return { completed, next };
  }

  /**
   * Create a step with both entered and completed timestamps (for instant steps)
   */
  async createCompletedStep(
    userId: string,
    stepKey: OnboardingStepKey,
    enteredAt: Date,
    completedAt: Date,
  ): Promise<UserOnboardingStep> {
    const step = this.userOnboardingStepRepository.create({
      userId,
      stepKey,
      enteredAt,
      completedAt,
    });

    const saved = await this.userOnboardingStepRepository.save(step);

    this.logger.log(
      `User ${userId} completed step: ${stepKey} (instant) at ${completedAt.toISOString()}`,
    );

    return saved;
  }

  /**
   * Get a specific step for a user
   */
  async getStep(
    userId: string,
    stepKey: OnboardingStepKey,
  ): Promise<UserOnboardingStep | null> {
    return await this.userOnboardingStepRepository.findOne({
      where: { userId, stepKey },
    });
  }

  /**
   * Get all steps for a user (ordered by enteredAt)
   */
  async getUserSteps(userId: string): Promise<UserOnboardingStep[]> {
    return await this.userOnboardingStepRepository.find({
      where: { userId },
      order: { enteredAt: 'ASC' },
    });
  }
}