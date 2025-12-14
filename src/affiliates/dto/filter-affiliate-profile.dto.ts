import { IsOptional, IsString } from 'class-validator';

export class FilterAffiliateProfileDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  audience_type?: string;
}
