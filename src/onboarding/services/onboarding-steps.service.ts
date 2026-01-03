import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
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
   *
   * @param userId - The user ID
   * @param stepKey - The onboarding step key
   * @param enteredAt - When the step was entered (defaults to now)
   * @param manager - Optional EntityManager for transaction support
   */
  async enterStep(
    userId: string,
    stepKey: OnboardingStepKey,
    enteredAt: Date = new Date(),
    manager?: EntityManager,
  ): Promise<UserOnboardingStep> {
    // Use provided manager or fall back to injected repository
    const stepRepo = manager
      ? manager.getRepository(UserOnboardingStep)
      : this.userOnboardingStepRepository;
    const userRepo = manager
      ? manager.getRepository(User)
      : this.userRepository;

    // Check if step already exists
    const existing = await stepRepo.findOne({
      where: { userId, stepKey },
    });

    if (existing) {
      this.logger.warn(
        `Step ${stepKey} already exists for user ${userId}. Skipping creation.`,
      );
      return existing;
    }

    const step = stepRepo.create({
      userId,
      stepKey,
      enteredAt,
      completedAt: null,
    });

    const saved = await stepRepo.save(step);

    // Get user for event tracking
    const user = await userRepo.findOne({ where: { id: userId } });

    // Track step_started event (outside transaction - analytics can be eventually consistent)
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
   *
   * @param userId - The user ID
   * @param stepKey - The onboarding step key
   * @param completedAt - When the step was completed (defaults to now)
   * @param manager - Optional EntityManager for transaction support
   */
  async completeStep(
    userId: string,
    stepKey: OnboardingStepKey,
    completedAt: Date = new Date(),
    manager?: EntityManager,
  ): Promise<UserOnboardingStep | null> {
    // Use provided manager or fall back to injected repository
    const stepRepo = manager
      ? manager.getRepository(UserOnboardingStep)
      : this.userOnboardingStepRepository;
    const userRepo = manager
      ? manager.getRepository(User)
      : this.userRepository;

    const step = await stepRepo.findOne({
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
    const updated = await stepRepo.save(step);

    // Get user for event tracking
    const user = await userRepo.findOne({ where: { id: userId } });

    // Track step_completed event (outside transaction - analytics can be eventually consistent)
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
   *
   * @param userId - The user ID
   * @param currentStep - The step to complete
   * @param nextStep - The step to enter
   * @param manager - Optional EntityManager for transaction support
   */
  async completeAndProgress(
    userId: string,
    currentStep: OnboardingStepKey,
    nextStep: OnboardingStepKey,
    manager?: EntityManager,
  ): Promise<{
    completed: UserOnboardingStep | null;
    next: UserOnboardingStep;
  }> {
    const now = new Date();

    // Complete current step (pass manager for transaction support)
    const completed = await this.completeStep(userId, currentStep, now, manager);

    // Enter next step (pass manager for transaction support)
    const next = await this.enterStep(userId, nextStep, now, manager);

    this.logger.log(
      `User ${userId} progressed from ${currentStep} → ${nextStep}`,
    );

    return { completed, next };
  }

  /**
   * Create a step with both entered and completed timestamps (for instant steps)
   *
   * @param userId - The user ID
   * @param stepKey - The onboarding step key
   * @param enteredAt - When the step was entered
   * @param completedAt - When the step was completed
   * @param manager - Optional EntityManager for transaction support
   */
  async createCompletedStep(
    userId: string,
    stepKey: OnboardingStepKey,
    enteredAt: Date,
    completedAt: Date,
    manager?: EntityManager,
  ): Promise<UserOnboardingStep> {
    // Use provided manager or fall back to injected repository
    const stepRepo = manager
      ? manager.getRepository(UserOnboardingStep)
      : this.userOnboardingStepRepository;

    const step = stepRepo.create({
      userId,
      stepKey,
      enteredAt,
      completedAt,
    });

    const saved = await stepRepo.save(step);

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