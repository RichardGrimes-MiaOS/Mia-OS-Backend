import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { UserRole } from '../../users/entities/user.entity';

export enum EventType {
  // Onboarding steps
  STEP_STARTED = 'step_started',
  STEP_COMPLETED = 'step_completed',

  // User actions
  LOGIN = 'login',
  DOCUMENT_UPLOADED = 'document_uploaded',

  // Affiliate tracking
  REFERRAL_CLICKED = 'referral_clicked',
  SIGNUP_COMPLETED = 'signup_completed',

  // Admin actions
  ADMIN_APPROVED = 'admin_approved',
  ADMIN_REJECTED = 'admin_rejected',
}

@Entity('user_events')
@Index(['user_id', 'created_at'])
@Index(['event_type', 'created_at'])
@Index(['affiliate_id', 'created_at'])
export class UserEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @Column({ type: 'varchar', length: 50 })
  event_type: EventType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  affiliate_id: string;

  @Column({ type: 'int', nullable: true })
  cadence_day: number;

  @Column({ type: 'uuid', nullable: true })
  cycle_id: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;
}