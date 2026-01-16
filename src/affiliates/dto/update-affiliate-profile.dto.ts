import {
  IsString,
  IsOptional,
  IsUrl,
  IsArray,
  MaxLength,
  IsEmail,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAffiliateProfileDto {
  @ApiPropertyOptional({
    description: 'Affiliate name',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Affiliate email address',
    maxLength: 255,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: 'Short biography',
  })
  @IsOptional()
  @IsString()
  short_bio?: string;

  @ApiPropertyOptional({
    description: 'Affiliate philosophy or approach',
  })
  @IsOptional()
  @IsString()
  philosophy?: string;

  @ApiPropertyOptional({
    description: 'Target audience type',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  audience_type?: string;

  @ApiPropertyOptional({
    description: 'Communication tone preferences',
  })
  @IsOptional()
  @IsString()
  tone_preferences?: string;

  @ApiPropertyOptional({
    description: 'S3 public URL for profile photo',
  })
  @IsOptional()
  @IsUrl()
  photo_url?: string;

  @ApiPropertyOptional({
    description: 'Core values',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];

  @ApiPropertyOptional({
    description: 'Recommended onboarding path',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  recommended_path?: string;
}
