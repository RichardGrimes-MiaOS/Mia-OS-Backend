import { IsString, IsOptional, IsNotEmpty, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TrackVisitDto {
  // Either slug, referralCode, OR referralLink must be provided
  @ApiPropertyOptional({
    description: 'Affiliate slug (e.g., "john-doe"). Provide one of: slug, referralCode, or referralLink',
  })
  @ValidateIf((o) => !o.referralCode && !o.referralLink)
  @IsNotEmpty({ message: 'Either slug, referralCode, or referralLink must be provided' })
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Referral code (e.g., "D94SRH4A"). Provide one of: slug, referralCode, or referralLink',
  })
  @ValidateIf((o) => !o.slug && !o.referralLink)
  @IsNotEmpty({ message: 'Either slug, referralCode, or referralLink must be provided' })
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({
    description: 'Full referral link for affiliate_only users (e.g., "https://mia-os.io/ref/RUI71ED1"). Provide one of: slug, referralCode, or referralLink',
  })
  @ValidateIf((o) => !o.slug && !o.referralCode)
  @IsNotEmpty({ message: 'Either slug, referralCode, or referralLink must be provided' })
  @IsString()
  referralLink?: string;

  @ApiProperty({
    description: 'Unique visitor ID from fingerprint or session ID',
    example: 'fp_1234567890abcdef',
  })
  @IsNotEmpty()
  @IsString()
  visitorId: string;

  @ApiPropertyOptional({
    description: 'Referrer URL',
  })
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiPropertyOptional({
    description: 'User agent string',
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}
