/**
 * Action types that can be recommended by the Best Next Action system
 *
 * These represent all possible actions the system can suggest to users,
 * organized by functional category.
 */
export enum ActionType {
  // Document uploads
  UPLOAD_LICENSE = 'upload_license',
  UPLOAD_EO = 'upload_e&o',
  UPLOAD_CONTRACT = 'upload_contract',

  // Onboarding tasks
  COMPLETE_LICENSED_INTAKE = 'complete_licensed_intake',
  SCHEDULE_EXAM = 'schedule_exam',
  COMPLETE_PROFILE = 'complete_profile',

  // Affiliate tasks
  SUBMIT_AFFILIATE_PROFILE = 'submit_affiliate_profile',
  GENERATE_REFERRAL_LINK = 'generate_referral_link',
  SHARE_REFERRAL_LINK = 'share_referral_link',

  // Operational tasks
  FOLLOW_UP_CONTACT = 'follow_up_contact',

  // System tasks
  UNLOCK_ACTIVATION = 'unlock_activation',

  // Supportive (no action required)
  SUPPORTIVE_GUIDANCE = 'supportive_guidance',
}