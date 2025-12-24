import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CadenceEventType } from '../enums/event-type.enum';

@Entity('cadence_logs')
export class CadenceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date', comment: 'User-local timezone date (YYYY-MM-DD)' })
  logDate: string;

  @Column({ type: 'int', comment: 'Cadence day number (1-10)' })
  cadenceDayNumber: number;

  @Column({ type: 'uuid', nullable: true })
  cycleId: string | null;

  @Column({
    type: 'enum',
    enum: CadenceEventType,
  })
  eventType: CadenceEventType;

  @Column({ type: 'varchar', nullable: true })
  actionKey: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
