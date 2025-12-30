import { ActionType } from '../enums/action-type.enum';
import { ActionCategory } from '../enums/action-category.enum';
import { PriorityBand } from '../enums/priority-band.enum';
import { ActionMetadata } from '../types/action-metadata.interface';

/**
 * Action metadata configuration
 *
 * Defines category, priority, unblock score, and CTA for each action type.
 * Phase 1 uses static assignments; Phase 2 will compute dynamically.
 */
export const ACTION_METADATA: Record<
  Exclude<ActionType, ActionType.SUPPORTIVE_GUIDANCE>,
  ActionMetadata
> = {
  // ===== DOCUMENT UPLOADS =====
  [ActionType.UPLOAD_LICENSE]: {
    category: ActionCategory.BLOCKER,
    priority_band: PriorityBand.HIGH,
    unblock_score: 2, // Unlocks E&O + contracts
    cta_template: 'Upload your insurance license',
  },

  [ActionType.UPLOAD_EO]: {
    category: ActionCategory.BLOCKER,
    priority_band: PriorityBand.HIGH,
    unblock_score: 3, // Unlocks activation + system access
    cta_template: 'Upload your E&O insurance',
  },

  [ActionType.UPLOAD_CONTRACT]: {
    category: ActionCategory.BLOCKER,
    priority_band: PriorityBand.HIGH,
    unblock_score: 1, // Unlocks contract-gated features
    cta_template: 'Upload your signed contract',
  },

  // ===== ONBOARDING TASKS =====
  [ActionType.COMPLETE_LICENSED_INTAKE]: {
    category: ActionCategory.REQUIRED,
    priority_band: PriorityBand.HIGH,
    unblock_score: 2, // Unlocks E&O for licensed agents
    cta_template: 'Complete your licensed agent intake form',
  },

  [ActionType.SCHEDULE_EXAM]: {
    category: ActionCategory.REQUIRED,
    priority_band: PriorityBand.MED,
    unblock_score: 1, // Unlocks license upload step
    cta_template: 'Schedule your licensing exam',
  },

  [ActionType.COMPLETE_PROFILE]: {
    category: ActionCategory.REQUIRED,
    priority_band: PriorityBand.LOW,
    unblock_score: 1, // Minor unlock (better experience)
    cta_template: 'Complete your profile',
  },

  // ===== AFFILIATE TASKS =====
  [ActionType.SUBMIT_AFFILIATE_PROFILE]: {
    category: ActionCategory.REQUIRED,
    priority_band: PriorityBand.HIGH,
    unblock_score: 1, // Unlocks referral link generation
    cta_template: 'Submit your affiliate profile',
  },

  [ActionType.GENERATE_REFERRAL_LINK]: {
    category: ActionCategory.REQUIRED,
    priority_band: PriorityBand.MED,
    unblock_score: 2, // Unlocks sharing + tracking
    cta_template: 'Generate your referral link',
  },

  [ActionType.SHARE_REFERRAL_LINK]: {
    category: ActionCategory.REQUIRED,
    priority_band: PriorityBand.LOW,
    unblock_score: 0, // Doesn't unlock anything (optional)
    cta_template: 'Share your referral link',
  },

  // ===== OPERATIONAL TASKS =====
  [ActionType.FOLLOW_UP_CONTACT]: {
    category: ActionCategory.OPS,
    priority_band: PriorityBand.MED,
    unblock_score: 0, // Operational, no unblocking
    cta_template: 'Follow up with {contact_name}',
  },

  // ===== SYSTEM TASKS =====
  [ActionType.UNLOCK_ACTIVATION]: {
    category: ActionCategory.REQUIRED,
    priority_band: PriorityBand.HIGH,
    unblock_score: 5, // Unlocks full platform capabilities
    cta_template: 'Complete activation to unlock full access',
  },
};