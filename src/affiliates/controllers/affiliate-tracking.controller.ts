import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TrackVisitDto } from '../dto/track-visit.dto';
import { AffiliateTrackingService } from '../services/affiliate-tracking.service';

@ApiTags('affiliates')
@Controller('affiliates/track')
export class AffiliateTrackingController {
  constructor(
    private readonly trackingService: AffiliateTrackingService,
  ) {}

  @Post('visit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track affiliate link visit (Public)',
    description: 'Track visit to affiliate link. Provide one of: slug, referralCode, or referralLink. Used for click tracking and unique visitor counting. No authentication required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Visit tracked successfully - returns { message, visitorId, isNewVisitor, profile }',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Either slug, referralCode, or referralLink must be provided',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Affiliate profile not found',
  })
  async trackVisit(@Body() dto: TrackVisitDto) {
    return await this.trackingService.trackVisit(dto);
  }
}
