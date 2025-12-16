import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum OnboardingStepKey {
  ACCOUNT_CREATED = 'account_created',
  LICENSED_CHECK = 'licensed_check',
  EXAM_SCHEDULED = 'exam_scheduled',
  LICENSE_UPLOADED = 'license_uploaded',
  EO_UPLOADED = 'e&o_uploaded',
  ACTIVATION_UNLOCKED = 'activation_unlocked',
}

@Entity('user_onboarding_steps')
@Index(['userId', 'stepKey'], { unique: true })
export class UserOnboardingStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: OnboardingStepKey,
  })
  @Index()
  stepKey: OnboardingStepKey;

  @Column({ type: 'timestamp' })
  enteredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}