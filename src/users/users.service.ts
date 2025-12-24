import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get all users with pagination
   */
  async findAll(limit = 100, offset = 0): Promise<{
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
  async findOne(userId: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id: userId },
    });
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
    return eligibleRoles.includes(user.role) && user.status === UserStatus.ACTIVE;
  }
}
