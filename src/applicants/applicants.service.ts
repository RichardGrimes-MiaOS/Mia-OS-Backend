import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Applicant, ApplicantStatus } from './entities/applicant.entity';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { UpdateApplicantStatusDto } from './dto/update-applicant-status.dto';
import { EmailService } from '../email/email.service';
import { AuthService } from '../auth/auth.service';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { AffiliateProfile } from '../affiliates/entities/affiliate-profile.entity';
import { AffiliateEvents } from '../affiliates/entities/affiliate-events.entity';
import { AffiliateUserPerformance } from '../affiliates/entities/affiliate-user-performance.entity';
import { ActivationService } from '../activation/activation.service';
import { ActivationActionType } from '../users/enums/activation-action-type.enum';
import { OnboardingStepsService } from '../onboarding/services/onboarding-steps.service';
import { OnboardingStepKey } from '../onboarding/entities/user-onboarding-step.entity';
import { UsersService } from '../users/users.service';
import { TransactionService } from '../common/services/transaction.service';
import { CognitoService } from '../cognito/cognito.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventType } from '../analytics/entities/user-event.entity';

@Injectable()
export class ApplicantsService {
  constructor(
    @InjectRepository(Applicant)
    private readonly applicantRepository: Repository<Applicant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AffiliateProfile)
    private readonly affiliateProfileRepository: Repository<AffiliateProfile>,
    @InjectRepository(AffiliateEvents)
    private readonly affiliateEventsRepository: Repository<AffiliateEvents>,
    @InjectRepository(AffiliateUserPerformance)
    private readonly affiliateUserPerformanceRepository: Repository<AffiliateUserPerformance>,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly activationService: ActivationService,
    private readonly onboardingStepsService: OnboardingStepsService,
    private readonly usersService: UsersService,
    private readonly transactionService: TransactionService,
    private readonly cognitoService: CognitoService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async create(createApplicantDto: CreateApplicantDto): Promise<Applicant> {
    try {
      // Check if applicant with email already exists
      const existingApplicant = await this.applicantRepository.findOne({
        where: { email: createApplicantDto.email },
      });

      if (existingApplicant) {
        throw new ConflictException(
          `An application with email ${createApplicantDto.email} already exists`,
        );
      }

      // Check if user with email already exists
      const existingUser = await this.usersService.findByEmail(
        createApplicantDto.email,
      );

      if (existingUser) {
        throw new ConflictException(
          `A user with email ${createApplicantDto.email} already exists`,
        );
      }

      const applicant = this.applicantRepository.create({
        ...createApplicantDto,
        status: ApplicantStatus.PENDING,
      });

      const savedApplicant = await this.applicantRepository.save(applicant);

      // Track affiliate signup if referral code provided (for AffiliateProfile)
      if (createApplicantDto.referral_code) {
        await this.trackAffiliateSignup(createApplicantDto.referral_code);
      }

      // Track affiliate user signup if referral link provided (for affiliate_only users)
      if (createApplicantDto.referral_link) {
        await this.trackAffiliateUserSignup(createApplicantDto.referral_link);
      }

      // Send confirmation email asynchronously (don't wait for it)
      this.emailService
        .sendApplicationReceivedEmail({
          email: savedApplicant.email,
          firstName: savedApplicant.firstName,
          lastName: savedApplicant.lastName,
          organization: savedApplicant.organization,
          primaryState: savedApplicant.primaryState,
          submittedDate: savedApplicant.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        })
        .catch((error) => {
          // Log email error but don't fail the request
          console.error('Failed to send application received email:', error);
        });

      return savedApplicant;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to create applicant');
    }
  }

  async findAll(): Promise<Applicant[]> {
    return await this.applicantRepository.find({
      relations: ['updatedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<any> {
    const applicant = await this.applicantRepository.findOne({
      where: { id },
      relations: ['updatedBy', 'user'],
    });

    if (!applicant) {
      throw new NotFoundException(`Applicant with ID ${id} not found`);
    }

    // If applicant has a linked user account, fetch their onboarding data
    if (applicant.userId) {
      const [licensingTraining, licensingExam, eAndOInsurance] =
        await Promise.all([
          this.userRepository.query(
            `SELECT * FROM licensing_training WHERE "userId" = $1`,
            [applicant.userId],
          ),
          this.userRepository.query(
            `SELECT * FROM licensing_exam WHERE "userId" = $1`,
            [applicant.userId],
          ),
          this.userRepository.query(
            `SELECT * FROM e_and_o_insurance WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
            [applicant.userId],
          ),
        ]);

      // Convert entity to plain object to preserve custom properties
      const plainApplicant = {
        id: applicant.id,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        email: applicant.email,
        phone: applicant.phone,
        organization: applicant.organization,
        primaryState: applicant.primaryState,
        purpose: applicant.purpose,
        roleIntent: applicant.roleIntent,
        status: applicant.status,
        updatedBy: applicant.updatedBy,
        updatedById: applicant.updatedById,
        user: applicant.user,
        userId: applicant.userId,
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
        onboardingData: {
          licensingTraining: licensingTraining[0] || null,
          licensingExam: licensingExam[0] || null,
          eAndOInsurance: eAndOInsurance || [],
        },
      };

      return plainApplicant;
    }

    return applicant;
  }

  async findByStatus(status: ApplicantStatus): Promise<Applicant[]> {
    return await this.applicantRepository.find({
      where: { status },
      relations: ['updatedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    updateApplicantDto: UpdateApplicantDto,
    updatedById: string,
  ): Promise<Applicant> {
    const applicant = await this.findOne(id);

    // Check if email is being updated and if it already exists
    if (
      updateApplicantDto.email &&
      updateApplicantDto.email !== applicant.email
    ) {
      const existingApplicant = await this.applicantRepository.findOne({
        where: { email: updateApplicantDto.email },
      });

      if (existingApplicant) {
        throw new ConflictException(
          `Applicant with email ${updateApplicantDto.email} already exists`,
        );
      }
    }

    Object.assign(applicant, updateApplicantDto);
    applicant.updatedById = updatedById;

    try {
      return await this.applicantRepository.save(applicant);
    } catch (error) {
      throw new BadRequestException('Failed to update applicant');
    }
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateApplicantStatusDto,
    updatedById: string,
  ): Promise<Applicant> {
    const applicant = await this.findOne(id);
    const oldStatus = applicant.status;

    // If status changed to ACCEPTED, create user account (handles status update atomically)
    if (
      oldStatus !== ApplicantStatus.ACCEPTED &&
      updateStatusDto.status === ApplicantStatus.ACCEPTED
    ) {
      // createUserFromApplicant handles everything atomically:
      // - Cognito user creation
      // - DB user creation + applicant status update + onboarding steps (in one transaction)
      // - Throws on failure so frontend can display error
      await this.createUserFromApplicant(applicant, updatedById);

      // Track affiliate conversion if applicant has referral code (for AffiliateProfile)
      if (applicant.referral_code) {
        await this.trackAffiliateConversion(applicant.referral_code);
      }

      // Track affiliate user conversion if applicant has referral link (for affiliate_only users)
      if (applicant.referral_link) {
        await this.trackAffiliateUserConversion(applicant.referral_link);
      }

      // Reload applicant with relations to return complete data
      return await this.findOne(id);
    }

    // For non-ACCEPTED status changes, just update the applicant
    applicant.status = updateStatusDto.status;
    applicant.updatedById = updatedById;

    try {
      await this.applicantRepository.save(applicant);

      // If status changed to REJECTED, send rejection email
      if (
        oldStatus !== ApplicantStatus.REJECTED &&
        updateStatusDto.status === ApplicantStatus.REJECTED
      ) {
        await this.emailService.sendApplicationRejectedEmail({
          email: applicant.email,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          notes: updateStatusDto.notes,
        });
      }

      // Reload applicant with relations to return complete data
      return await this.findOne(id);
    } catch (error) {
      throw new BadRequestException('Failed to update applicant status');
    }
  }

  /**
   * Create a user account from an approved applicant
   *
   * Uses Saga pattern for Cognito + DB coordination:
   * 1. Create Cognito user (external service, outside transaction)
   * 2. All DB operations in a single transaction (user, applicant status + link, onboarding steps)
   * 3. If DB transaction fails, delete Cognito user (compensating transaction)
   *
   * Throws on failure so frontend can display error to admin.
   *
   * @param applicant - The applicant to create user from
   * @param updatedById - The admin who approved the applicant
   */
  private async createUserFromApplicant(
    applicant: Applicant,
    updatedById: string,
  ): Promise<void> {
    // Step 1: Create Cognito user only (checks DB for existing user, creates in Cognito)
    let cognitoSub: string;
    let temporaryPassword: string;

    try {
      const cognitoResult = await this.authService.createCognitoUserOnly(
        applicant.email,
        applicant.firstName,
        applicant.lastName,
        applicant.phone,
        UserRole.APPLICANT, // Start as applicant, will be promoted to agent after onboarding
      );
      cognitoSub = cognitoResult.cognitoSub;
      temporaryPassword = cognitoResult.temporaryPassword;
    } catch (cognitoError: any) {
      // Re-throw with context so frontend can display the error
      throw new BadRequestException(
        cognitoError.message || 'Failed to create user in Cognito',
      );
    }

    // Step 2: All DB operations in a single transaction
    const approvedAt = new Date();
    let user: User;

    try {
      user = await this.transactionService.runInTransaction(async (manager) => {
        // Create user with ALL fields at once
        const newUser = manager.create(User, {
          cognitoSub,
          email: applicant.email,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          phone: applicant.phone,
          role: UserRole.APPLICANT,
          status: UserStatus.ACTIVE,
          isLicensed: applicant.isLicensed,
          approved_at: approvedAt,
          createdById: updatedById,
        });
        await manager.save(User, newUser);

        // Update applicant: status, link to user, and updatedById (all atomic)
        await manager.update(Applicant, applicant.id, {
          status: ApplicantStatus.ACCEPTED,
          userId: newUser.id,
          updatedById,
        });

        // Track signup completed event
        await this.analyticsService.trackEvent(
          {
            userId: newUser.id,
            eventType: EventType.SIGNUP_COMPLETED,
            role: newUser.role,
            affiliateId: newUser.affiliate_profile_id,
            metadata: {
              applicantId: applicant.id,
              approvedBy: updatedById,
            },
          },
          manager,
        );

        // Create onboarding step: account_created (instant step - both entered and completed)
        await this.onboardingStepsService.createCompletedStep(
          newUser.id,
          OnboardingStepKey.ACCOUNT_CREATED,
          approvedAt,
          approvedAt,
          manager,
        );

        // Create onboarding step: licensed_check (entered but not completed)
        await this.onboardingStepsService.enterStep(
          newUser.id,
          OnboardingStepKey.LICENSED_CHECK,
          approvedAt,
          manager,
        );

        return newUser;
      });

      console.log(
        `[ApplicantsService] Created user ${user.id} and linked to applicant ${applicant.id}`,
      );
    } catch (dbError: any) {
      // Compensating transaction: Delete Cognito user since DB operations failed
      console.error(
        `[ApplicantsService] DB transaction failed for applicant ${applicant.id}, rolling back Cognito user:`,
        dbError.message,
      );

      try {
        await this.cognitoService.adminDeleteUser(applicant.email);
        console.log(
          `[ApplicantsService] Compensating transaction: Deleted Cognito user ${applicant.email}`,
        );
      } catch (deleteError: any) {
        console.error(
          `[ApplicantsService] Failed to delete Cognito user ${applicant.email} during rollback:`,
          deleteError.message,
        );
      }

      // Re-throw so frontend can display the error
      throw new BadRequestException(
        `Failed to create user account: ${dbError.message}`,
      );
    }

    // Step 3: Send welcome email (outside transaction - non-critical)
    console.log(`[ApplicantsService] Sending welcome email to ${user.email}`);
    this.emailService
      .sendWelcomeEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        temporaryPassword,
        role: user.role,
      })
      .catch((error) => {
        console.error('Failed to send welcome email:', error);
      });

    console.log(
      `[ApplicantsService] Successfully completed user creation for applicant ${applicant.id}`,
    );
  }

  async remove(id: string): Promise<void> {
    const applicant = await this.findOne(id);

    try {
      await this.applicantRepository.remove(applicant);
    } catch (error) {
      throw new BadRequestException('Failed to delete applicant');
    }
  }

  async getStatistics(): Promise<{
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  }> {
    const [total, pending, accepted, rejected] = await Promise.all([
      this.applicantRepository.count(),
      this.applicantRepository.count({
        where: { status: ApplicantStatus.PENDING },
      }),
      this.applicantRepository.count({
        where: { status: ApplicantStatus.ACCEPTED },
      }),
      this.applicantRepository.count({
        where: { status: ApplicantStatus.REJECTED },
      }),
    ]);

    return {
      total,
      pending,
      accepted,
      rejected,
    };
  }

  /**
   * Track affiliate signup when applicant submits application with referral code
   */
  private async trackAffiliateSignup(referralCode: string): Promise<void> {
    try {
      // Find affiliate profile by referral code
      const profile = await this.affiliateProfileRepository.findOne({
        where: { referral_code: referralCode },
        relations: ['events'],
      });

      if (!profile) {
        console.warn(
          `[ApplicantsService] Invalid referral code: ${referralCode}`,
        );
        return;
      }

      // Get or create AffiliateEvents record
      let events: AffiliateEvents | null = profile.events;
      if (!events) {
        events = await this.affiliateEventsRepository.findOne({
          where: { affiliate_profile_id: profile.id },
        });
      }

      if (!events) {
        // Create initial events record if it doesn't exist
        events = this.affiliateEventsRepository.create({
          affiliate_profile_id: profile.id,
          total_clicks: 0,
          total_unique_visitors: 0,
          total_signups: 0,
        });
      }

      // Increment total_signups
      events.total_signups += 1;

      await this.affiliateEventsRepository.save(events);

      console.log(
        `[ApplicantsService] Tracked signup for affiliate ${profile.id} (${profile.name}). Total signups: ${events.total_signups}`,
      );
    } catch (error) {
      // Log error but don't fail the applicant creation
      console.error(
        `[ApplicantsService] Failed to track affiliate signup for referral code ${referralCode}:`,
        error,
      );
    }
  }

  /**
   * Track affiliate conversion when applicant is accepted (unlocks onboarding)
   */
  private async trackAffiliateConversion(referralCode: string): Promise<void> {
    try {
      // Find affiliate profile by referral code
      const profile = await this.affiliateProfileRepository.findOne({
        where: { referral_code: referralCode },
        relations: ['events'],
      });

      if (!profile) {
        console.warn(
          `[ApplicantsService] Invalid referral code for conversion: ${referralCode}`,
        );
        return;
      }

      // Get or create AffiliateEvents record
      let events: AffiliateEvents | null = profile.events;
      if (!events) {
        events = await this.affiliateEventsRepository.findOne({
          where: { affiliate_profile_id: profile.id },
        });
      }

      if (!events) {
        // Create initial events record if it doesn't exist
        events = this.affiliateEventsRepository.create({
          affiliate_profile_id: profile.id,
          total_clicks: 0,
          total_unique_visitors: 0,
          total_signups: 0,
          total_conversions: 0,
        });
      }

      // Increment total_conversions
      events.total_conversions += 1;

      await this.affiliateEventsRepository.save(events);

      console.log(
        `[ApplicantsService] Tracked conversion for affiliate ${profile.id} (${profile.name}). Total conversions: ${events.total_conversions}`,
      );
    } catch (error) {
      // Log error but don't fail the status update
      console.error(
        `[ApplicantsService] Failed to track affiliate conversion for referral code ${referralCode}:`,
        error,
      );
    }
  }

  /**
   * Track affiliate user signup when applicant submits application with referral link
   */
  private async trackAffiliateUserSignup(referralLink: string): Promise<void> {
    try {
      // Find affiliate user by referral link
      const user = await this.userRepository.findOne({
        where: { referral_link: referralLink },
        relations: ['performance'],
      });

      if (!user) {
        console.warn(
          `[ApplicantsService] Invalid referral link: ${referralLink}`,
        );
        return;
      }

      // Get or create AffiliateUserPerformance record
      let performance: AffiliateUserPerformance | null = user.performance;
      if (!performance) {
        performance = await this.affiliateUserPerformanceRepository.findOne({
          where: { user_id: user.id },
        });
      }

      if (!performance) {
        // Create initial performance record if it doesn't exist
        performance = this.affiliateUserPerformanceRepository.create({
          user_id: user.id,
          referrals_clicks: 0,
          referrals_made: 0,
          referrals_converted: 0,
        });
      }

      // Check if this is the first referral signup
      const isFirstSignup = performance.referrals_made === 0;

      // Increment referrals_made
      performance.referrals_made += 1;

      await this.affiliateUserPerformanceRepository.save(performance);

      // Trigger activation on first referral signup for affiliate_only users
      if (isFirstSignup) {
        await this.activationService.triggerActivation(
          user.id,
          ActivationActionType.FIRST_REFERRAL_SIGNUP,
        );
      }

      console.log(
        `[ApplicantsService] Tracked signup for affiliate user ${user.id} (${user.firstName} ${user.lastName}). Total referrals made: ${performance.referrals_made}`,
      );
    } catch (error) {
      // Log error but don't fail the applicant creation
      console.error(
        `[ApplicantsService] Failed to track affiliate user signup for referral link ${referralLink}:`,
        error,
      );
    }
  }

  /**
   * Track affiliate user conversion when applicant is accepted (unlocks onboarding)
   */
  private async trackAffiliateUserConversion(
    referralLink: string,
  ): Promise<void> {
    try {
      // Find affiliate user by referral link
      const user = await this.userRepository.findOne({
        where: { referral_link: referralLink },
        relations: ['performance'],
      });

      if (!user) {
        console.warn(
          `[ApplicantsService] Invalid referral link for conversion: ${referralLink}`,
        );
        return;
      }

      // Get or create AffiliateUserPerformance record
      let performance: AffiliateUserPerformance | null = user.performance;
      if (!performance) {
        performance = await this.affiliateUserPerformanceRepository.findOne({
          where: { user_id: user.id },
        });
      }

      if (!performance) {
        // Create initial performance record if it doesn't exist
        performance = this.affiliateUserPerformanceRepository.create({
          user_id: user.id,
          referrals_clicks: 0,
          referrals_made: 0,
          referrals_converted: 0,
        });
      }

      // Increment referrals_converted
      performance.referrals_converted += 1;

      await this.affiliateUserPerformanceRepository.save(performance);

      console.log(
        `[ApplicantsService] Tracked conversion for affiliate user ${user.id} (${user.firstName} ${user.lastName}). Total conversions: ${performance.referrals_converted}`,
      );
    } catch (error) {
      // Log error but don't fail the status update
      console.error(
        `[ApplicantsService] Failed to track affiliate user conversion for referral link ${referralLink}:`,
        error,
      );
    }
  }
}
