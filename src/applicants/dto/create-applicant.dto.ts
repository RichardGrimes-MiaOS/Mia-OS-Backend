import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Matches,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleIntent } from '../entities/applicant.entity';

export class CreateApplicantDto {
  @ApiProperty({
    description: 'First name of the applicant',
    example: 'John',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({
    description: 'Last name of the applicant',
    example: 'Doe',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({
    description: 'Email address of the applicant',
    example: 'john.doe@example.com',
    maxLength: 255,
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Phone number of the applicant',
    example: '+1-555-123-4567',
    minLength: 10,
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\d\s\-\+\(\)]+$/, {
    message: 'Phone must be a valid phone number',
  })
  @MinLength(10)
  @MaxLength(20)
  phone: string;

  @ApiProperty({
    description: 'Organization or company name',
    example: 'Acme Insurance',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organization: string;

  @ApiProperty({
    description: 'Primary state where the applicant operates',
    example: 'California',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  primaryState: string;

  @ApiPropertyOptional({
    description: 'Purpose or reason for applying',
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiProperty({
    enum: RoleIntent,
    description: 'Intended role: join_agency or external',
    example: RoleIntent.JOIN_AGENCY,
  })
  @IsEnum(RoleIntent)
  @IsNotEmpty()
  roleIntent: RoleIntent;

  @ApiProperty({
    description: 'Whether the applicant is already licensed',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isLicensed: boolean;

  @ApiPropertyOptional({
    description: 'Referral code',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  referral_code?: string;

  @ApiPropertyOptional({
    description: 'Referral link',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referral_link?: string;
}
