import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('affiliate_user_performance')
@Index(['user_id'], { unique: true })
export class AffiliateUserPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  user_id: string;

  @OneToOne(() => User, (user) => user.performance, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'integer', default: 0 })
  referrals_made: number;

  @Column({ type: 'integer', default: 0 })
  referrals_clicks: number;

  @Column({ type: 'integer', default: 0 })
  referrals_converted: number;

  @Column({ type: 'float', default: 0.0 })
  commission_earned: number;

  @Column({ type: 'jsonb', default: [] })
  payout_history: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}