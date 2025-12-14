import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LicensingTraining } from './entities/licensing-training.entity';
import { LicensingExam, ExamResult } from './entities/licensing-exam.entity';
import { EAndOInsurance } from './entities/e-and-o-insurance.entity';
import { ActivationRequest } from './entities/activation-request.entity';
import { LicensedAgentIntake } from './entities/licensed-agent-intake.entity';
import { License } from './entities/license.entity';
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

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(LicensingTraining)
    private readonly licensingTrainingRepository: Repository<LicensingTraining>,
    @InjectRepository(LicensingExam)
    private readonly licensingExamRepository: Repository<LicensingExam>,
    @InjectRepository(EAndOInsurance)
    private readonly eAndOInsuranceRepository: Repository<EAndOInsurance>,
    @InjectRepository(ActivationRequest)
    private readonly activationRequestRepository: Repository<ActivationRequest>,
    @InjectRepository(LicensedAgentIntake)
    private readonly licensedAgentIntakeRepository: Repository<LicensedAgentIntake>,
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly affiliateProfilesService: AffiliateProfilesService,
    private readonly affiliateUserPerformanceService: AffiliateUserPerformanceService,
    private readonly s3Service: S3Service,
  ) {}

  // ==================== LICENSING TRAINING ====================

  async createLicensingTraining(
    userId: string,
    dto: CreateLicensingTrainingDto,
  ): Promise<LicensingTraining> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if training record already exists
    const existing = await this.licensingTrainingRepository.findOne({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Licensing training record already exists');
    }

    // Validate: if isRegistered is true, examfxEmail and registrationScreenshot are optional but recommended
    if (dto.isRegistered && !dto.examfxEmail && !dto.registrationScreenshot) {
      console.warn(
        `[OnboardingService] User ${userId} registered but no examfxEmail or screenshot provided`,
      );
    }

    const training = this.licensingTrainingRepository.create({
      userId,
      ...dto,
    });

    return await this.licensingTrainingRepository.save(training);
  }

  async getLicensingTraining(userId: string): Promise<LicensingTraining> {
    const training = await this.licensingTrainingRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!training) {
      throw new NotFoundException('Licensing training record not found');
    }

    return training;
  }

  async updateLicensingTraining(
    userId: string,
    dto: UpdateLicensingTrainingDto,
  ): Promise<LicensingTraining> {
    const training = await this.licensingTrainingRepository.findOne({
      where: { userId },
    });

    if (!training) {
      throw new NotFoundException('Licensing training record not found');
    }

    Object.assign(training, dto);
    await this.licensingTrainingRepository.save(training);

    return await this.getLicensingTraining(userId);
  }

  // ==================== LICENSING EXAM ====================

  async createLicensingExam(
    userId: string,
    dto: CreateLicensingExamDto,
  ): Promise<LicensingExam> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate: if isScheduled is true, examDate is required
    if (dto.isScheduled && !dto.examDate) {
      throw new BadRequestException(
        'Exam date is required when isScheduled is true',
      );
    }

    // Check if exam record already exists (we only keep the latest)
    const existing = await this.licensingExamRepository.findOne({
      where: { userId },
    });

    if (existing) {
      // Update existing record instead of creating new one
      Object.assign(existing, dto);
      await this.licensingExamRepository.save(existing);

      // If result is 'passed', update user's onboarding status
      if (dto.result === ExamResult.PASSED) {
        await this.updateUserOnboardingStatus(
          userId,
          OnboardingStatus.LICENSED,
        );
      }

      return await this.getLicensingExam(userId);
    }

    const exam = this.licensingExamRepository.create({
      userId,
      ...dto,
    });

    const saved = await this.licensingExamRepository.save(exam);

    // If result is 'passed', update user's onboarding status
    if (dto.result === ExamResult.PASSED) {
      await this.updateUserOnboardingStatus(userId, OnboardingStatus.LICENSED);
    }

    return saved;
  }

  async getLicensingExam(userId: string): Promise<LicensingExam> {
    const exam = await this.licensingExamRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!exam) {
      throw new NotFoundException('Licensing exam record not found');
    }

    return exam;
  }

  async updateLicensingExam(
    userId: string,
    dto: UpdateLicensingExamDto,
  ): Promise<LicensingExam> {
    const exam = await this.licensingExamRepository.findOne({
      where: { userId },
    });

    if (!exam) {
      throw new NotFoundException('Licensing exam record not found');
    }

    // Validate: if isScheduled is true, examDate is required
    if (dto.isScheduled && !dto.examDate) {
      throw new BadRequestException(
        'Exam date is required when isScheduled is true',
      );
    }

    Object.assign(exam, dto);
    await this.licensingExamRepository.save(exam);

    // If result is 'passed', update user's onboarding status
    if (dto.result === ExamResult.PASSED) {
      await this.updateUserOnboardingStatus(userId, OnboardingStatus.LICENSED);
    }

    return await this.getLicensingExam(userId);
  }

  // ==================== E&O INSURANCE ====================

  async createEAndOInsurance(
    userId: string,
    dto: CreateEAndOInsuranceDto,
  ): Promise<EAndOInsurance> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user has passed licensing exam
    const exam = await this.licensingExamRepository.findOne({
      where: { userId },
    });
    if (!exam || exam.result !== ExamResult.PASSED) {
      throw new BadRequestException(
        'You must pass the licensing exam before uploading E&O insurance',
      );
    }

    // Verify user has passed licensing exam
    const existingInsurance = await this.eAndOInsuranceRepository.findOne({
      where: { userId },
    });
    if (existingInsurance) {
      throw new BadRequestException(
        'E&O insurance already exist for this user',
      );
    }

    const insurance = this.eAndOInsuranceRepository.create({
      userId,
      ...dto,
    });

    const saved = await this.eAndOInsuranceRepository.save(insurance);

    // Update user onboarding status to pending_activation
    await this.updateUserOnboardingStatus(
      userId,
      OnboardingStatus.PENDING_ACTIVATION,
    );

    // Create activation request and send email to Richard
    await this.createActivationRequestAndNotify(userId);

    return saved;
  }

  async listEAndOInsurance(userId: string): Promise<EAndOInsurance[]> {
    return await this.eAndOInsuranceRepository.find({
      where: { userId },
      relations: ['user', 'reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  async getEAndOInsuranceById(id: string): Promise<EAndOInsurance> {
    const insurance = await this.eAndOInsuranceRepository.findOne({
      where: { id },
      relations: ['user', 'reviewer'],
    });

    if (!insurance) {
      throw new NotFoundException('E&O insurance record not found');
    }

    return insurance;
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

    // Auto-create E&O insurance record from intake data
    const eAndO = this.eAndOInsuranceRepository.create({
      userId,
      documentPath: dto.eAndODocumentPath,
      carrierName: dto.eAndOCarrierName,
      policyNumber: dto.eAndOPolicyNumber,
      expirationDate: new Date(dto.eAndOExpirationDate),
    });
    await this.eAndOInsuranceRepository.save(eAndO);

    // Update user onboarding status to pending_activation
    await this.updateUserOnboardingStatus(
      userId,
      OnboardingStatus.PENDING_ACTIVATION,
    );

    // Create activation request and send email to Richard (fast-track path)
    await this.createActivationRequestAndNotify(userId, true);

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
    userId: string,
    isFastTrack: boolean = false,
  ): Promise<void> {
    // Check if activation request already exists
    const existing = await this.activationRequestRepository.findOne({
      where: { userId },
    });

    if (existing) {
      console.log(
        `[OnboardingService] Activation request already exists for user ${userId}`,
      );
      return;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create activation request
    const richardEmail =
      process.env.RICHARD_EMAIL || 'richard@makeincomeanywhere.com';

    const activationRequest = this.activationRequestRepository.create({
      userId,
      emailSentAt: new Date(),
      emailSentTo: richardEmail,
    });

    await this.activationRequestRepository.save(activationRequest);

    // Send email to Richard (fire and forget)
    this.sendActivationEmailToRichard(user, richardEmail, isFastTrack).catch(
      (error) => {
        console.error(
          `[OnboardingService] Failed to send activation email for user ${userId}:`,
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
   * Admin endpoint to activate a user after reviewing their onboarding
   * This promotes the user from applicant to agent and marks onboarding complete
   */
  async activateUser(
    userId: string,
    adminId: string,
    dto: ActivateUserDto,
  ): Promise<{ user: User; activationRequest: ActivationRequest }> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify user is in pending_activation status
    if (user.onboardingStatus !== OnboardingStatus.PENDING_ACTIVATION) {
      throw new BadRequestException(
        `User onboarding status must be 'pending_activation' to activate. Current status: ${user.onboardingStatus}`,
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

    // Update user: promote to AGENT role and mark onboarding complete
    await this.userRepository.update(userId, {
      role: UserRole.AGENT,
      onboardingStatus: OnboardingStatus.ONBOARDED,
    });

    // Update activation request
    await this.activationRequestRepository.update(activationRequest.id, {
      status: ActivationStatus.APPROVED,
      approvedBy: adminId,
      approvedAt: new Date(),
      notes: dto.notes,
    });

    console.log(
      `[OnboardingService] User ${userId} activated by admin ${adminId}. Promoted to AGENT role.`,
    );

    // Send onboarded confirmation email to the agent
    await this.emailService.sendOnboardedEmail({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Reload user and activation request with updated data
    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    const updatedActivationRequest =
      await this.activationRequestRepository.findOne({
        where: { id: activationRequest.id },
        relations: ['approver'],
      });

    return {
      user: updatedUser!,
      activationRequest: updatedActivationRequest!,
    };
  }

  // ==================== HELPER METHODS ====================

  private async updateUserOnboardingStatus(
    userId: string,
    status: OnboardingStatus,
  ): Promise<void> {
    const updateData: Partial<User> = {
      onboardingStatus: status,
    };

    // If status is LICENSED, also set isLicensed to true
    if (status === OnboardingStatus.LICENSED) {
      updateData.isLicensed = true;
    }

    await this.userRepository.update(userId, updateData);

    console.log(
      `[OnboardingService] Updated user ${userId} onboarding status to ${status}${status === OnboardingStatus.LICENSED ? ' and isLicensed to true' : ''}`,
    );
  }
}
