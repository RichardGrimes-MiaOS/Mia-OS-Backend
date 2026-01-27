import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * PipelineStage Entity
 *
 * Represents configurable pipeline stages for contact management.
 * Replaces hardcoded enum with database-driven configuration.
 *
 * Key features:
 * - Configurable stages with order and terminal state
 * - Active/inactive flag for soft deletion
 * - Business type categorization (insurance for v1)
 */
@Entity('pipeline_stages')
@Index(['businessType', 'active', 'order'])
export class PipelineStage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Display name of the stage
   * Example: "New Lead", "Contacted", "Closed / Won"
   */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * Programmatic key for code references
   * Example: "new_lead", "contacted", "closed_won"
   * Must be unique across all stages
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  key: string;

  /**
   * Order of stage in pipeline progression
   * Lower numbers appear first (1, 2, 3, ...)
   */
  @Column({ type: 'int' })
  order: number;

  /**
   * Indicates if this is a terminal/end state
   * Terminal stages: "closed_won", "closed_lost"
   * Normal progression stops at terminal stages
   */
  @Column({ type: 'boolean', default: false })
  isTerminal: boolean;

  /**
   * Business type/category for this pipeline
   * Example: "insurance" for v1
   * Enables multi-pipeline support in future
   */
  @Column({ type: 'varchar', length: 50, default: 'insurance' })
  businessType: string;

  /**
   * Whether this stage is currently usable
   * false = deprecated/soft deleted
   * Prevents contacts from moving to inactive stages
   */
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
