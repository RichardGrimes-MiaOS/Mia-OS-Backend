import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TrackVisitDto } from '../dto/track-visit.dto';
import { AffiliateTrackingService } from '../services/affiliate-tracking.service';

@Controller('affiliates/track')
export class AffiliateTrackingController {
  constructor(
    private readonly trackingService: AffiliateTrackingService,
  ) {}

  /**
   * Public endpoint to track affiliate link visits
   * POST /api/affiliates/track/visit
   *
   * Body: {
   *   "slug": "john-doe" OR "referralCode": "D94SRH4A",
   *   "visitorId": "unique-fingerprint-or-session-id",
   *   "referrer": "https://google.com" (optional),
   *   "userAgent": "Mozilla/5.0..." (optional)
   * }
   */
  @Post('visit')
  @HttpCode(HttpStatus.OK)
  async trackVisit(@Body() dto: TrackVisitDto) {
    return await this.trackingService.trackVisit(dto);
  }
}
