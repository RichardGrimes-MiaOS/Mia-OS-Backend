import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { AffiliateEvents } from './affiliate-events.entity';
import { User } from '../../users/entities/user.entity';

@Entity('affiliate_profiles')
@Index(['slug'], { unique: true })
@Index(['referral_code'], { unique: true })
export class AffiliateProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'text', nullable: true })
  short_bio?: string;

  @Column({ type: 'text', nullable: true })
  philosophy?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  audience_type?: string;

  @Column({ type: 'text', nullable: true })
  tone_preferences?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photo_url?: string;

  @Column({ type: 'jsonb', default: [] })
  values: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  recommended_path?: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  referral_code: string;

  @Column({ type: 'varchar', length: 255 })
  referral_link: string;

  @OneToOne(() => AffiliateEvents, (events) => events.affiliateProfile, {
    cascade: true,
  })
  events: AffiliateEvents;

  @OneToOne(() => User, (user) => user.affiliateProfile, { nullable: true })
  user?: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
