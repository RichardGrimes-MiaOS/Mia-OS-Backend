import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum OnboardingReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Append-only table for onboarding review submissions
 * One row = one admin review of ENTIRE onboarding snapshot
 * Stores frozen JSONB snapshot of all onboarding data at submission time
 */
@Entity('onboarding_review_submissions')
@Index(['user_id', 'created_at'])
@Index(['user_id', 'attempt_number'])
@Index(['status'])
export class OnboardingReviewSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  attempt_number: number;

  /**
   * JSONB snapshot of entire onboarding state at submission time
   * Includes: licensing_training, licensing_exam, e_and_o_insurance, license, licensed_agent_intake
   * Structure depends on user's onboarding path
   */
  @Column({ type: 'jsonb' })
  snapshot: Record<string, any>;

  @Column({
    type: 'enum',
    enum: OnboardingReviewStatus,
    default: OnboardingReviewStatus.PENDING,
  })
  status: OnboardingReviewStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer?: User;

  @Column({ type: 'timestamp', nullable: true })
  reviewed_at?: Date;

  @Column({ type: 'text', nullable: true })
  admin_notes?: string;

  @CreateDateColumn()
  created_at: Date;
}