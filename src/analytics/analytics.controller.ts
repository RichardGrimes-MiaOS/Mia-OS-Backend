import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { GetEventsQueryDto } from './dto/get-events-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('events')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get user events with filters (Admin only)',
    description: 'Retrieve user events with optional filters for role and event type. Returns paginated results with user details. Tracks activity including login, role changes, and affiliate events.',
  })
  @ApiResponse({
    status: 200,
    description: 'Events retrieved successfully - returns { events: UserEvent[], total: number, limit: number, offset: number }',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getEvents(@Query() query: GetEventsQueryDto) {
    return await this.analyticsService.findEvents(query);
  }
}