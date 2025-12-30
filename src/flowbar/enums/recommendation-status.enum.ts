/**
 * Recommendation status tracking
 *
 * Tracks the lifecycle of an action recommendation from presentation to completion
 */
export enum RecommendationStatus {
  /** Shown to user */
  PRESENTED = 'PRESENTED',

  /** User clicked/acknowledged */
  ACCEPTED = 'ACCEPTED',

  /** User explicitly dismissed */
  DISMISSED = 'DISMISSED',

  /** User completed the action */
  COMPLETED = 'COMPLETED',
}