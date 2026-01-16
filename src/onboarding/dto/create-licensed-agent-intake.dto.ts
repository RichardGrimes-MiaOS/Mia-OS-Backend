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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  YearsLicensed,
  ExperienceLevel,
  ProductFocus,
} from '../entities/licensed-agent-intake.entity';
import { CreateLicenseDto } from './create-license.dto';

export class CreateLicensedAgentIntakeDto {
  // License Information (array of licenses for multiple states)
  @ApiProperty({
    description: 'Array of license records for multiple states',
    type: [CreateLicenseDto],
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLicenseDto)
  @ArrayMinSize(1, { message: 'At least one license is required' })
  licenses: CreateLicenseDto[];

  @ApiProperty({
    enum: YearsLicensed,
    description: 'Years licensed',
    example: YearsLicensed.THREE_TO_FIVE_YEARS,
  })
  @IsEnum(YearsLicensed)
  @IsNotEmpty()
  yearsLicensed: YearsLicensed;

  @ApiProperty({
    enum: ExperienceLevel,
    description: 'Experience level',
    example: ExperienceLevel.INTERMEDIATE,
  })
  @IsEnum(ExperienceLevel)
  @IsNotEmpty()
  experienceLevel: ExperienceLevel;

  @ApiPropertyOptional({
    enum: ProductFocus,
    description: 'Product focus area',
    example: ProductFocus.BOTH,
  })
  @IsEnum(ProductFocus)
  @IsOptional()
  productFocus?: ProductFocus;

  // E&O Insurance Information
  @ApiProperty({
    description: 'S3 key for E&O insurance document',
    example: 'e-and-o/user-uuid/policy.pdf',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  eAndODocumentPath: string;

  @ApiProperty({
    description: 'E&O insurance carrier name',
    example: 'Hiscox',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eAndOCarrierName: string;

  @ApiProperty({
    description: 'E&O policy number',
    example: 'POL-67890',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  eAndOPolicyNumber: string;

  @ApiProperty({
    description: 'E&O expiration date (ISO 8601 format)',
    example: '2027-12-31',
  })
  @IsDateString()
  @IsNotEmpty()
  eAndOExpirationDate: string;

  // Debt Information
  @ApiProperty({
    description: 'Whether agent has existing debt',
    example: false,
  })
  @IsBoolean()
  @IsNotEmpty()
  hasExistingDebt: boolean;

  @ApiPropertyOptional({
    description: 'Details about existing debt if applicable',
    example: 'Student loan debt from previous career',
  })
  @IsString()
  @IsOptional()
  debtDetails?: string;

  // Previous Carriers
  @ApiPropertyOptional({
    description: 'List of previous insurance carriers',
    type: [String],
    example: ['Carrier A', 'Carrier B'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  previousCarriers?: string[];
}