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
import { RoleIntent } from '../entities/applicant.entity';

export class CreateApplicantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[\d\s\-\+\(\)]+$/, {
    message: 'Phone must be a valid phone number',
  })
  @MinLength(10)
  @MaxLength(20)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organization: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  primaryState: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsEnum(RoleIntent)
  @IsNotEmpty()
  roleIntent: RoleIntent;

  @IsBoolean()
  @IsNotEmpty()
  isLicensed: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  referral_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  referral_link?: string;
}
