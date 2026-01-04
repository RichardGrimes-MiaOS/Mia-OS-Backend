import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User, UserRole } from '../../users/entities/user.entity';

export enum EventType {
  // Onboarding steps
  STEP_STARTED = 'STEP_STARTED',
  STEP_COMPLETED = 'STEP_COMPLETED',

  // User actions
  SIGNUP_COMPLETED = 'SIGNUP_COMPLETED',
  LOGIN = 'LOGIN',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  
  // Affiliate tracking
  REFERRAL_CLICKED = 'REFERRAL_CLICKED',
  
  // Admin actions
  ADMIN_APPROVED = 'ADMIN_APPROVED',
  ADMIN_REJECTED = 'ADMIN_REJECTED',
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

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 50 })
  event_type: EventType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  affiliate_id: string;

  @Column({ type: 'int', nullable: true })
  cadence_day: number;

  @Column({ type: 'int', nullable: true })
  cycle_id: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;
}
