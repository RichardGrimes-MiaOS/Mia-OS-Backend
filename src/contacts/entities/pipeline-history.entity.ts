import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Contact } from './contact.entity';
import { PipelineStage } from './pipeline-stage.entity';
import { User } from '../../users/entities/user.entity';

/**
 * PipelineHistory Entity
 *
 * Append-only audit trail of all pipeline stage changes for contacts.
 * Implements event sourcing pattern for complete history tracking.
 *
 * Key features:
 * - Immutable records (never UPDATE or DELETE, only INSERT)
 * - Tracks what changed (from/to stages)
 * - Tracks who changed it (user/system/mia)
 * - Tracks why it changed (manual/automation/ai_suggested)
 * - Flexible metadata for additional context
 */
@Entity('pipeline_history')
@Index(['contactId', 'createdAt'])
@Index(['userId'])
export class PipelineHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Contact this stage change belongs to
   * CASCADE delete: if contact is deleted, history is deleted too
   */
  @Column({ type: 'uuid' })
  contactId: string;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contactId' })
  contact: Contact;

  /**
   * Previous pipeline stage
   * Nullable for initial contact creation (no previous stage)
   */
  @Column({ type: 'uuid', nullable: true })
  fromStageId?: string;

  @ManyToOne(() => PipelineStage, { nullable: true })
  @JoinColumn({ name: 'fromStageId' })
  fromStage?: PipelineStage;

  /**
   * New pipeline stage
   * Never nullable (contact must always have a stage)
   */
  @Column({ type: 'uuid' })
  toStageId: string;

  @ManyToOne(() => PipelineStage)
  @JoinColumn({ name: 'toStageId' })
  toStage: PipelineStage;

  /**
   * User who owns the contact
   * Enables filtering history by user
   */
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * Actor type who initiated the change
   * - user: Manual user action
   * - system: Automated system action
   * - mia: AI-driven suggestion/automation
   */
  @Column({ type: 'varchar', length: 50 })
  changedBy: 'user' | 'system' | 'mia';

  /**
   * Reason/mechanism for the change
   * - manual: User manually moved stage
   * - automation: Rule-based automation triggered
   * - ai_suggested: AI recommended and user/system accepted
   */
  @Column({ type: 'varchar', length: 50 })
  reason: 'manual' | 'automation' | 'ai_suggested';

  /**
   * Additional context (JSONB flexible storage)
   * Examples:
   * - { updatedBy: userId } - which user made the change
   * - { confidence: 0.85 } - AI confidence score
   * - { automationRule: ruleId } - which rule triggered
   * - { createdBy: userId } - for initial contact creation
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  /**
   * When the stage change occurred
   * Auto-managed by TypeORM
   */
  @CreateDateColumn()
  createdAt: Date;
}
