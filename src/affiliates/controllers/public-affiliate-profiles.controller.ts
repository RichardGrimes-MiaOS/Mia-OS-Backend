import { Controller, Get, Param } from '@nestjs/common';
import { AffiliateProfilesService } from '../services/affiliate-profiles.service';

@Controller('affiliates')
export class PublicAffiliateProfilesController {
  constructor(
    private readonly affiliateProfilesService: AffiliateProfilesService,
  ) {}

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.affiliateProfilesService.findBySlug(slug);
  }
}
