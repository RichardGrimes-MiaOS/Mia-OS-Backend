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

export enum ExamResult {
  PASSED = 'passed',
}

@Entity('licensing_exam')
export class LicensingExam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'boolean', default: false })
  isScheduled: boolean;

  @Column({ type: 'date', nullable: true })
  examDate?: Date;

  @Column({
    type: 'enum',
    enum: ExamResult,
    nullable: true,
  })
  result?: ExamResult;

  @Column({ type: 'varchar', length: 500, nullable: true })
  resultDocument?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
