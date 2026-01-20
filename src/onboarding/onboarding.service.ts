import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { TransactionService } from '../common/services/transaction.service';
import { LicensingTraining } from './entities/licensing-training.entity';
import { LicensingExam, ExamResult } from './entities/licensing-exam.entity';
import { LicensingExamAttempt } from './entities/licensing-exam-attempt.entity';
import { EAndOInsurance } from './entities/e-and-o-insurance.entity';
import { ActivationRequest } from './entities/activation-request.entity';
import { LicensedAgentIntake } from './entities/licensed-agent-intake.entity';
import { License } from './entities/license.entity';
import {
  OnboardingReviewSubmission,
  OnboardingReviewStatus,
} from './entities/onboarding-review-submission.entity';
import { User, OnboardingStatus } from '../users/entities/user.entity';
import { CreateLicensingTrainingDto } from './dto/create-licensing-training.dto';
import { UpdateLicensingTrainingDto } from './dto/update-licensing-training.dto';
import { CreateLicensingExamDto } from './dto/create-licensing-exam.dto';
import { UpdateLicensingExamDto } from './dto/update-licensing-exam.dto';
import { CreateEAndOInsuranceDto } from './dto/create-e-and-o-insurance.dto';
import { CreateLicensedAgentIntakeDto } from './dto/create-licensed-agent-intake.dto';
import { ActivateUserDto } from './dto/activate-user.dto';
import { EmailService } from '../email/email.service';
import { ActivationStatus } from './entities/activation-request.entity';
import { UserRole } from '../users/entities/user.entity';
import { AffiliateProfilesService } from '../affiliates/services/affiliate-profiles.service';
import { AffiliateUserPerformanceService } from '../affiliates/services/affiliate-user-performance.service';
import { CompleteAffiliateOnboardingDto } from './dto/complete-affiliate-onboarding.dto';
import { generateReferralCode } from '../affiliates/utils/generate-referral-code';
import { generateAndUploadQrCode } from '../affiliates/utils/generate-qr-code';
import { S3Service } from './services/s3.service';
import { OnboardingStepsService } from './services/onboarding-steps.service';
import { LicensingTrainingService } from './services/licensing-training.service';
import { LicensingExamService } from './services/licensing-exam.service';
import { EAndOInsuranceService } from './services/e-and-o-insurance.service';
import { OnboardingStepKey } from './entities/user-onboarding-step.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventType } from '../analytics/entities/user-event.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(LicensingTraining)
    private readonly licensingTrainingRepository: Repository<LicensingTraining>,
    @InjectRepository(ActivationRequest)
    private readonly activationRequestRepository: Repository<ActivationRequest>,
    @InjectRepository(LicensedAgentIntake)
    private readonly licensedAgentIntakeRepository: Repository<LicensedAgentIntake>,
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    @InjectRepository(OnboardingReviewSubmission)
    private readonly reviewSubmissionRepository: Repository<OnboardingReviewSubmission>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly affiliateProfilesService: AffiliateProfilesService,
    private readonly affiliateUserPerformanceService: AffiliateUserPerformanceService,
    private readonly s3Service: S3Service,
    private readonly onboardingStepsService: OnboardingStepsService,
    private readonly analyticsService: AnalyticsService,
    private readonly transactionService: TransactionService,
    private readonly licensingTrainingService: LicensingTrainingService,
    private readonly licensingExamService: LicensingExamService,
    private readonly eAndOInsuranceService: EAndOInsuranceService,
    private readonly usersService: UsersService,
  ) {}

  // ==================== LICENSING TRAINING ====================

  /**
   * Create licensing training record for a user
   *
   * This operation involves multiple writes that must succeed together:
   * 1. Create licensing training record
   * 2. Update user role to AGENT
   * 3. Track role update event
   * 4. Update onboarding steps
   *
   * All operations are wrapped in a transaction for atomicity.
   */
  async createLicensingTraining(
    userId: string,
    dto: CreateLicensingTrainingDto,
  ): Promise<LicensingTraining> {
    // Validate user exists before transaction
    const user = await this.usersService.findByIdOrFail(userId);

    // Wrap all write operations in a transaction
    return await this.transactionService.runInTransaction(async (manager) => {
      // Create licensing training record
      const training = await this.licensingTrainingService.create(
        userId,
        dto,
        manager,
      );

      // Update user role to AGENT after completing licensing training
      await this.usersService.updateRole(userId, UserRole.AGENT, manager);

      // Track role update event
      await this.analyticsService.trackEvent(
        {
          userId: user.id,
          eventType: EventType.ROLE_UPDATED,
          role: UserRole.AGENT,
          affiliateId: user.affiliate_profile_id,
          metadata: {
            previousRole: 'applicant',
            updatedBy: 'system',
            reason: 'licensing_training_completed',
          },
        },
        manager,
      );

      // Step tracking: Standard path - licensed_check → exam_scheduled
      await this.onboardingStepsService.completeAndProgress(
        userId,
        OnboardingStepKey.LICENSED_CHECK,
        OnboardingStepKey.EXAM_SCHEDULED,
        manager,
      );

      return training;
    });
  }

  async getLicensingTraining(userId: string): Promise<LicensingTraining> {
    return await this.licensingTrainingService.findByUserIdWithRelationsOrFail(
      userId,
    );
  }

  async updateLicensingTraining(
    userId: string,
    dto: UpdateLicensingTrainingDto,
  ): Promise<LicensingTraining> {
    // Validate training exists
    await this.licensingTrainingService.findByUserIdOrFail(userId);

    // Update training record
    await this.licensingTrainingService.update(userId, dto);

    return await this.getLicensingTraining(userId);
  }

  // ==================== LICENSING EXAM ====================

  /**
   * Create or update licensing exam record with attempt tracking
   *
   * This operation involves multiple writes that must succeed together:
   * 1. Validates user exists
   * 2. Tracks document upload event (if document provided)
   * 3. Creates exam snapshot + attempt record via LicensingExamService
   * 4. Updates onboarding steps based on exam result
   * 5. Updates user onboarding status (if exam passed)
   *
   * All operations are wrapped in a transaction for atomicity.
   */
  async createLicensingExam(
    userId: string,
    dto: CreateLicensingExamDto,
  ): Promise<LicensingExam> {
    // Validate user exists before transaction
    const user = await this.usersService.findByIdOrFail(userId);

    // Pre-calculate dates outside transaction
    const now = new Date();
    const examDate = dto.examDate ? new Date(dto.examDate) : null;

    // Wrap all write operations in a transaction
    return await this.transactionService.runInTransaction(async (manager) => {
      // Track document_upload event (if document provided)
      if (dto.resultDocument) {
        await this.analyticsService.trackEvent(
          {
            userId: user.id,
            eventType: EventType.DOCUMENT_UPLOADED,
            role: user.role,
            affiliateId: user.affiliate_profile_id,
            metadata: {
              documentType: 'licensing_exam',
              s3Key: dto.resultDocument,
            },
          },
          manager,
        );
      }

      // Create exam snapshot + attempt record via service
      const exam = await this.licensingExamService.createOrUpdateWithAttempt(
        userId,
        dto,
        manager,
      );

      // Step tracking: exam_scheduled → license_uploaded
      if (dto.isScheduled && examDate) {
        if (examDate > now) {
          // Future exam: Complete exam_scheduled step
          await this.onboardingStepsService.completeStep(
            userId,
            OnboardingStepKey.EXAM_SCHEDULED,
            now,
            manager,
          );
        } else if (dto.result === ExamResult.PASSED) {
          // Exam passed (date in past): Create completed license_uploaded step and enter e&o_uploaded
          const examScheduledStep = await this.onboardingStepsService.getStep(
            userId,
            OnboardingStepKey.EXAM_SCHEDULED,
          );
          const enteredAt = examScheduledStep?.completedAt || now;

          await this.onboardingStepsService.createCompletedStep(
            userId,
            OnboardingStepKey.LICENSE_UPLOADED,
            enteredAt,
            now,
            manager,
          );
          await this.onboardingStepsService.enterStep(
            userId,
            OnboardingStepKey.EO_UPLOADED,
            now,
            manager,
          );
          await this.updateUserOnboardingStatus(
            userId,
            OnboardingStatus.LICENSED,
            manager,
          );
        }
      }

      return exam;
    });
  }

  async getLicensingExam(userId: string): Promise<LicensingExam> {
    return await this.licensingExamService.findByUserIdWithRelationsOrFail(
      userId,
    );
  }

  /**
   * Update licensing exam record
   *
   * This operation involves multiple writes that must succeed together:
   * 1. Update exam record
   * 2. Update user onboarding status (if exam result changed to passed)
   *
   * All operations are wrapped in a transaction for atomicity.
   */
  async updateLicensingExam(
    userId: string,
    dto: UpdateLicensingExamDto,
  ): Promise<LicensingExam> {
    // Validate exam exists before transaction
    await this.licensingExamService.findByUserIdOrFail(userId);

    // Wrap all write operations in a transaction
    await this.transactionService.runInTransaction(async (manager) => {
      // Update exam record (validation handled by service)
      await this.licensingExamService.update(userId, dto, manager);

      // If result is 'passed', update user's onboarding status
      if (dto.result === ExamResult.PASSED) {
        await this.updateUserOnboardingStatus(
          userId,
          OnboardingStatus.LICENSED,
          manager,
        );
      }
    });

    return await this.getLicensingExam(userId);
  }

  async getLicensingExamAttempts(
    userId: string,
  ): Promise<LicensingExamAttempt[]> {
    return await this.licensingExamService.findAttempts(userId);
  }

  // ==================== E&O INSURANCE ====================

  /**
   * Create E&O insurance record for a user
   *
   * This operation involves multiple writes that must succeed together:
   * 1. Validates user exists and passed licensing exam
   * 2. Creates E&O insurance record via service
   * 3. Tracks document upload event
   * 4. Updates onboarding steps
   * 5. Updates user onboarding status to pending_activation
   * 6. Creates activation request and notifies admin
   *
   * All database operations are wrapped in a transaction for atomicity.
   */
  async createEAndOInsurance(
    userId: string,
    dto: CreateEAndOInsuranceDto,
  ): Promise<EAndOInsurance> {
    // Validate user exists and passed licensing exam before transaction
    const user = await this.usersService.findByIdOrFail(userId);

    const hasPassed = await this.licensingExamService.hasPassed(userId);
    if (!hasPassed) {
      throw new BadRequestException(
        'You must pass the licensing exam before uploading E&O insurance',
      );
    }

    // Wrap all write operations in a transaction
    const insurance = await this.transactionService.runInTransaction(
      async (manager) => {
        // Create E&O insurance record via service
        const insurance = await this.eAndOInsuranceService.create(
          userId,
          dto,
          manager,
        );

        // Track document_upload event
        if (insurance.documentPath) {
          await this.analyticsService.trackEvent(
            {
              userId: user.id,
              eventType: EventType.DOCUMENT_UPLOADED,
              role: user.role,
              affiliateId: user.affiliate_profile_id,
              metadata: {
                documentType: 'e_and_o_insurance',
                s3Key: dto.documentPath,
              },
            },
            manager,
          );
        }

        // Step tracking: e&o_uploaded → activation_unlocked
        await this.onboardingStepsService.completeAndProgress(
          userId,
          OnboardingStepKey.EO_UPLOADED,
          OnboardingStepKey.ACTIVATION_UNLOCKED,
          manager,
        );

        // Update user onboarding status to pending_activation
        await this.updateUserOnboardingStatus(
          userId,
          OnboardingStatus.PENDING_ACTIVATION,
          manager,
        );

        return insurance;
      },
    );

    // Note: createActivationRequestAndNotify is called OUTSIDE transaction
    // because it involves external email service (fire-and-forget pattern)
    // This is intentional - we don't want email failures to rollback the transaction
    await this.createActivationRequestAndNotify(user);

    return insurance;
  }

  async listEAndOInsurance(userId: string): Promise<EAndOInsurance[]> {
    return await this.eAndOInsuranceService.findAllByUserId(userId);
  }

  async getEAndOInsuranceById(id: string): Promise<EAndOInsurance> {
    return await this.eAndOInsuranceService.findByIdOrFail(id);
  }

  // ==================== LICENSED AGENT INTAKE (Fast-Track Path) ====================

  async createLicensedAgentIntake(
    userId: string,
    dto: CreateLicensedAgentIntakeDto,
  ): Promise<{ intake: LicensedAgentIntake; licenses: License[] }> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user isLicensed flag is true
    if (!user.isLicensed) {
      throw new BadRequestException(
        'User is not marked as licensed. This endpoint is only for already-licensed agents.',
      );
    }

    // Check if intake record already exists
    const existing = await this.licensedAgentIntakeRepository.findOne({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException(
        'Licensed agent intake record already exists for this user',
      );
    }

    // Validate debt details if hasExistingDebt is true
    if (dto.hasExistingDebt && !dto.debtDetails) {
      throw new BadRequestException(
        'Debt details are required when hasExistingDebt is true',
      );
    }

    // Create license records for each state
    const licenses: License[] = [];
    for (const licenseDto of dto.licenses) {
      const license = this.licenseRepository.create({
        userId,
        state: licenseDto.state,
        licenseNumber: licenseDto.licenseNumber,
        expirationDate: new Date(licenseDto.expirationDate),
        licenseDocumentPath: licenseDto.licenseDocumentPath,
      });
      const savedLicense = await this.licenseRepository.save(license);
      licenses.push(savedLicense);
    }

    // Create intake record
    const intake = this.licensedAgentIntakeRepository.create({
      userId,
      yearsLicensed: dto.yearsLicensed,
      experienceLevel: dto.experienceLevel,
      productFocus: dto.productFocus,
      eAndODocumentPath: dto.eAndODocumentPath,
      eAndOCarrierName: dto.eAndOCarrierName,
      eAndOPolicyNumber: dto.eAndOPolicyNumber,
      eAndOExpirationDate: new Date(dto.eAndOExpirationDate),
      hasExistingDebt: dto.hasExistingDebt,
      debtDetails: dto.debtDetails,
      previousCarriers: dto.previousCarriers,
    });

    const savedIntake = await this.licensedAgentIntakeRepository.save(intake);

    // Auto-create E&O insurance record from intake data (using service without validation)
    await this.eAndOInsuranceService.createWithoutValidation(userId, {
      documentPath: dto.eAndODocumentPath,
      carrierName: dto.eAndOCarrierName,
      policyNumber: dto.eAndOPolicyNumber,
      expirationDate: dto.eAndOExpirationDate,
    });

    if (dto.eAndODocumentPath) {
      // Track document_upload event
      await this.analyticsService.trackEvent({
        userId: user.id,
        eventType: EventType.DOCUMENT_UPLOADED,
        role: user.role,
        affiliateId: user.affiliate_profile_id,
        metadata: {
          documentType: 'e_and_o_insurance',
          s3Key: dto.eAndODocumentPath,
        },
      });
    }

    // Step tracking: Fast track - license_uploaded → e&o_uploaded
    await this.onboardingStepsService.completeAndProgress(
      userId,
      OnboardingStepKey.LICENSE_UPLOADED,
      OnboardingStepKey.EO_UPLOADED,
    );

    // Update user onboarding status to pending_activation
    await this.updateUserOnboardingStatus(
      userId,
      OnboardingStatus.PENDING_ACTIVATION,
    );

    // Create activation request and send email to Richard (fast-track path)
    await this.createActivationRequestAndNotify(user, true);

    console.log(
      `[OnboardingService] Successfully created licensed agent intake for user ${userId} with ${licenses.length} licenses`,
    );

    return { intake: savedIntake, licenses };
  }

  async getLicensedAgentIntake(userId: string): Promise<{
    intake: LicensedAgentIntake;
    licenses: License[];
  }> {
    const intake = await this.licensedAgentIntakeRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!intake) {
      throw new NotFoundException('Licensed agent intake record not found');
    }

    const licenses = await this.licenseRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });

    return { intake, licenses };
  }

  // ==================== AFFILIATE-ONLY ONBOARDING ====================

  /**
   * Complete affiliate-only onboarding
   * Auto-matches user to AffiliateProfile by email if it exists
   */
  async completeAffiliateOnboarding(
    userId: string,
    dto: CompleteAffiliateOnboardingDto,
  ): Promise<User> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Try to find matching AffiliateProfile by email
    let affiliateProfileId: string | undefined = undefined;
    const matchingProfile = await this.affiliateProfilesService.findByEmail(
      user.email,
    );

    if (matchingProfile) {
      // Check if profile is already linked to another user
      const existingLink = await this.userRepository.findOne({
        where: { affiliate_profile_id: matchingProfile.id },
      });

      if (existingLink && existingLink.id !== userId) {
        throw new BadRequestException(
          'This affiliate profile is already linked to another user',
        );
      }

      affiliateProfileId = matchingProfile.id;
      console.log(
        `[OnboardingService] Matched user ${userId} to affiliate profile ${affiliateProfileId} by email`,
      );
    }

    // Generate unique referral link (using unique code)
    let referralCode: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      referralCode = generateReferralCode();
      const existingCode = await this.userRepository.findOne({
        where: {
          referral_link: `${process.env.PUBLIC_SITE_URL}/ref/${referralCode}`,
        },
      });

      if (!existingCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException(
        'Failed to generate unique referral link. Please try again.',
      );
    }

    const referralLink = `${process.env.PUBLIC_SITE_URL}/ref/${referralCode!}`;

    // Generate and upload QR code
    const qrCodeUrl = await generateAndUploadQrCode(
      referralLink,
      userId,
      this.s3Service,
    );

    // Update user record
    await this.userRepository.update(userId, {
      role: UserRole.AFFILIATE_ONLY,
      affiliate_profile_id: affiliateProfileId,
      referral_link: referralLink,
      qr_code_url: qrCodeUrl,
      onboardingStatus: OnboardingStatus.ONBOARDED,
    });

    // Create AffiliateUserPerformance record
    await this.affiliateUserPerformanceService.create(userId);

    console.log(
      `[OnboardingService] Successfully completed affiliate-only onboarding for user ${userId}${affiliateProfileId ? `, linked to profile ${affiliateProfileId}` : ''}`,
    );

    // Reload and return user with updated data
    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['affiliateProfile'],
    });

    return updatedUser!;
  }

  // ==================== ACTIVATION REQUEST ====================

  private async createActivationRequestAndNotify(
    user: User,
    isFastTrack: boolean = false,
  ): Promise<void> {
    // Check if activation request already exists
    const existing = await this.activationRequestRepository.findOne({
      where: { userId: user.id },
    });

    if (existing) {
      console.log(
        `[OnboardingService] Activation request already exists for user ${user.id}`,
      );
      return;
    }

    // Determine next attempt number
    const previousSubmissions = await this.reviewSubmissionRepository.find({
      where: { user_id: user.id },
      order: { attempt_number: 'DESC' },
      take: 1,
    });
    const nextAttemptNumber =
      previousSubmissions.length > 0
        ? previousSubmissions[0].attempt_number + 1
        : 1;

    // Create frozen JSONB snapshot of onboarding state
    const snapshot = await this.createOnboardingSnapshot(user.id, isFastTrack);

    // Create review submission record (append-only history)
    const reviewSubmission = this.reviewSubmissionRepository.create({
      user_id: user.id,
      attempt_number: nextAttemptNumber,
      snapshot,
      status: OnboardingReviewStatus.PENDING,
    });
    await this.reviewSubmissionRepository.save(reviewSubmission);

    console.log(
      `[OnboardingService] Created review submission attempt #${nextAttemptNumber} for user ${user.id}`,
    );

    // Create activation request
    const richardEmail = process.env.FOUNDER_EMAIL!;

    const activationRequest = this.activationRequestRepository.create({
      userId: user.id,
      emailSentAt: new Date(),
      emailSentTo: richardEmail,
    });

    await this.activationRequestRepository.save(activationRequest);

    // Send email to Richard (fire and forget)
    this.sendActivationEmailToRichard(user, richardEmail, isFastTrack).catch(
      (error) => {
        console.error(
          `[OnboardingService] Failed to send activation email for user ${user.id}:`,
          error,
        );
      },
    );
  }

  private async sendActivationEmailToRichard(
    user: User,
    richardEmail: string,
    isFastTrack: boolean = false,
  ): Promise<void> {
    console.log(
      `[OnboardingService] Sending activation email to ${richardEmail} for user ${user.email} (${isFastTrack ? 'fast-track' : 'standard'} path)`,
    );

    await this.emailService.sendActivationEmail(
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userId: user.id,
        isFastTrack,
      },
      richardEmail,
    );
  }

  /**
   * Admin reviews activation request (approve or reject)
   *
   * This operation involves multiple writes that must succeed together:
   * - APPROVE: Updates user, activation request, review submission, steps, analytics
   * - REJECT: Updates user, activation request, review submission, analytics
   *
   * All database operations are wrapped in a transaction for atomicity.
   * Email notifications are sent OUTSIDE transaction (fire-and-forget).
   */
  async activateUser(
    userId: string,
    admin: User,
    dto: ActivateUserDto,
  ): Promise<{ user: User; activationRequest: ActivationRequest }> {
    // Validate user exists and is in correct status before transaction
    const user = await this.usersService.findByIdOrFail(userId);

    if (user.onboardingStatus !== OnboardingStatus.PENDING_ACTIVATION) {
      throw new BadRequestException(
        `User onboarding status must be 'pending_activation' to review. Current status: ${user.onboardingStatus}`,
      );
    }

    // Find activation request
    const activationRequest = await this.activationRequestRepository.findOne({
      where: { userId },
    });

    if (!activationRequest) {
      throw new NotFoundException('Activation request not found for this user');
    }

    if (activationRequest.status !== ActivationStatus.PENDING) {
      throw new BadRequestException(
        `Activation request has already been ${activationRequest.status}`,
      );
    }

    // Find the latest pending review submission to update
    const reviewSubmission = await this.reviewSubmissionRepository.findOne({
      where: { user_id: userId, status: OnboardingReviewStatus.PENDING },
      order: { attempt_number: 'DESC' },
    });

    // Pre-calculate timestamps
    const actionAt = new Date();

    // Wrap all database writes in a transaction
    await this.transactionService.runInTransaction(async (manager) => {
      const activationRequestRepo = manager.getRepository(ActivationRequest);
      const reviewSubmissionRepo = manager.getRepository(
        OnboardingReviewSubmission,
      );

      // Handle APPROVAL
      if (dto.status === ActivationStatus.APPROVED) {
        // Calculate time to activation (seconds from approved_at to activation)
        const timeToActivation = user.approved_at
          ? Math.floor((actionAt.getTime() - user.approved_at.getTime()) / 1000)
          : null;

        // Update user: mark onboarding complete and set activation timestamp
        await this.updateUserOnboardingStatus(
          userId,
          OnboardingStatus.ONBOARDED,
          manager,
        );
        await this.usersService.updateActivationData(
          userId,
          actionAt,
          timeToActivation,
          manager,
        );

        // Update activation request
        await activationRequestRepo.update(activationRequest.id, {
          status: ActivationStatus.APPROVED,
          approvedBy: admin.id,
          approvedAt: actionAt,
          notes: dto.notes,
        });

        // Update review submission with approval details
        if (reviewSubmission) {
          await reviewSubmissionRepo.update(reviewSubmission.id, {
            status: OnboardingReviewStatus.APPROVED,
            reviewed_by: admin.id,
            reviewed_at: actionAt,
            admin_notes: dto.notes,
          });
        }

        // Step tracking: Complete activation_unlocked step (end of funnel)
        await this.onboardingStepsService.completeStep(
          userId,
          OnboardingStepKey.ACTIVATION_UNLOCKED,
          actionAt,
          manager,
        );

        // Track admin approval event
        await this.analyticsService.trackEvent(
          {
            userId: admin.id,
            eventType: EventType.ADMIN_APPROVED,
            role: admin.role,
            metadata: {
              targetUserId: userId,
              targetUserEmail: user.email,
              notes: dto.notes,
            },
          },
          manager,
        );

        console.log(
          `[OnboardingService] User ${userId} APPROVED by admin ${admin.id}. Onboarding complete.`,
        );
      }
      // Handle REJECTION
      else if (dto.status === ActivationStatus.REJECTED) {
        // Update user: send back to in_progress, clear activation timestamps
        await this.updateUserOnboardingStatus(
          userId,
          OnboardingStatus.IN_PROGRESS,
          manager,
        );
        await this.usersService.clearActivationData(userId, manager);

        // Update activation request
        await activationRequestRepo.update(activationRequest.id, {
          status: ActivationStatus.REJECTED,
          approvedBy: admin.id,
          approvedAt: actionAt,
          notes: dto.notes,
        });

        // Update review submission with rejection details
        if (reviewSubmission) {
          await reviewSubmissionRepo.update(reviewSubmission.id, {
            status: OnboardingReviewStatus.REJECTED,
            reviewed_by: admin.id,
            reviewed_at: actionAt,
            admin_notes: dto.notes,
          });
        }

        // Track admin rejection event
        await this.analyticsService.trackEvent(
          {
            userId: admin.id,
            eventType: EventType.ADMIN_REJECTED,
            role: admin.role,
            metadata: {
              targetUserId: userId,
              targetUserEmail: user.email,
              notes: dto.notes,
              attemptNumber: reviewSubmission?.attempt_number,
            },
          },
          manager,
        );

        console.log(
          `[OnboardingService] User ${userId} REJECTED by admin ${admin.id}. Sent back to in_progress. Rejection count: ${reviewSubmission?.attempt_number || 'unknown'}`,
        );
      }
    });

    // Send emails OUTSIDE transaction (fire-and-forget pattern)
    // We don't want email failures to rollback database changes
    if (dto.status === ActivationStatus.APPROVED) {
      await this.emailService.sendOnboardedEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } else if (dto.status === ActivationStatus.REJECTED) {
      await this.emailService.sendActivationRejectedEmail({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        notes: dto.notes || 'Please review your submission and resubmit.',
      });
    }

    // Reload user and activation request with updated data
    const updatedUser = await this.usersService.findByIdOrFail(userId);
    const updatedActivationRequest =
      await this.activationRequestRepository.findOne({
        where: { id: activationRequest.id },
        relations: ['approver'],
      });

    return {
      user: updatedUser,
      activationRequest: updatedActivationRequest!,
    };
  }

  // ==================== USER ONBOARDING STATUS UPDATE ====================

  /**
   * Allow user (AGENT role) to update their own onboarding status
   */
  async updateOnboardingStatus(
    userId: string,
    status: OnboardingStatus,
  ): Promise<User> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user has AGENT role
    if (user.role !== UserRole.AGENT) {
      throw new BadRequestException(
        'Only agents can update their onboarding status',
      );
    }

    // Update status
    await this.updateUserOnboardingStatus(userId, status);

    // Step tracking: Fast track path - licensed_check → license_uploaded
    if (status === OnboardingStatus.LICENSED) {
      await this.onboardingStepsService.completeAndProgress(
        userId,
        OnboardingStepKey.LICENSED_CHECK,
        OnboardingStepKey.LICENSE_UPLOADED,
      );
    }

    // Reload and return user with updated data
    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    console.log(
      `[OnboardingService] User ${userId} updated their onboarding status to ${status}`,
    );

    return updatedUser!;
  }

  // ==================== ONBOARDING REVIEW SUBMISSIONS ====================

  /**
   * Get all onboarding review submission attempts for a user
   * Returns complete audit history of submissions, rejections, and approvals
   */
  async getOnboardingReviewSubmissions(
    userId: string,
  ): Promise<OnboardingReviewSubmission[]> {
    const submissions = await this.reviewSubmissionRepository.find({
      where: { user_id: userId },
      relations: ['user', 'reviewer'],
      order: { attempt_number: 'DESC' },
    });

    return submissions;
  }

  // ==================== ACTIVATION REQUESTS (ADMIN QUEUE) ====================

  /**
   * Get all activation requests with optional status filter (Admin only)
   * Returns list of users pending activation review
   *
   * @param status - Filter by activation status (pending, approved, rejected)
   * @returns List of activation requests with user details
   */
  async getActivationRequests(
    status?: ActivationStatus,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        onboardingStatus: string | null;
      };
      status: ActivationStatus;
      emailSentAt: Date;
      emailSentTo: string;
      approvedBy: string | null;
      approvedAt: Date | null;
      notes: string | null;
      createdAt: Date;
    }>
  > {
    const queryBuilder = this.activationRequestRepository
      .createQueryBuilder('ar')
      .leftJoinAndSelect('ar.user', 'user')
      .leftJoinAndSelect('ar.approver', 'approver')
      .orderBy('ar.createdAt', 'DESC');

    // Filter by status if provided
    if (status) {
      queryBuilder.andWhere('ar.status = :status', { status });
    }

    const activationRequests = await queryBuilder.getMany();

    // Map to response format
    return activationRequests.map((ar) => ({
      id: ar.id,
      userId: ar.userId,
      user: {
        id: ar.user.id,
        email: ar.user.email,
        firstName: ar.user.firstName,
        lastName: ar.user.lastName,
        phone: ar.user.phone || null,
        onboardingStatus: ar.user.onboardingStatus || null,
      },
      status: ar.status,
      emailSentAt: ar.emailSentAt,
      emailSentTo: ar.emailSentTo,
      approvedBy: ar.approver
        ? `${ar.approver.firstName} ${ar.approver.lastName}`
        : null,
      approvedAt: ar.approvedAt || null,
      notes: ar.notes || null,
      createdAt: ar.createdAt,
    }));
  }

  // ==================== HELPER METHODS ====================

  private async updateUserOnboardingStatus(
    userId: string,
    status: OnboardingStatus,
    manager?: EntityManager,
  ): Promise<void> {
    const userRepo = manager
      ? manager.getRepository(User)
      : this.userRepository;

    const updateData: Partial<User> = {
      onboardingStatus: status,
    };

    // If status is LICENSED, also set isLicensed to true
    if (status === OnboardingStatus.LICENSED) {
      updateData.isLicensed = true;
    }

    await userRepo.update(userId, updateData);

    console.log(
      `[OnboardingService] Updated user ${userId} onboarding status to ${status}${status === OnboardingStatus.LICENSED ? ' and isLicensed to true' : ''}`,
    );
  }

  /**
   * Create a frozen JSONB snapshot of user's onboarding state for admin review
   * This preserves what the admin saw at review time for historical audit
   */
  private async createOnboardingSnapshot(
    userId: string,
    isFastTrack: boolean = false,
  ): Promise<Record<string, any>> {
    const snapshot: Record<string, any> = {
      userId,
      isFastTrack,
      snapshotCreatedAt: new Date().toISOString(),
    };

    // Standard path: licensing_training, licensing_exam, e_and_o_insurance
    if (!isFastTrack) {
      const training = await this.licensingTrainingRepository.findOne({
        where: { userId },
      });
      const exam = await this.licensingExamService.findByUserId(userId);
      const eAndO = await this.eAndOInsuranceService.findByUserId(userId);

      if (training) snapshot.licensing_training = training;
      if (exam) snapshot.licensing_exam = exam;
      if (eAndO) snapshot.e_and_o_insurance = eAndO;
    }
    // Fast-track path: licensed_agent_intake, licenses, e_and_o_insurance
    else {
      const intake = await this.licensedAgentIntakeRepository.findOne({
        where: { userId },
      });
      const licenses = await this.licenseRepository.find({
        where: { userId },
      });
      const eAndO = await this.eAndOInsuranceService.findByUserId(userId);

      if (intake) snapshot.licensed_agent_intake = intake;
      if (licenses.length) snapshot.licenses = licenses;
      if (eAndO) snapshot.e_and_o_insurance = eAndO;
    }

    return snapshot;
  }

  // ==================== GET ONBOARDING STATUS (MCP TOOL) ====================

  /**
   * Get comprehensive onboarding status for MCP server tools
   *
   * Returns rich contextual information about user's onboarding progress,
   * including completed steps, pending steps, and detailed state.
   *
   * @param userId - User ID to get status for
   * @returns Comprehensive onboarding status
   */
  async getOnboardingStatus(userId: string): Promise<any> {
    // Get user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const completedSteps: string[] = [];
    const pendingSteps: string[] = [];
    const details: any = {};

    // Check which path the user is on: standard (training/exam) or fast-track (licenses)
    const licenses = await this.licenseRepository.find({ where: { userId } });
    const isFastTrack = licenses.length > 0;

    if (isFastTrack) {
      // Fast-track path: Show licenses and licensed intake only
      details.licenses = {
        count: licenses.length,
        states: licenses.map((l) => l.state),
      };
      completedSteps.push('licenses');

      // Check licensed intake
      const intake = await this.licensedAgentIntakeRepository.findOne({
        where: { userId },
      });
      if (intake) {
        completedSteps.push('licensed_intake');
        details.licensedIntake = {
          completed: true,
          submittedAt: intake.createdAt,
        };
      }

      // Check E&O insurance (common to both paths)
      const eoInsurances =
        await this.eAndOInsuranceService.findAllByUserId(userId);
      if (eoInsurances.length > 0) {
        completedSteps.push('e_and_o_insurance');
        const latest = eoInsurances[0];
        details.eoInsurance = {
          completed: true,
          count: eoInsurances.length,
          latestUploadedAt: latest.createdAt,
          latestExpiresAt: latest.expirationDate,
        };
      }
    } else {
      // Standard path: Show licensing training and exam only
      // Check licensing training
      const training = await this.licensingTrainingRepository.findOne({
        where: { userId },
      });
      if (training && training.isRegistered) {
        completedSteps.push('licensing_training');
        details.licensingTraining = {
          completed: true,
          isRegistered: training.isRegistered,
          completedAt: training.updatedAt,
        };
      } else if (training) {
        pendingSteps.push('licensing_training');
        details.licensingTraining = {
          completed: false,
          isRegistered: training.isRegistered,
        };
      }

      // Check licensing exam
      const exam = await this.licensingExamService.findByUserId(userId);
      const examAttempts = await this.licensingExamService.findAttempts(userId);

      if (exam && exam.result === ExamResult.PASSED) {
        completedSteps.push('licensing_exam');
        details.licensingExam = {
          completed: true,
          passed: true,
          attempts: examAttempts.length,
          passedAt: exam.updatedAt,
        };
      } else if (exam) {
        pendingSteps.push('licensing_exam');
        details.licensingExam = {
          completed: false,
          passed: false,
          attempts: examAttempts.length,
        };
      }

      // Check E&O insurance (common to both paths)
      const eoInsurances =
        await this.eAndOInsuranceService.findAllByUserId(userId);
      if (eoInsurances.length > 0) {
        completedSteps.push('e_and_o_insurance');
        const latest = eoInsurances[0];
        details.eoInsurance = {
          completed: true,
          count: eoInsurances.length,
          latestUploadedAt: latest.createdAt,
          latestExpiresAt: latest.expirationDate,
        };
      } else {
        pendingSteps.push('e_and_o_insurance');
        details.eoInsurance = {
          completed: false,
          count: 0,
        };
      }
    }

    // Note: affiliate and activation details are not included in this response

    return {
      onboardingStatus: user.onboardingStatus,
      userRole: user.role,
      completedSteps,
      pendingSteps,
      details,
    };
  }
}
