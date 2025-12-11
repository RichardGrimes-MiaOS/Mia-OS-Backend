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

export enum YearsLicensed {
  LESS_THAN_1 = 'less_than_1',
  ONE_YEAR = '1_year',
  TWO_YEARS = '2_years',
  THREE_TO_FIVE_YEARS = '3_5_years',
  FIVE_PLUS_YEARS = '5_plus_years',
}

export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  EXPERIENCED = 'experienced',
}

export enum ProductFocus {
  HEALTH = 'health',
  LIFE = 'life',
  BOTH = 'both',
}

@Entity('licensed_agent_intake')
export class LicensedAgentIntake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // License Information (licenses stored in separate licenses table)
  @Column({
    type: 'enum',
    enum: YearsLicensed,
  })
  yearsLicensed: YearsLicensed;

  @Column({
    type: 'enum',
    enum: ExperienceLevel,
  })
  experienceLevel: ExperienceLevel;

  @Column({
    type: 'enum',
    enum: ProductFocus,
    nullable: true,
  })
  productFocus?: ProductFocus;

  // E&O Insurance Information
  @Column({ type: 'varchar', length: 500 })
  eAndODocumentPath: string;

  @Column({ type: 'varchar', length: 255 })
  eAndOCarrierName: string;

  @Column({ type: 'varchar', length: 255 })
  eAndOPolicyNumber: string;

  @Column({ type: 'date' })
  eAndOExpirationDate: Date;

  // Debt Information
  @Column({ type: 'boolean' })
  hasExistingDebt: boolean;

  @Column({ type: 'text', nullable: true })
  debtDetails?: string;

  // Previous Carriers
  @Column({ type: 'simple-array', nullable: true })
  previousCarriers?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}