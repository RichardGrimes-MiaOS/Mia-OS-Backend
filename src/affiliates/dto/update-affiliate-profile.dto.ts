import {
  IsString,
  IsOptional,
  IsUrl,
  IsArray,
  MaxLength,
  IsEmail,
} from 'class-validator';

export class UpdateAffiliateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  short_bio?: string;

  @IsOptional()
  @IsString()
  philosophy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  audience_type?: string;

  @IsOptional()
  @IsString()
  tone_preferences?: string;

  @IsOptional()
  @IsUrl()
  photo_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recommended_path?: string;
}
