import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import {
  User,
  UserRole,
  OnboardingStatus,
} from '../../users/entities/user.entity';
import { UserOnboardingStep } from '../../onboarding/entities/user-onboarding-step.entity';
import { LicensedAgentIntake } from '../../onboarding/entities/licensed-agent-intake.entity';
import {
  UserEvent,
  EventType,
} from '../../analytics/entities/user-event.entity';
import { ActionKey } from '../enums/action-key.enum';
import {
  getRoleBaseline,
  ACTION_PREREQUISITES,
} from '../config/role-baseline-config';

export interface DailyPlanResponse {
  required_actions: ActionKey[];
  completed_actions: ActionKey[];
  progress_percent: number;
  next_required_action_key: ActionKey | null;
  computed_at: string;
}

@Injectable()
export class DailyPlanResolverService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserOnboardingStep)
    private userOnboardingStepRepository: Repository<UserOnboardingStep>,
    @InjectRepository(LicensedAgentIntake)
    private licensedAgentIntakeRepository: Repository<LicensedAgentIntake>,
    @InjectRepository(UserEvent)
    private userEventRepository: Repository<UserEvent>,
  ) {}

  /**
   * Pure read-only resolver - computes daily plan from existing database state
   * Does NOT write to database (Phase 1)
   * Does NOT use AI or dynamic generation
   *
   * Philosophy: Lookup + Filter, not AI magic
   */
  async resolveDailyPlan(userId: string): Promise<DailyPlanResponse> {
    const computedAt = new Date().toISOString();

    // 1. Get user data
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Detect completed actions from database state
    const completedActions = await this.detectCompletedActions(user);

    console.log(
      '[DailyPlanResolverService] Completed actions: ',
      completedActions,
    );

    // 3. Get role baseline (static lookup)
    const baselineActions = getRoleBaseline(user.role, user.isLicensed);

    console.log(
      '[DailyPlanResolverService] Baseline actions: ',
      baselineActions,
    );

    // 4. Apply state filters to determine required actions
    const requiredActions = this.applyStateFilters(
      baselineActions,
      completedActions,
      user,
    );

    console.log(
      '[DailyPlanResolverService] Required actions: ',
      requiredActions,
    );

    // 5. Calculate progress percentage
    const progressPercent = this.calculateProgress(
      completedActions,
      requiredActions,
    );

    console.log(
      '[DailyPlanResolverService] Progress percentage: ',
      progressPercent,
    );

    // 6. Next required action key (Phase 1: null)
    const nextRequiredActionKey = null;

    console.log(
      '[DailyPlanResolverService] Next required action key: ',
      nextRequiredActionKey,
    );

    return {
      required_actions: requiredActions,
      completed_actions: completedActions,
      progress_percent: progressPercent,
      next_required_action_key: nextRequiredActionKey,
      computed_at: computedAt,
    };
  }

  /**
   * Detect completed actions from database state
   *
   * Sources (in priority order):
   * 1. user_onboarding_steps (completedAt IS NOT NULL)
   * 2. licensed_agent_intake table (existence check)
   * 3. users.affiliate_profile_id (existence check)
   * 4. users.referral_link (existence check)
   * 5. user_events (referral_clicked event)
   */
  private async detectCompletedActions(user: User): Promise<ActionKey[]> {
    let completedActions: ActionKey[] = [];

    // 1. Query user_onboarding_steps for completed steps
    const completedSteps = await this.userOnboardingStepRepository.find({
      where: {
        userId: user.id,
        completedAt: Not(IsNull()),
      },
    });

    // Map completed steps to action keys using .map()
    const completedStepKeys = completedSteps.map((step) => {
      // Map OnboardingStepKey to ActionKey (they should align)
      // Convert snake_case to match ActionKey enum values
      return step.stepKey as unknown as ActionKey;
    });

    completedActions = [...completedStepKeys];

    // 2. Check licensed_agent_intake submission (licensed agents only)
    if (user.isLicensed && user.role === UserRole.AGENT) {
      const licensedIntake = await this.licensedAgentIntakeRepository.findOne({
        where: { userId: user.id },
      });

      if (licensedIntake) {
        completedActions.push(ActionKey.LICENSED_AGENT_INTAKE);
      }
    }

    // 3. Check affiliate profile submission (affiliate_only role)
    if (user.role === UserRole.AFFILIATE_ONLY && user.affiliate_profile_id) {
      completedActions.push(ActionKey.AFFILIATE_PROFILE_SUBMITTED);
    }

    // 4. Check referral link generated
    if (user.referral_link) {
      completedActions.push(ActionKey.REFERRAL_LINK_GENERATED);
    }

    // 5. Check first share (referral clicked event exists)
    if (
      user.role === UserRole.AFFILIATE_ONLY ||
      user.role === UserRole.AFFILIATE
    ) {
      const firstShareEvent = await this.userEventRepository.findOne({
        where: {
          affiliate_id: user.id,
          event_type: EventType.REFERRAL_CLICKED,
        },
      });

      if (firstShareEvent) {
        completedActions.push(ActionKey.FIRST_SHARE);
      }
    }

    // Remove duplicates (in case of data inconsistencies)
    return [...new Set(completedActions)];
  }

  /**
   * Apply state filters to baseline actions
   *
   * Rules:
   * 1. If onboardingStatus = 'onboarded' → required_actions = [] (fully onboarded)
   * 2. If isLicensed = true → drop licensing steps (exam_scheduled, license_uploaded)
   * 3. If onboardingStatus = 'pending_activation' → only activation_unlocked remains
   * 4. Apply prerequisite ordering (can't activate before onboarding, etc.)
   * 5. Remove already completed actions from required list
   */
  private applyStateFilters(
    baselineActions: ActionKey[],
    completedActions: ActionKey[],
    user: User,
  ): ActionKey[] {
    let requiredActions = [...baselineActions];

    // Rule 1: Fully onboarded users have no required actions
    if (user.onboardingStatus === OnboardingStatus.ONBOARDED) {
      return [];
    }

    // Rule 2: Licensed users skip licensing steps
    if (user.isLicensed) {
      requiredActions = requiredActions.filter(
        (action) =>
          action !== ActionKey.EXAM_SCHEDULED &&
          action !== ActionKey.LICENSE_UPLOADED,
      );
    }

    // Rule 3: Pending activation users only need activation
    if (user.onboardingStatus === OnboardingStatus.PENDING_ACTIVATION) {
      // Keep only activation_unlocked if it's in the baseline
      requiredActions = requiredActions.filter(
        (action) => action === ActionKey.ACTIVATION_UNLOCKED,
      );
    }

    // Rule 4: Apply prerequisite ordering
    // Keep only actions whose prerequisites are completed
    // Context-aware: licensed vs unlicensed agents have different chains
    requiredActions = requiredActions.filter((action) => {
      const prerequisite = this.getPrerequisiteForAction(
        action,
        user.isLicensed,
      );

      // No prerequisite → always required
      if (!prerequisite) return true;

      // Prerequisite must be completed
      return completedActions.includes(prerequisite);
    });

    // Rule 5: Remove already completed actions
    requiredActions = requiredActions.filter(
      (action) => !completedActions.includes(action),
    );

    return requiredActions;
  }

  /**
   * Get prerequisite for an action based on context (licensed vs unlicensed)
   *
   * Licensed and unlicensed agents have different prerequisite chains:
   * - Unlicensed: license_uploaded → e&o_uploaded
   * - Licensed: licensed_agent_intake → e&o_uploaded
   *
   * @param action - The action to get prerequisite for
   * @param isLicensed - Whether user is licensed
   * @returns Prerequisite action key or null if no prerequisite
   */
  private getPrerequisiteForAction(
    action: ActionKey,
    isLicensed: boolean,
  ): ActionKey | null {
    // Special case: e&o_uploaded has different prerequisites based on license status
    if (action === ActionKey.EO_UPLOADED) {
      return isLicensed
        ? ActionKey.LICENSED_AGENT_INTAKE // Licensed path
        : ActionKey.LICENSE_UPLOADED; // Unlicensed path
    }

    // For all other actions, use static prerequisites
    return ACTION_PREREQUISITES[action];
  }

  /**
   * Calculate progress percentage
   *
   * Formula: (completed / required) * 100
   *
   * Special cases:
   * - If required_actions is empty → 100% (nothing left to do)
   * - If no actions completed → 0%
   */
  private calculateProgress(
    completedActions: ActionKey[],
    requiredActions: ActionKey[],
  ): number {
    // Special case: No required actions → fully complete
    if (requiredActions.length === 0) {
      return 100;
    }

    // Total actions = completed + required (remaining)
    const totalActions = completedActions.length + requiredActions.length;

    // Avoid division by zero (should never happen, but defensive)
    if (totalActions === 0) {
      return 0;
    }

    const progressPercent = Math.round(
      (completedActions.length / totalActions) * 100,
    );

    return progressPercent;
  }
}
