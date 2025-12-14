import { IsString, IsOptional, IsNotEmpty, ValidateIf } from 'class-validator';

export class TrackVisitDto {
  // Either slug, referralCode, OR referralLink must be provided
  @ValidateIf((o) => !o.referralCode && !o.referralLink)
  @IsNotEmpty({ message: 'Either slug, referralCode, or referralLink must be provided' })
  @IsString()
  slug?: string;

  @ValidateIf((o) => !o.slug && !o.referralLink)
  @IsNotEmpty({ message: 'Either slug, referralCode, or referralLink must be provided' })
  @IsString()
  referralCode?: string;

  @ValidateIf((o) => !o.slug && !o.referralCode)
  @IsNotEmpty({ message: 'Either slug, referralCode, or referralLink must be provided' })
  @IsString()
  referralLink?: string; // For affiliate_only users (e.g., "https://mia-os.io/ref/RUI71ED1")

  @IsNotEmpty()
  @IsString()
  visitorId: string; // Fingerprint or session ID from frontend

  @IsOptional()
  @IsString()
  referrer?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
