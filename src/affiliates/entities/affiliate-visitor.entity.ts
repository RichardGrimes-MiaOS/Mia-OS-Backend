import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AffiliateProfile } from './affiliate-profile.entity';

@Entity('affiliate_visitors')
@Index(['affiliate_profile_id', 'visitor_id'], { unique: true })
export class AffiliateVisitor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  affiliate_profile_id: string;

  @ManyToOne(() => AffiliateProfile)
  @JoinColumn({ name: 'affiliate_profile_id' })
  affiliateProfile: AffiliateProfile;

  @Column({ type: 'varchar', length: 255 })
  visitor_id: string; // Fingerprint or session ID

  @Column({ type: 'varchar', length: 500, nullable: true })
  referrer?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  user_agent?: string;

  @Column({ type: 'int', default: 1 })
  visit_count: number; // How many times this visitor came back

  @CreateDateColumn()
  first_visit: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_visit: Date;
}
