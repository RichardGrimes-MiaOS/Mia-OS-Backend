import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { CognitoService } from '../cognito/cognito.service';
import { LicensingTraining } from '../onboarding/entities/licensing-training.entity';
import { LicensingExam } from '../onboarding/entities/licensing-exam.entity';
import { EAndOInsurance } from '../onboarding/entities/e-and-o-insurance.entity';
import { ActivationRequest } from '../onboarding/entities/activation-request.entity';
import { UserOnboardingStep } from '../onboarding/entities/user-onboarding-step.entity';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

/**
 * Response structure for a single user with onboarding details
 */
export interface AdminUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  status: string;
  isLicensed: boolean;
  onboardingStatus: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  activatedAt: Date | null;
  onboarding: {
    licensingTraining: {
      completed: boolean;
      registeredAt: Date | null;
      registrationScreenshot: string | null;
    };
    licensingExam: {
      completed: boolean;
      result: string | null;
      examDate: Date | null;
      resultDocument: string | null;
    };
    eAndOInsurance: {
      uploaded: boolean;
      expirationDate: Date | null;
      documentPath: string | null;
      carrierName: string | null;
      policyNumber: string | null;
    };
    activation: {
      status: string | null;
      requestedAt: Date | null;
      approvedAt: Date | null;
    };
    currentStep: string | null;
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LicensingTraining)
    private readonly licensingTrainingRepository: Repository<LicensingTraining>,
    @InjectRepository(LicensingExam)
    private readonly licensingExamRepository: Repository<LicensingExam>,
    @InjectRepository(EAndOInsurance)
    private readonly eAndOInsuranceRepository: Repository<EAndOInsurance>,
    @InjectRepository(ActivationRequest)
    private readonly activationRequestRepository: Repository<ActivationRequest>,
    @InjectRepository(UserOnboardingStep)
    private readonly onboardingStepRepository: Repository<UserOnboardingStep>,
    private cognitoService: CognitoService,
  ) {}

  /**
   * Get all users with pagination
   */
  async findAll(
    limit = 100,
    offset = 0,
  ): Promise<{
    users: User[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const [users, total] = await this.userRepository.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      users,
      total,
      limit,
      offset,
    };
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id: userId },
    });
  }

  /**
   * Find user by ID or throw NotFoundException
   */
  async findByIdOrFail(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Update user role in both database and Cognito
   *
   * Important: This method updates the role in both systems to keep them in sync.
   * The Cognito custom:role attribute is used for JWT token claims and authorization.
   *
   * @param userId - User ID to update
   * @param role - New role to set
   * @param manager - Optional EntityManager for transaction support
   */
  async updateRole(
    userId: string,
    role: UserRole,
    manager?: EntityManager,
  ): Promise<void> {
    // Get user to retrieve email for Cognito update
    const repo = manager ? manager.getRepository(User) : this.userRepository;
    const user = await repo.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update database
    await repo.update(userId, { role });

    // Update Cognito custom:role attribute to keep JWT tokens in sync
    // Note: This is outside the DB transaction, but role updates are idempotent
    // and the Cognito state will be correct even if called multiple times
    await this.cognitoService.adminUpdateUserAttributes(user.email, [
      { Name: 'custom:role', Value: role },
    ]);

    console.log(
      `[UsersService] Updated role for user ${userId} to ${role} in both database and Cognito`,
    );
  }

  /**
   * Update user activation data (onboarding completion)
   *
   * @param userId - User ID to update
   * @param activatedAt - Activation timestamp
   * @param timeToActivation - Time to activation in seconds (optional)
   * @param manager - Optional EntityManager for transaction support
   */
  async updateActivationData(
    userId: string,
    activatedAt: Date,
    timeToActivation: number | null,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(User) : this.userRepository;
    const updateData: any = {
      activated_at: activatedAt,
    };
    if (timeToActivation !== null) {
      updateData.time_to_activation = timeToActivation;
    }
    await repo.update(userId, updateData);
  }

  /**
   * Clear user activation data (when rejecting activation)
   * Uses raw SQL to set NULL values which TypeORM update() doesn't support well
   *
   * @param userId - User ID to update
   * @param manager - Optional EntityManager for transaction support
   */
  async clearActivationData(
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (manager) {
      await manager.query(
        `UPDATE users SET activated_at = NULL, time_to_activation = NULL WHERE id = $1`,
        [userId],
      );
    } else {
      await this.userRepository.query(
        `UPDATE users SET activated_at = NULL, time_to_activation = NULL WHERE id = $1`,
        [userId],
      );
    }
  }

  /**
   * Find user by email
   * Checks both database and Cognito to ensure user exists in both systems
   *
   * @param email - The email to search for
   * @returns User if found in both database and Cognito, null otherwise
   */
  async findByEmail(email: string): Promise<User | null> {
    // Check database first
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      return null;
    }

    // Verify user also exists in Cognito
    const existsInCognito = await this.cognitoService.userExists(email);

    if (!existsInCognito) {
      console.warn(
        `[UsersService] User ${email} exists in database but not in Cognito`,
      );
      return null;
    }

    return user;
  }

  /**
   * Check if user is eligible for cadence tracking
   * (role: agent or affiliate_only, status: active)
   */
  async isEligibleForCadence(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'role', 'status'],
    });

    if (!user) {
      return false;
    }

    const eligibleRoles = [UserRole.AGENT, UserRole.AFFILIATE_ONLY];
    return (
      eligibleRoles.includes(user.role) && user.status === UserStatus.ACTIVE
    );
  }

  /**
   * Get agent profile for MCP tools (Phase 1)
   *
   * Returns essential agent information including:
   * - Basic user info (name, email, phone)
   * - Role and status
   * - Onboarding status
   * - Key timestamps (joined, last login, last active, approved, activated)
   * - Licensing status
   * - Creator information
   *
   * @param userId - User ID to get profile for
   * @returns Agent profile information
   */
  async getAgentProfile(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['createdBy'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      // Basic info
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,

      // Role and status
      role: user.role,
      status: user.status,
      onboardingStatus: user.onboardingStatus,

      // Licensing
      isLicensed: user.isLicensed,

      // Timestamps
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      lastActiveAt: user.last_active_at,
      approvedAt: user.approved_at,

      // Creator info
      createdBy: user.createdBy
        ? {
            name: `${user.createdBy.firstName} ${user.createdBy.lastName}`,
            email: user.createdBy.email,
          }
        : null,
    };
  }

  /**
   * Get all users with onboarding details and optional filters (Admin only)
   *
   * @param query - Filter and pagination options
   * @returns Paginated list of users with onboarding details
   */
  async findAllWithOnboarding(query: ListUsersQueryDto): Promise<{
    users: AdminUserResponse[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const {
      role,
      status,
      isLicensed,
      onboardingStatus,
      limit = 50,
      offset = 0,
    } = query;

    // Build query with filters
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Always exclude admin and super-admin users from results
    queryBuilder.andWhere('user.role NOT IN (:...excludedRoles)', {
      excludedRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
    });

    // If role filter is provided, only allow non-admin roles
    if (role && role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    if (isLicensed !== undefined) {
      queryBuilder.andWhere('user.isLicensed = :isLicensed', { isLicensed });
    }

    if (onboardingStatus) {
      queryBuilder.andWhere('user.onboardingStatus = :onboardingStatus', {
        onboardingStatus,
      });
    }

    // Get total count before pagination
    const total = await queryBuilder.getCount();

    // Apply pagination and ordering
    queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const users = await queryBuilder.getMany();

    // Fetch onboarding details for all users in batch
    const userIds = users.map((u) => u.id);

    if (userIds.length === 0) {
      return { users: [], total, limit, offset };
    }

    // Batch fetch all related onboarding data
    const [trainings, exams, insurances, activations, steps] =
      await Promise.all([
        this.licensingTrainingRepository
          .createQueryBuilder('lt')
          .where('lt.userId IN (:...userIds)', { userIds })
          .getMany(),
        this.licensingExamRepository
          .createQueryBuilder('le')
          .where('le.userId IN (:...userIds)', { userIds })
          .getMany(),
        this.eAndOInsuranceRepository
          .createQueryBuilder('eo')
          .where('eo.userId IN (:...userIds)', { userIds })
          .getMany(),
        this.activationRequestRepository
          .createQueryBuilder('ar')
          .where('ar.userId IN (:...userIds)', { userIds })
          .getMany(),
        this.onboardingStepRepository
          .createQueryBuilder('os')
          .where('os.userId IN (:...userIds)', { userIds })
          .andWhere('os.completedAt IS NULL') // Current step = not completed
          .getMany(),
      ]);

    // Create lookup maps for efficient access
    const trainingMap = new Map(trainings.map((t) => [t.userId, t]));
    const examMap = new Map(exams.map((e) => [e.userId, e]));
    const insuranceMap = new Map(insurances.map((i) => [i.userId, i]));
    const activationMap = new Map(activations.map((a) => [a.userId, a]));
    const stepMap = new Map(steps.map((s) => [s.userId, s]));

    // Map users with onboarding details
    const usersWithOnboarding: AdminUserResponse[] = users.map((user) => {
      const training = trainingMap.get(user.id);
      const exam = examMap.get(user.id);
      const insurance = insuranceMap.get(user.id);
      const activation = activationMap.get(user.id);
      const currentStep = stepMap.get(user.id);

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || null,
        role: user.role,
        status: user.status,
        isLicensed: user.isLicensed,
        onboardingStatus: user.onboardingStatus || null,
        createdAt: user.createdAt,
        approvedAt: user.approved_at || null,
        activatedAt: user.activated_at || null,
        onboarding: {
          licensingTraining: {
            completed: training?.isRegistered ?? false,
            registeredAt: training?.createdAt || null,
            registrationScreenshot: training?.registrationScreenshot || null,
          },
          licensingExam: {
            completed: exam?.result === 'passed',
            result: exam?.result || null,
            examDate: exam?.examDate || null,
            resultDocument: exam?.resultDocument || null,
          },
          eAndOInsurance: {
            uploaded: insurance != null,
            expirationDate: insurance?.expirationDate || null,
            documentPath: insurance?.documentPath || null,
            carrierName: insurance?.carrierName || null,
            policyNumber: insurance?.policyNumber || null,
          },
          activation: {
            status: activation?.status || null,
            requestedAt: activation?.createdAt || null,
            approvedAt: activation?.approvedAt || null,
          },
          currentStep: currentStep?.stepKey || null,
        },
      };
    });

    return {
      users: usersWithOnboarding,
      total,
      limit,
      offset,
    };
  }
}
