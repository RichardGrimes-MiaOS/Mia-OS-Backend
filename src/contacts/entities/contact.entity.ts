import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PipelineStage } from './pipeline-stage.entity';

@Entity('contacts')
@Index(['userId'])
@Index(['currentPipelineStageId'])
@Index(['userId', 'currentPipelineStageId'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  /**
   * Current pipeline stage (FK to PipelineStage)
   * Replaces old enum column with database-driven stage
   */
  @Column({ type: 'uuid' })
  currentPipelineStageId: string;

  @ManyToOne(() => PipelineStage)
  @JoinColumn({ name: 'currentPipelineStageId' })
  currentPipelineStage: PipelineStage;

  /**
   * Timestamp of last pipeline stage change
   * Enables tracking stage change frequency and recency
   */
  @Column({ type: 'timestamp', nullable: true })
  pipelineUpdatedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt?: Date;

  @OneToMany('Task', 'contact')
  tasks: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}