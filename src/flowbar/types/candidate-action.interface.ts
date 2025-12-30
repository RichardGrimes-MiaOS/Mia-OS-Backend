import { ActionType } from '../enums/action-type.enum';
import { ActionCategory } from '../enums/action-category.enum';
import { PriorityBand } from '../enums/priority-band.enum';

/**
 * Candidate action during resolution process
 *
 * Represents a potential action before final selection.
 * Used internally in the 4-step resolver algorithm.
 */
export interface CandidateAction {
  /** Action type */
  type: Exclude<ActionType, ActionType.SUPPORTIVE_GUIDANCE>;

  /** Action category for tie-breaking */
  category: ActionCategory;

  /** Priority band for tie-breaking */
  priority_band: PriorityBand;

  /** Unblock score (0-5) for tie-breaking */
  unblock_score: number;

  /** Optional target ID (e.g., contact ID for FOLLOW_UP_CONTACT) */
  target_id?: string | null;

  /** Sequence index for final stable sort tie-breaking */
  sequence_index?: number;
}