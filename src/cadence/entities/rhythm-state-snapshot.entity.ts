import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RhythmState } from '../enums/rhythm-state.enum';

@Entity('rhythm_state_snapshots')
export class RhythmStateSnapshot {
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: RhythmState,
    default: RhythmState.NOT_STARTED,
  })
  rhythmState: RhythmState;

  @Column({ type: 'int', default: 0, comment: 'Always 0 in Phase 1 MVP' })
  streakDays: number;

  @Column({ type: 'int', default: 0, comment: 'Floor(consecutive_days / 7)' })
  weeksOnCadence: number;

  @Column({ type: 'int', nullable: true, comment: 'Count of compliant days in last 21 days (optional)' })
  onCadenceDaysLast21: number | null;

  @Column({ type: 'date', nullable: true, comment: 'Last date with ACTION_COMPLETED or MILESTONE' })
  lastCadenceCompliantDate: string | null;

  @Column({ type: 'varchar', comment: 'INCOMPLETE | COMPLETE' })
  todayStatus: string;

  @Column({ type: 'varchar', nullable: true, comment: 'Next rhythm state to reach' })
  nextThreshold: string | null;

  @Column({ type: 'int', default: 0, comment: 'Days remaining to reach next threshold' })
  daysRemainingToNextThreshold: number;

  @Column({ type: 'timestamptz', comment: 'When this snapshot was last computed' })
  computedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}