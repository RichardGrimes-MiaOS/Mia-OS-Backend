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
import { AffiliateProfile } from './affiliate-profile.entity';

@Entity('affiliate_events')
@Index(['affiliate_profile_id'], { unique: true })
export class AffiliateEvents {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  affiliate_profile_id: string;

  @OneToOne(() => AffiliateProfile, (profile) => profile.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'affiliate_profile_id' })
  affiliateProfile: AffiliateProfile;

  @Column({ type: 'integer', default: 0 })
  total_clicks: number;

  @Column({ type: 'integer', default: 0 })
  total_unique_visitors: number;

  @Column({ type: 'integer', default: 0 })
  total_signups: number;

  @Column({ type: 'integer', default: 0 })
  total_conversions: number;

  @Column({ type: 'float', default: 0.0 })
  total_commission: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}