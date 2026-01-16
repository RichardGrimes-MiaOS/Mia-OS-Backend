import { UserRole } from '../../users/entities/user.entity';
import { ActionKey } from '../enums/action-key.enum';

/**
 * Role Baseline Configuration
 *
 * Phase 1: Static lookup table (no AI, no generation)
 * Each role has a predefined minimal action set
 *
 * This is the "baseline" before applying state filters (isLicensed, onboardingStatus, etc.)
 */

export interface RoleBaseline {
  role: UserRole;
  baselineActions: ActionKey[];
}

/**
 * Agent (unlicensed) baseline journey:
 * apply → onboard → license training → license exam → E&O → activate
 */
const AGENT_UNLICENSED_BASELINE: ActionKey[] = [
  ActionKey.ACCOUNT_CREATED,
  ActionKey.LICENSED_CHECK,
  ActionKey.EXAM_SCHEDULED,
  ActionKey.LICENSE_UPLOADED,
  ActionKey.EO_UPLOADED,
  ActionKey.ACTIVATION_UNLOCKED,
];

/**
 * Agent (licensed) baseline journey:
 * apply → onboard → licensed intake → E&O → activate
 */
const AGENT_LICENSED_BASELINE: ActionKey[] = [
  ActionKey.ACCOUNT_CREATED,
  ActionKey.LICENSED_CHECK,
  ActionKey.LICENSED_AGENT_INTAKE,
  ActionKey.EO_UPLOADED,
  ActionKey.ACTIVATION_UNLOCKED,
];

/**
 * Affiliate only baseline journey:
 * apply → profile → referral_link → first_share
 */
const AFFILIATE_ONLY_BASELINE: ActionKey[] = [
  ActionKey.ACCOUNT_CREATED,
  ActionKey.AFFILIATE_PROFILE_SUBMITTED,
  ActionKey.REFERRAL_LINK_GENERATED,
  ActionKey.FIRST_SHARE,
];

/**
 * Get baseline actions for a given role and license status
 *
 * @param role - User role (agent, affiliate_only, etc.)
 * @param isLicensed - Whether user is already licensed (only relevant for agents)
 * @returns Array of baseline action keys for this role
 */
export function getRoleBaseline(
  role: UserRole,
  isLicensed: boolean,
): ActionKey[] {
  switch (role) {
    case UserRole.AGENT:
    case UserRole.APPLICANT:
      return isLicensed ? AGENT_LICENSED_BASELINE : AGENT_UNLICENSED_BASELINE;

    case UserRole.AFFILIATE_ONLY:
      return AFFILIATE_ONLY_BASELINE;

    case UserRole.APPLICANT:
      // Applicants haven't been assigned a journey yet
      // Only track account creation
      return [ActionKey.ACCOUNT_CREATED];

    case UserRole.AFFILIATE:
      // Affiliate (agent who also refers) follows agent baseline
      return isLicensed ? AGENT_LICENSED_BASELINE : AGENT_UNLICENSED_BASELINE;

    case UserRole.ADMIN:
    case UserRole.SUPER_ADMIN:
      // Admins don't have onboarding actions
      return [];

    default:
      return [];
  }
}

/**
 * Prerequisite ordering rules
 * Maps each action to its prerequisite (what must be completed before it unlocks)
 *
 * Phase 1: Simple linear prerequisites only
 */
export const ACTION_PREREQUISITES: Record<ActionKey, ActionKey | null> = {
  [ActionKey.ACCOUNT_CREATED]: null, // No prerequisite (entry point)

  // Agent (unlicensed) flow
  [ActionKey.LICENSED_CHECK]: ActionKey.ACCOUNT_CREATED,
  [ActionKey.EXAM_SCHEDULED]: ActionKey.LICENSED_CHECK,
  [ActionKey.LICENSE_UPLOADED]: ActionKey.EXAM_SCHEDULED,

  // Agent (licensed) flow
  [ActionKey.LICENSED_AGENT_INTAKE]: ActionKey.LICENSED_CHECK,

  // Common for all agents
  [ActionKey.EO_UPLOADED]: ActionKey.LICENSE_UPLOADED, // or LICENSED_AGENT_INTAKE (handled in resolver)
  [ActionKey.ACTIVATION_UNLOCKED]: ActionKey.EO_UPLOADED,

  // Affiliate only flow
  [ActionKey.AFFILIATE_PROFILE_SUBMITTED]: ActionKey.ACCOUNT_CREATED,
  [ActionKey.REFERRAL_LINK_GENERATED]: ActionKey.AFFILIATE_PROFILE_SUBMITTED,
  [ActionKey.FIRST_SHARE]: ActionKey.REFERRAL_LINK_GENERATED,
};
