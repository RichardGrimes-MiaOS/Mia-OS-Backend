import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UserEvent, EventType } from './entities/user-event.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';

export interface TrackEventDto {
  userId?: string;
  eventType: EventType;
  role?: UserRole;
  affiliateId?: string;
  cadenceDay?: number;
  cycleId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(UserEvent)
    private eventRepository: Repository<UserEvent>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Track a user event and update last_active_at
   * This is the ONLY method you should call to log events
   */
  async trackEvent(data: TrackEventDto): Promise<void> {
    // Create event record
    const event = this.eventRepository.create({
      user_id: data.userId,
      event_type: data.eventType,
      role: data.role,
      affiliate_id: data.affiliateId,
      cadence_day: data.cadenceDay,
      cycle_id: data.cycleId,
      metadata: data.metadata,
    });

    await this.eventRepository.save(event);

    // Update last_active_at if user is known
    if (data.userId) {
      await this.userRepository.update(data.userId, {
        last_active_at: new Date(),
      });
    }
  }

  /**
   * Get recent events for a user
   */
  async getEventsByUser(userId: string, limit = 100): Promise<UserEvent[]> {
    return this.eventRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get cold users (inactive for N days)
   * For admin "cold users" view
   */
  async getColdUsers(daysInactive = 7): Promise<User[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysInactive);

    return this.userRepository.find({
      where: {
        last_active_at: LessThan(cutoff),
        status: UserStatus.ACTIVE,
      },
      order: { last_active_at: 'ASC' },
    });
  }

  /**
   * Count events by type for a user
   */
  async countEventsByType(
    userId: string,
    eventType: EventType,
  ): Promise<number> {
    return this.eventRepository.count({
      where: {
        user_id: userId,
        event_type: eventType,
      },
    });
  }

  /**
   * Get events for an affiliate's referrals
   */
  async getAffiliateEvents(
    affiliateId: string,
    limit = 100,
  ): Promise<UserEvent[]> {
    return this.eventRepository.find({
      where: { affiliate_id: affiliateId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}