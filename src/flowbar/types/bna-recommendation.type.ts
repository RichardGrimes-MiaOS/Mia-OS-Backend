import { ActionType } from '../enums/action-type.enum';
import { ActionCategory } from '../enums/action-category.enum';
import { PriorityBand } from '../enums/priority-band.enum';
import { GuidanceReasonCode } from '../enums/guidance-reason-code.enum';
import { ActionKey } from '../../daily-plan/enums/action-key.enum';

/**
 * Union type for BNA recommendations
 * Either an actionable task or supportive guidance
 */
export type BNARecommendation = ActionableRecommendation | SupportiveGuidance;

/**
 * Actionable task recommendation
 */
export interface ActionableRecommendation {
  action_type: Exclude<ActionType, ActionType.SUPPORTIVE_GUIDANCE>;
  target_id: string | null;
  reason_code: 'BLOCKER' | 'REQUIRED' | 'CADENCE_ALIGNED' | 'OPS';
  cta: string;
  context: {
    category: ActionCategory;
    priority_band: PriorityBand;
    unblock_score: number;
    cadence_aligned: boolean;
    explanation: string;
  };
}

/**
 * Supportive guidance (no action required)
 */
export interface SupportiveGuidance {
  action_type: ActionType.SUPPORTIVE_GUIDANCE;
  reason_code: GuidanceReasonCode;
  message: string;
  context: {
    user_state: string;
    last_action_completed: ActionKey | null;
    blocking_reason: string | null;
  };
}