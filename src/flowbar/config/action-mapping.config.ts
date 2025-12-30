import { ActionKey } from '../../daily-plan/enums/action-key.enum';
import { ActionType } from '../enums/action-type.enum';

/**
 * Mapping between UserDailyPlan ActionKeys and BNA ActionTypes
 *
 * - ActionKey represents discrete user actions in the daily plan system
 * - ActionType represents recommendable actions in the BNA system
 * - Some ActionKeys don't map to BNA actions (auto-complete or system checks)
 */

/**
 * Maps ActionKey to ActionType
 * Returns null for actions that are not BNA-recommendable
 */
export const ACTION_KEY_TO_TYPE: Record<
  ActionKey,
  Exclude<ActionType, ActionType.SUPPORTIVE_GUIDANCE> | null
> = {
  // Not BNA actions (auto-complete or system checks)
  [ActionKey.ACCOUNT_CREATED]: null,
  [ActionKey.LICENSED_CHECK]: null,

  // Onboarding actions
  [ActionKey.EXAM_SCHEDULED]: ActionType.SCHEDULE_EXAM,
  [ActionKey.LICENSE_UPLOADED]: ActionType.UPLOAD_LICENSE,
  [ActionKey.LICENSED_AGENT_INTAKE]: ActionType.COMPLETE_LICENSED_INTAKE,
  [ActionKey.EO_UPLOADED]: ActionType.UPLOAD_EO,
  [ActionKey.ACTIVATION_UNLOCKED]: ActionType.UNLOCK_ACTIVATION,

  // Affiliate actions
  [ActionKey.AFFILIATE_PROFILE_SUBMITTED]: ActionType.SUBMIT_AFFILIATE_PROFILE,
  [ActionKey.REFERRAL_LINK_GENERATED]: ActionType.GENERATE_REFERRAL_LINK,
  [ActionKey.FIRST_SHARE]: ActionType.SHARE_REFERRAL_LINK,
};

/**
 * Reverse mapping: ActionType to ActionKey
 * Used for checking if actions are completed
 */
export const ACTION_TYPE_TO_KEY: Partial<
  Record<
    Exclude<ActionType, ActionType.SUPPORTIVE_GUIDANCE>,
    ActionKey
  >
> = {
  [ActionType.SCHEDULE_EXAM]: ActionKey.EXAM_SCHEDULED,
  [ActionType.UPLOAD_LICENSE]: ActionKey.LICENSE_UPLOADED,
  [ActionType.COMPLETE_LICENSED_INTAKE]: ActionKey.LICENSED_AGENT_INTAKE,
  [ActionType.UPLOAD_EO]: ActionKey.EO_UPLOADED,
  [ActionType.UNLOCK_ACTIVATION]: ActionKey.ACTIVATION_UNLOCKED,
  [ActionType.SUBMIT_AFFILIATE_PROFILE]: ActionKey.AFFILIATE_PROFILE_SUBMITTED,
  [ActionType.GENERATE_REFERRAL_LINK]: ActionKey.REFERRAL_LINK_GENERATED,
  [ActionType.SHARE_REFERRAL_LINK]: ActionKey.FIRST_SHARE,
  // Note: UPLOAD_CONTRACT, FOLLOW_UP_CONTACT, COMPLETE_PROFILE have no ActionKey mapping
};