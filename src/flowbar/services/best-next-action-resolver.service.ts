import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { BNARecommendation } from '../types/bna-recommendation.type';
import type { CandidateAction } from '../types/candidate-action.interface';
import { Contact } from '../../contacts/entities/contact.entity';
import { User } from '../../users/entities/user.entity';
import { DailyPlanResolverService } from '../../daily-plan/services/daily-plan-resolver.service';
import { SSMService } from '../../cadence/services/ssm.service';
import { PipelineStage } from '../../contacts/enums/pipeline-stage.enum';
import {
  ACTION_KEY_TO_TYPE,
  ACTION_TYPE_TO_KEY,
} from '../config/action-mapping.config';
import { ACTION_METADATA } from '../config/action-metadata.config';
import { ActionType } from '../enums/action-type.enum';
import { ActionCategory } from '../enums/action-category.enum';
import type { ActionKey } from '../../daily-plan/enums/action-key.enum';
import { GuidanceReasonCode } from '../enums/guidance-reason-code.enum';

/**
 * BestNextActionResolver Service
 *
 * Core resolver implementing the 4-step algorithm for determining
 * the single best action to recommend to a user.
 *
 * Algorithm:
 * 1. Build candidate action pool (from UserDailyPlan + system blockers + OPS)
 * 2. Apply hard constraints (completion, prerequisites, state, access)
 * 3. Apply cadence alignment (filter-first strategy, structural bias only)
 * 4. Resolve using tie-breaking (category > priority > unblock > sequence)
 *
 * Returns either an actionable recommendation or supportive guidance.
 */
@Injectable()
export class BestNextActionResolver {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly dailyPlanResolver: DailyPlanResolverService,
    private readonly ssmService: SSMService,
  ) {}

  /**
   * Resolve the best next action for a user
   *
   * Main entry point for BNA resolution.
   * Executes 4-step algorithm and returns single recommendation.
   *
   * @param userId - User ID to resolve action for
   * @param context - Optional UI context (metadata only in Phase 1)
   * @returns BNA recommendation (actionable or supportive guidance)
   */
  async resolve(userId: string, context?: string): Promise<BNARecommendation> {
    // Step 1: Build candidate pool
    const candidates = await this.buildCandidatePool(userId, context);

    // Step 2: Apply hard constraints
    const validCandidates = await this.applyHardConstraints(candidates, userId);

    // Early exit: no valid actions
    if (validCandidates.length === 0) {
      return this.buildSupportiveGuidance(userId);
    }

    // Step 3: Apply cadence alignment (filter-first)
    const finalCandidates = await this.applyCadenceAlignment(
      validCandidates,
      userId,
    );

    // Step 4: Resolve using tie-breaking
    return this.resolveTieBreaker(finalCandidates, userId);
  }

  /**
   * Step 1: Build candidate action pool
   *
   * Gathers all potentially valid actions from multiple sources:
   * - UserDailyPlan required_actions (mapped to ActionTypes)
   * - System blockers (license, E&O, activation)
   * - OPS actions (contacts in FOLLOW_UP stage)
   *
   * @param userId - User ID
   * @param context - UI context (metadata only)
   * @returns Array of candidate actions
   */
  private async buildCandidatePool(
    userId: string,
    context?: string,
  ): Promise<CandidateAction[]> {
    const candidates: CandidateAction[] = [];
    let sequenceIndex = 0;

    // 1A. Get UserDailyPlan required_actions and map to ActionTypes
    const dailyPlan = await this.dailyPlanResolver.resolveDailyPlan(userId);

    for (const actionKey of dailyPlan.required_actions) {
      const actionType = ACTION_KEY_TO_TYPE[actionKey];

      // Skip if action key doesn't map to a BNA action type
      if (!actionType) continue;

      // Get metadata for this action type
      const metadata = ACTION_METADATA[actionType];

      candidates.push({
        type: actionType,
        category: metadata.category,
        priority_band: metadata.priority_band,
        unblock_score: metadata.unblock_score,
        target_id: null,
        sequence_index: sequenceIndex++,
      });
    }

    // 1B. System blockers are already included in UserDailyPlan required_actions
    // (e.g., license_uploaded, e&o_uploaded, activation_unlocked)
    // No additional blocker logic needed

    // 1C. Query contacts in FOLLOW_UP stage for OPS actions
    const followUpContacts = await this.contactRepository.find({
      where: {
        userId,
        pipelineStage: PipelineStage.FOLLOW_UP,
      },
      order: {
        lastActivityAt: 'ASC', // Oldest activity first (needs follow-up most)
      },
      take: 10, // Limit to prevent too many OPS candidates
    });

    for (const contact of followUpContacts) {
      const metadata = ACTION_METADATA[ActionType.FOLLOW_UP_CONTACT];

      candidates.push({
        type: ActionType.FOLLOW_UP_CONTACT,
        category: metadata.category,
        priority_band: metadata.priority_band,
        unblock_score: metadata.unblock_score,
        target_id: contact.id,
        sequence_index: sequenceIndex++,
      });
    }

    return candidates;
  }

  /**
   * Step 2: Apply hard constraints
   *
   * Filters candidates by removing impossible or invalid actions:
   * - Already completed (check UserDailyPlan completed_actions)
   * - State mismatch (e.g., can't follow up if no contacts)
   * - Prerequisites not met (e.g., E&O requires license upload)
   * - Access rules (e.g., OPS requires onboarded status)
   *
   * @param candidates - Candidate actions from Step 1
   * @param userId - User ID
   * @returns Filtered array of valid candidates
   */
  private async applyHardConstraints(
    candidates: CandidateAction[],
    userId: string,
  ): Promise<CandidateAction[]> {
    // Get user and daily plan for constraint checking
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return []; // User not found, no valid actions
    }

    const dailyPlan = await this.dailyPlanResolver.resolveDailyPlan(userId);

    return candidates.filter((candidate) => {
      // 2A. Remove already completed actions
      // Note: UserDailyPlan already filters completed actions from required_actions,
      // but OPS actions might need explicit checking
      const actionKey = this.getActionKeyForType(candidate.type);
      if (actionKey && dailyPlan.completed_actions.includes(actionKey)) {
        return false; // Already completed
      }

      // 2B. Remove actions with state mismatch
      // Example: Can't follow up contact if contact doesn't exist (already filtered in Step 1)
      // Example: Can't unlock activation if already activated
      if (candidate.type === ActionType.UNLOCK_ACTIVATION) {
        if (user.onboardingStatus === 'onboarded') {
          return false; // Already activated
        }
      }

      // 2C. Prerequisites are already handled by UserDailyPlan
      // UserDailyPlan only includes actions whose prerequisites are met
      // So candidates from required_actions are already pre-filtered

      // 2D. Remove actions blocked by compliance/access rules
      // OPS actions require onboarded status
      if (candidate.category === 'OPS') {
        if (user.onboardingStatus !== 'onboarded') {
          return false; // Not onboarded yet, can't do OPS
        }
      }

      return true; // Passed all constraints
    });
  }

  /**
   * Helper: Get ActionKey for an ActionType (reverse mapping)
   *
   * @param actionType - ActionType to look up
   * @returns Corresponding ActionKey or null
   */
  private getActionKeyForType(actionType: ActionType): ActionKey | null {
    // SUPPORTIVE_GUIDANCE has no ActionKey
    if (actionType === ActionType.SUPPORTIVE_GUIDANCE) {
      return null;
    }

    // Safe to index now since we excluded SUPPORTIVE_GUIDANCE
    return ACTION_TYPE_TO_KEY[actionType] ?? null;
  }

  /**
   * Step 3: Apply cadence alignment (filter-first strategy)
   *
   * Phase 1 logic: Structural bias only (categories, not action types)
   * - Blockers: Always cadence-aligned
   * - Early days (1-3): Prefer REQUIRED_ACTION over OPS
   * - Mid/late days (4-10): Allow all categories
   *
   * Filter-first: Try cadence-aligned subset, fallback to full list if empty.
   * This ensures progress is never blocked by timing.
   *
   * @param candidates - Valid candidates from Step 2
   * @param userId - User ID
   * @returns Filtered array (cadence-aligned if possible, else original)
   */
  private async applyCadenceAlignment(
    candidates: CandidateAction[],
    userId: string,
  ): Promise<CandidateAction[]> {
    // 3A. Get current cadence day number (1-10) from AWS SSM
    // This is a global value for all users (day_01, day_02, etc.)
    const cadenceDayNumber = await this.ssmService.getCadenceDay();

    // 3B. Filter cadence-aligned candidates using structural bias
    const alignedCandidates = candidates.filter((candidate) =>
      this.isCadenceAligned(candidate, cadenceDayNumber),
    );

    // 3C. Apply filter-first strategy
    // Prefer cadence-aligned subset, but fallback to full list if empty
    // This ensures progress is never blocked by timing
    return alignedCandidates.length > 0 ? alignedCandidates : candidates;
  }

  /**
   * Helper: Check if an action is cadence-aligned
   *
   * Phase 1 structural bias logic (categories only, not action types):
   * - Blockers: Always aligned (critical path)
   * - Early days (1-3): Only REQUIRED category aligned (focus on onboarding)
   * - Mid/late days (4-10): All categories aligned (full engagement)
   *
   * @param action - Candidate action to check
   * @param dayNumber - Current cadence day number (1-10)
   * @returns True if action is cadence-aligned
   */
  private isCadenceAligned(
    action: CandidateAction,
    dayNumber: number,
  ): boolean {
    // Blockers are always cadence-aligned (highest priority)
    if (action.category === ActionCategory.BLOCKER) {
      return true;
    }

    // Early days (1-3): Only REQUIRED actions are aligned
    // Focus user on core onboarding tasks before OPS work
    if (dayNumber <= 3) {
      return action.category === ActionCategory.REQUIRED;
    }

    // Mid/late days (4-10): All categories are aligned
    // User is ready for full engagement including OPS
    return true;
  }

  /**
   * Step 4: Resolve using strict precedence (tie-breaking)
   *
   * Applies deterministic ordering to select exactly ONE action:
   * 1. Category precedence (BLOCKER > REQUIRED > OPS)
   * 2. Priority band (HIGH > MED > LOW)
   * 3. Unblock score (higher wins)
   * 4. Sequence index (stable sort, oldest first)
   *
   * Converts winning CandidateAction to ActionableRecommendation.
   *
   * @param candidates - Final candidates from Step 3
   * @param userId - User ID
   * @returns Actionable recommendation
   */
  private async resolveTieBreaker(
    candidates: CandidateAction[],
    userId: string,
  ): Promise<BNARecommendation> {
    // Get current cadence day to determine if winner is cadence-aligned
    const cadenceDayNumber = await this.ssmService.getCadenceDay();

    // 4.1. Filter by category (keep highest precedence)
    const categoryPrecedence = [
      ActionCategory.BLOCKER,
      ActionCategory.REQUIRED,
      ActionCategory.OPS,
    ];
    const highestCategory = categoryPrecedence.find((category) =>
      candidates.some((c) => c.category === category),
    )!;
    let remaining = candidates.filter((c) => c.category === highestCategory);

    // 4.2. Filter by priority band (keep highest)
    const priorityPrecedence = ['HIGH', 'MED', 'LOW'];
    const highestPriority = priorityPrecedence.find((priority) =>
      remaining.some((c) => c.priority_band === priority),
    )!;
    remaining = remaining.filter((c) => c.priority_band === highestPriority);

    // 4.3. Filter by unblock score (keep highest)
    const maxUnblockScore = Math.max(...remaining.map((c) => c.unblock_score));
    remaining = remaining.filter((c) => c.unblock_score === maxUnblockScore);

    // 4.4. Sort by sequence index (oldest first) and select first
    remaining.sort((a, b) => (a.sequence_index ?? 0) - (b.sequence_index ?? 0));
    const winner = remaining[0];

    // 4.5. Build ActionableRecommendation from winner
    const metadata = ACTION_METADATA[winner.type];
    const isAligned = this.isCadenceAligned(winner, cadenceDayNumber);

    // Determine reason_code based on category and cadence alignment
    let reasonCode: 'BLOCKER' | 'REQUIRED' | 'CADENCE_ALIGNED' | 'OPS';
    if (winner.category === ActionCategory.BLOCKER) {
      reasonCode = 'BLOCKER';
    } else if (winner.category === ActionCategory.REQUIRED) {
      reasonCode = 'REQUIRED';
    } else if (isAligned) {
      reasonCode = 'CADENCE_ALIGNED';
    } else {
      reasonCode = 'OPS';
    }

    // Generate explanation based on decision factors
    const explanation = this.buildExplanation(
      winner,
      reasonCode,
      cadenceDayNumber,
    );

    return {
      action_type: winner.type,
      target_id: winner.target_id ?? null,
      reason_code: reasonCode,
      cta: metadata.cta_template,
      context: {
        category: winner.category,
        priority_band: winner.priority_band,
        unblock_score: winner.unblock_score,
        cadence_aligned: isAligned,
        explanation,
      },
    };
  }

  /**
   * Helper: Build explanation for why this action was chosen
   *
   * Provides transparency into the decision-making process.
   *
   * @param action - Winning action
   * @param reasonCode - Reason code for the recommendation
   * @param dayNumber - Current cadence day
   * @returns Human-readable explanation
   */
  private buildExplanation(
    action: CandidateAction,
    reasonCode: string,
    dayNumber: number,
  ): string {
    switch (reasonCode) {
      case 'BLOCKER':
        return `This action is blocking your progress and must be completed first.`;

      case 'REQUIRED':
        return `This action is required to complete your onboarding.`;

      case 'CADENCE_ALIGNED':
        return `This action aligns with today's focus (Day ${dayNumber} of the cadence).`;

      case 'OPS':
        return `This operational task is ready for your attention.`;

      default:
        return `This action is recommended for you.`;
    }
  }

  /**
   * Build supportive guidance
   *
   * Called when no actionable candidates remain.
   * Determines appropriate guidance reason code:
   * - WAITING_ON_APPROVAL (pending external review)
   * - NO_ACTIONS_AVAILABLE (all caught up)
   * - SYSTEM_LIMIT (access restricted)
   *
   * @param userId - User ID
   * @returns Supportive guidance recommendation
   */
  private async buildSupportiveGuidance(
    userId: string,
  ): Promise<BNARecommendation> {
    // Get user to determine guidance reason
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      // User not found - should never happen, but handle gracefully
      return {
        action_type: ActionType.SUPPORTIVE_GUIDANCE,
        reason_code: GuidanceReasonCode.SYSTEM_LIMIT,
        message: 'Unable to load your profile. Please contact support.',
        context: {
          user_state: 'unknown',
          last_action_completed: null,
          blocking_reason: 'User not found',
        },
      };
    }

    // Get daily plan to check last completed action
    const dailyPlan = await this.dailyPlanResolver.resolveDailyPlan(userId);
    const lastActionCompleted =
      dailyPlan.completed_actions.length > 0
        ? dailyPlan.completed_actions[dailyPlan.completed_actions.length - 1]
        : null;

    // Determine reason code and message based on user state
    let reasonCode: GuidanceReasonCode;
    let message: string;
    let blockingReason: string | null = null;

    // Check for PENDING_ACTIVATION status (waiting on admin approval)
    if (user.onboardingStatus === 'pending_activation') {
      reasonCode = GuidanceReasonCode.WAITING_ON_APPROVAL;
      message =
        'Your application is under review. We will notify you once approved.';
      blockingReason = 'Activation pending admin approval';
    }
    // Check for ONBOARDED status with no actions (journey complete)
    else if (user.onboardingStatus === 'onboarded') {
      reasonCode = GuidanceReasonCode.NO_ACTIONS_AVAILABLE;
      message = "You're all caught up! No pending actions at this time.";
      blockingReason = null;
    }
    // Default: No actions available (all current tasks completed)
    else {
      reasonCode = GuidanceReasonCode.NO_ACTIONS_AVAILABLE;
      message =
        "Great progress! You've completed all available actions for now.";
      blockingReason = null;
    }

    return {
      action_type: ActionType.SUPPORTIVE_GUIDANCE,
      reason_code: reasonCode,
      message,
      context: {
        user_state: user.onboardingStatus ?? 'unknown',
        last_action_completed: lastActionCompleted,
        blocking_reason: blockingReason,
      },
    };
  }
}
