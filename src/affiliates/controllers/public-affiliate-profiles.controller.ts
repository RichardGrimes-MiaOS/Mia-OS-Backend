import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AffiliateProfilesService } from '../services/affiliate-profiles.service';

@ApiTags('affiliates')
@Controller('affiliates')
export class PublicAffiliateProfilesController {
  constructor(
    private readonly affiliateProfilesService: AffiliateProfilesService,
  ) {}

  @Get(':slug')
  @ApiOperation({
    summary: 'Get affiliate profile by slug (Public)',
    description: 'Retrieve affiliate profile by slug for public landing pages. No authentication required.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Affiliate slug (e.g., "john-doe")',
    type: 'string',
    example: 'john-doe',
  })
  @ApiResponse({
    status: 200,
    description: 'Affiliate profile retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Affiliate profile with this slug not found',
  })
  async findBySlug(@Param('slug') slug: string) {
    return this.affiliateProfilesService.findBySlug(slug);
  }
}
