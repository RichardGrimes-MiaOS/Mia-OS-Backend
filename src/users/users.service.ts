import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { CognitoService } from '../cognito/cognito.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
   * Update user role
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
    const repo = manager ? manager.getRepository(User) : this.userRepository;
    await repo.update(userId, { role });
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
}
