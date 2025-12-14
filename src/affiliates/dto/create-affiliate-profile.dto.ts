import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUrl,
  IsArray,
  Matches,
  MaxLength,
  IsEmail,
} from 'class-validator';

export class CreateAffiliateProfileDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

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
