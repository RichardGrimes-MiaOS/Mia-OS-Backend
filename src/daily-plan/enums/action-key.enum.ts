/**
 * Action keys represent discrete user actions across the onboarding and activation journey
 * These are the building blocks for required_actions and completed_actions
 *
 * Phase 1: Static lookup (no AI generation, no dynamic weighting)
 */
export enum ActionKey {
  // Universal (all roles)
  ACCOUNT_CREATED = 'account_created',

  // Agent (unlicensed) journey
  LICENSED_CHECK = 'licensed_check',
  EXAM_SCHEDULED = 'exam_scheduled',
  LICENSE_UPLOADED = 'license_uploaded',

  // Agent (licensed) journey
  LICENSED_AGENT_INTAKE = 'licensed_agent_intake',

  // Common for all agents (licensed and unlicensed)
  EO_UPLOADED = 'e&o_uploaded',
  ACTIVATION_UNLOCKED = 'activation_unlocked',

  // Affiliate only journey
  AFFILIATE_PROFILE_SUBMITTED = 'affiliate_profile_submitted',
  REFERRAL_LINK_GENERATED = 'referral_link_generated',
  FIRST_SHARE = 'first_share',
}