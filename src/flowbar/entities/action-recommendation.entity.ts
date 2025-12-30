import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import type { BNARecommendation } from '../types/bna-recommendation.type';
import { RecommendationStatus } from '../enums/recommendation-status.enum';

/**
 * ActionRecommendation Entity
 *
 * Stores Best Next Action recommendations for audit trail and consistency.
 * Each recommendation is tied to a specific user, date, and optional context.
 */
@Entity('action_recommendations')
@Index(['userId', 'date', 'context'])
export class ActionRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'date', comment: 'YYYY-MM-DD format' })
  date: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: 'UI context (dashboard, contacts_page, etc.)',
  })
  context: string | null;

  @Column({
    type: 'jsonb',
    comment: 'BNA recommendation (actionable or supportive guidance)',
  })
  recommendation: BNARecommendation;

  @Column({
    type: 'enum',
    enum: RecommendationStatus,
    default: RecommendationStatus.PRESENTED,
    comment: 'Recommendation lifecycle status',
  })
  status: RecommendationStatus;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When status was last updated',
  })
  statusUpdatedAt: Date | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'When action was completed (if status = COMPLETED)',
  })
  completedAt: Date | null;
}