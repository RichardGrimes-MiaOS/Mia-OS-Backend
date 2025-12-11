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
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class ApplicantsService {
  constructor(
    @InjectRepository(Applicant)
    private readonly applicantRepository: Repository<Applicant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
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
      const existingUser = await this.userRepository.findOne({
        where: { email: createApplicantDto.email },
      });

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
    applicant.status = updateStatusDto.status;
    applicant.updatedById = updatedById;

    try {
      // Save the status and updatedById first
      const savedApplicant = await this.applicantRepository.save(applicant);

      // If status changed to ACCEPTED, create user account
      if (
        oldStatus !== ApplicantStatus.ACCEPTED &&
        updateStatusDto.status === ApplicantStatus.ACCEPTED
      ) {
        // Pass the saved applicant to ensure updatedById is persisted
        await this.createUserFromApplicant(savedApplicant);
      }

      // Reload applicant with relations to return complete data
      return await this.findOne(id);
    } catch (error) {
      throw new BadRequestException('Failed to update applicant status');
    }
  }

  /**
   * Create a user account from an approved applicant
   */
  private async createUserFromApplicant(applicant: Applicant): Promise<void> {
    try {
      // Create user with temporary password

      const { user, temporaryPassword } = await this.authService.createUser(
        applicant.email,
        applicant.firstName,
        applicant.lastName,
        applicant.phone,
        UserRole.APPLICANT, // Start as applicant, will be promoted to agent after onboarding
        applicant.updatedById, // Track which admin approved/created the user
      );
      console.log(temporaryPassword);

      // Copy isLicensed from applicant to user
      await this.userRepository.update(user.id, {
        isLicensed: applicant.isLicensed,
      });

      // Link applicant to created user - only update userId without overwriting other fields
      await this.applicantRepository.update(applicant.id, {
        userId: user.id,
      });

      console.log(
        `[ApplicantsService] Linked applicant ${applicant.id} to user ${user.id}`,
      );

      // Send welcome email with temporary credentials
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
    } catch (error) {
      console.error(
        `[ApplicantsService] Failed to create user from applicant ${applicant.id}:`,
      );
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Full error:`, error);
      // Don't throw - we don't want to fail the status update if user creation fails
      // Admin can manually retry or create the user
    }
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
}
