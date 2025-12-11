import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  YearsLicensed,
  ExperienceLevel,
  ProductFocus,
} from '../entities/licensed-agent-intake.entity';
import { CreateLicenseDto } from './create-license.dto';

export class CreateLicensedAgentIntakeDto {
  // License Information (array of licenses for multiple states)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLicenseDto)
  @ArrayMinSize(1, { message: 'At least one license is required' })
  licenses: CreateLicenseDto[];

  @IsEnum(YearsLicensed)
  @IsNotEmpty()
  yearsLicensed: YearsLicensed;

  @IsEnum(ExperienceLevel)
  @IsNotEmpty()
  experienceLevel: ExperienceLevel;

  @IsEnum(ProductFocus)
  @IsOptional()
  productFocus?: ProductFocus;

  // E&O Insurance Information
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  eAndODocumentPath: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eAndOCarrierName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eAndOPolicyNumber: string;

  @IsDateString()
  @IsNotEmpty()
  eAndOExpirationDate: string;

  // Debt Information
  @IsBoolean()
  @IsNotEmpty()
  hasExistingDebt: boolean;

  @IsString()
  @IsOptional()
  debtDetails?: string;

  // Previous Carriers
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  previousCarriers?: string[];
}