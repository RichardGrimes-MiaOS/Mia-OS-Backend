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
} from 'typeorm';

export enum UserRole {
  APPLICANT = 'applicant',
  AGENT = 'agent',
  AFFILIATE = 'affiliate',
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}