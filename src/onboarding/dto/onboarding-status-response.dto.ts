import { OnboardingStatus, UserRole } from '../../users/entities/user.entity';

/**
 * Onboarding Status Response DTO
 *
 * Comprehensive onboarding status information for MCP server tools.
 * Provides rich context for AI agents to understand user's progress.
 */
export class OnboardingStatusResponseDto {
  // Core status
  onboardingStatus: OnboardingStatus;
  userRole: UserRole;

  // Progress summary
  completedSteps: string[];
  pendingSteps: string[];

  // Detailed state
  details: {
    licensingTraining?: {
      completed: boolean;
      isRegistered?: boolean;
      completedAt?: Date;
    };
    licensingExam?: {
      completed: boolean;
      passed?: boolean;
      attempts?: number;
      passedAt?: Date;
    };
    eoInsurance?: {
      completed: boolean;
      count?: number;
      latestUploadedAt?: Date;
      latestExpiresAt?: Date;
    };
    licenses?: {
      count: number;
      states?: string[];
    };
    licensedIntake?: {
      completed: boolean;
      submittedAt?: Date;
    };
    affiliate?: {
      completed: boolean;
      hasProfile?: boolean;
      hasReferralLink?: boolean;
    };
    activation?: {
      pending: boolean;
      requestedAt?: Date | null;
      status?: string;
    };
  };
}