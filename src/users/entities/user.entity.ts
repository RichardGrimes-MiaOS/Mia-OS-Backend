import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { ActivationActionType } from '../enums/activation-action-type.enum';

export enum UserRole {
  APPLICANT = 'applicant',
  AGENT = 'agent',
  AFFILIATE = 'affiliate',
  AFFILIATE_ONLY = 'affiliate_only',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super-admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum OnboardingStatus {
  IN_PROGRESS = 'in_progress',
  LICENSED = 'licensed',
  PENDING_ACTIVATION = 'pending_activation',
  ONBOARDED = 'onboarded',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  cognitoSub: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.APPLICANT,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin?: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_active_at?: Date;

  @Column({ type: 'boolean', default: false })
  isLicensed: boolean;

  @Column({
    type: 'enum',
    enum: OnboardingStatus,
    nullable: true,
  })
  onboardingStatus?: OnboardingStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User;

  @Column({ type: 'uuid', nullable: true })
  createdById?: string;

  @OneToMany('Contact', 'user')
  contacts: any[];

  @Column({ type: 'uuid', nullable: true })
  affiliate_profile_id?: string;

  @OneToOne('AffiliateProfile', 'user', { nullable: true })
  @JoinColumn({ name: 'affiliate_profile_id' })
  affiliateProfile?: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  referral_link?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  qr_code_url?: string;

  @OneToOne('AffiliateUserPerformance', 'user', { nullable: true })
  performance?: any;

  // Activation tracking fields
  @Column({ type: 'timestamp', nullable: true })
  approved_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  activated_at?: Date;

  @Column({ type: 'integer', nullable: true })
  time_to_activation?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  activation_source?: string;

  @Column({ type: 'integer', nullable: true })
  activation_cadence_day?: number;

  @Column({ type: 'enum', enum: ActivationActionType, nullable: true })
  activation_action_type?: ActivationActionType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
