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
import { ExamResult } from './licensing-exam.entity';

/**
 * Append-only table for licensing exam attempts
 * Every submission creates a new row, preserving full history
 */
@Entity('licensing_exam_attempts')
@Index(['user_id', 'created_at'])
@Index(['user_id', 'attempt_number'])
export class LicensingExamAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  attempt_number: number;

  @Column({ type: 'date', nullable: true })
  exam_date?: Date;

  @Column({
    type: 'enum',
    enum: ExamResult,
    nullable: true,
  })
  result?: ExamResult;

  @Column({ type: 'varchar', length: 500, nullable: true })
  result_screenshot?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submitted_at: Date;

  @CreateDateColumn()
  created_at: Date;
}