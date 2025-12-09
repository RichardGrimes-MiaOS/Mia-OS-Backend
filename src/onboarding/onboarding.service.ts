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
import { User, OnboardingStatus } from '../users/entities/user.entity';
import { CreateLicensingTrainingDto } from './dto/create-licensing-training.dto';
import { UpdateLicensingTrainingDto } from './dto/update-licensing-training.dto';
import { CreateLicensingExamDto } from './dto/create-licensing-exam.dto';
import { UpdateLicensingExamDto } from './dto/update-licensing-exam.dto';
import { CreateEAndOInsuranceDto } from './dto/create-e-and-o-insurance.dto';
import { EmailService } from '../email/email.service';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
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
        await this.updateUserOnboardingStatus(userId, OnboardingStatus.LICENSED);
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

  // ==================== ACTIVATION REQUEST ====================

  private async createActivationRequestAndNotify(
    userId: string,
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
    this.sendActivationEmailToRichard(user, richardEmail).catch((error) => {
      console.error(
        `[OnboardingService] Failed to send activation email for user ${userId}:`,
        error,
      );
    });
  }

  private async sendActivationEmailToRichard(
    user: User,
    richardEmail: string,
  ): Promise<void> {
    console.log(
      `[OnboardingService] Sending activation email to ${richardEmail} for user ${user.email}`,
    );

    await this.emailService.sendActivationEmail(
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        userId: user.id,
      },
      richardEmail,
    );
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