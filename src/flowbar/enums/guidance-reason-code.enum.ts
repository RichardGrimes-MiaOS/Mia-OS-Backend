/**
 * Reason codes for supportive guidance (Phase 1)
 *
 * Used when the system returns guidance instead of an actionable recommendation.
 * Note: PAUSE_RECOMMENDED is deferred to Phase 2
 */
export enum GuidanceReasonCode {
  /** External approval pending (license review, etc.) */
  WAITING_ON_APPROVAL = 'WAITING_ON_APPROVAL',

  /** Journey complete, no pending tasks */
  NO_ACTIONS_AVAILABLE = 'NO_ACTIONS_AVAILABLE',

  /** Access restricted by compliance/state */
  SYSTEM_LIMIT = 'SYSTEM_LIMIT',
}