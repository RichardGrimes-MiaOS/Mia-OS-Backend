import { ActionCategory } from '../enums/action-category.enum';
import { PriorityBand } from '../enums/priority-band.enum';

/**
 * Static metadata for each action type
 *
 * Defines category, priority, unblock score, and UI text for each action.
 * Used by the resolver to build candidate actions and generate responses.
 */
export interface ActionMetadata {
  /** Action category for precedence ordering */
  category: ActionCategory;

  /** Priority band for tie-breaking */
  priority_band: PriorityBand;

  /** Unblock score (0-5) representing how many future actions this unlocks */
  unblock_score: number;

  /** UI call-to-action text template (may include {placeholders}) */
  cta_template: string;
}