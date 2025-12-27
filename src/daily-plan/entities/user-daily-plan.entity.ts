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
import { User, UserRole } from '../../users/entities/user.entity';
import { ActionKey } from '../enums/action-key.enum';

/**
 * UserDailyPlan Entity
 *
 * Purpose: Role-aware definition of "Today's Progress"
 *
 * Backend truth for:
 * - What "today" means (date)
 * - What counts as completion (completed_actions)
 * - What is still missing (required_actions)
 *
 * Phase 1: Computed on-demand (no caching yet)
 * Phase 2: Daily snapshot caching (similar to rhythm state snapshots)
 */
@Entity('user_daily_plans')
@Index(['userId', 'date'], { unique: true })
export class UserDailyPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * Date for this plan (YYYY-MM-DD format, UTC)
   * Allows historical tracking and future planning
   */
  @Column({ type: 'date' })
  @Index()
  date: string;

  /**
   * User role at time of computation
   * Stored for historical accuracy (role may change over time)
   */
  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  /**
   * Required actions for this user based on role baseline + state filters
   * Array of ActionKey enum values
   *
   * Example: ["licensed_check", "exam_scheduled", "license_uploaded"]
   */
  @Column({ type: 'simple-array' })
  requiredActions: ActionKey[];

  /**
   * Completed actions detected from database state
   * Array of ActionKey enum values
   *
   * Example: ["account_created", "licensed_check"]
   */
  @Column({ type: 'simple-array' })
  completedActions: ActionKey[];

  /**
   * Progress percentage (0-100)
   * Formula: (completedActions.length / requiredActions.length) * 100
   *
   * Special cases:
   * - If requiredActions is empty → 100%
   * - If no actions completed → 0%
   */
  @Column({ type: 'int' })
  progressPercent: number;

  /**
   * Next required action key (highest-leverage incomplete action)
   *
   * Phase 1: null (not implemented yet)
   * Phase 2: Cadence-influenced spotlight (not reshuffle)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  nextRequiredActionKey: ActionKey | null;

  /**
   * When this plan was computed
   */
  @Column({ type: 'timestamp' })
  computedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
