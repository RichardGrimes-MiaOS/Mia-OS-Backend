/**
 * Action categories for precedence ordering in tie-breaking
 *
 * Order of precedence (highest to lowest):
 * 1. BLOCKER - Prevents all progress (license, E&O, compliance)
 * 2. REQUIRED - Required for journey completion
 * 3. OPS - Operational/ongoing tasks (follow-ups, etc.)
 */
export enum ActionCategory {
  BLOCKER = 'BLOCKER',
  REQUIRED = 'REQUIRED',
  OPS = 'OPS',
}