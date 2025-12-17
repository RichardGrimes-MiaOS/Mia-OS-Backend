import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GetEventsQueryDto } from './dto/get-events-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/events
   * Get user events with optional filters
   * Accessible only by admin and super_admin
   */
  @Get('events')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getEvents(@Query() query: GetEventsQueryDto) {
    return await this.analyticsService.findEvents(query);
  }
}