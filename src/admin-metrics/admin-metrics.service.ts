import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';

export interface ActivationRateMetrics {
  overall: {
    total_approved: number;
    total_activated: number;
    activation_rate: number;
  };
  average_time_to_activation: string;
}

@Injectable()
export class AdminMetricsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get activation rate metrics
   */
  async getActivationRate(): Promise<ActivationRateMetrics> {
    // Count total approved users (agent or affiliate_only with active status)
    const totalApproved = await this.userRepository.count({
      where: {
        role: In([UserRole.AGENT, UserRole.AFFILIATE_ONLY]),
        status: UserStatus.ACTIVE,
      },
    });

    // Count total activated users (agent or affiliate_only with active status and activated_at set)
    const totalActivated = await this.userRepository.count({
      where: {
        role: In([UserRole.AGENT, UserRole.AFFILIATE_ONLY]),
        status: UserStatus.ACTIVE,
        activated_at: Not(IsNull()),
      },
    });

    // Calculate activation rate
    const overallRate =
      totalApproved > 0 ? (totalActivated / totalApproved) * 100 : 0;

    // Average time to activation (in seconds)
    const avgResult = await this.userRepository
      .createQueryBuilder('user')
      .select('AVG(user.time_to_activation)', 'avg_time')
      .where('user.role IN (:...roles)', {
        roles: [UserRole.AGENT, UserRole.AFFILIATE_ONLY],
      })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('user.activated_at IS NOT NULL')
      .andWhere('user.time_to_activation IS NOT NULL')
      .getRawOne();

    const avgTimeSeconds =
      avgResult?.avg_time && !isNaN(parseFloat(avgResult.avg_time))
        ? parseFloat(avgResult.avg_time)
        : 0;

    const formattedAvgTime = this.formatSeconds(avgTimeSeconds);

    return {
      overall: {
        total_approved: totalApproved,
        total_activated: totalActivated,
        activation_rate: parseFloat(overallRate.toFixed(2)),
      },
      average_time_to_activation: formattedAvgTime,
    };
  }

  /**
   * Format seconds to human-readable time (e.g., "5h 35m 46s")
   */
  private formatSeconds(totalSeconds: number): string {
    if (totalSeconds === 0) {
      return '0s';
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (seconds > 0 || parts.length === 0) {
      parts.push(`${seconds}s`);
    }

    return parts.join(' ');
  }
}