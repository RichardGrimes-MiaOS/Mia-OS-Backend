import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterAffiliateProfileDto {
  @ApiPropertyOptional({
    description: 'Search by name or slug',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by target audience type',
  })
  @IsOptional()
  @IsString()
  audience_type?: string;
}
