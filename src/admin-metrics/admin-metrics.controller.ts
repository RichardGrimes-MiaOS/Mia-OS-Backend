import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminMetricsService } from './admin-metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminMetricsController {
  constructor(private readonly adminMetricsService: AdminMetricsService) {}

  @Get('activation-rate')
  @ApiOperation({
    summary: 'Get activation rate metrics (Admin only)',
    description: 'Calculate overall activation rate and average time to activation for agents and affiliate_only users with active status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activation metrics calculated successfully - returns { overall: { total_approved, total_activated, activation_rate }, average_time_to_activation }',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getActivationRate() {
    return await this.adminMetricsService.getActivationRate();
  }

  @Get('step-conversions')
  @ApiOperation({
    summary: 'Get onboarding funnel step conversion metrics (Admin only)',
    description: 'Analyze conversion rates for each onboarding step. Returns entered count, completed count, completion rate, conversion to next step, average time, and drop-off count for each step.',
  })
  @ApiResponse({
    status: 200,
    description: 'Step conversion metrics calculated successfully - returns { steps: StepConversionMetrics[], overall_summary: { total_started, total_completed, overall_completion_rate } }',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getStepConversions() {
    return await this.adminMetricsService.getStepConversionMetrics();
  }

  @Get('stalled-users')
  @ApiOperation({
    summary: 'Get stalled users (Admin only)',
    description: 'Identify users stuck at onboarding steps past threshold (default 72 hours). Returns user details, stalled step, duration, hours overdue, and last completed step.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stalled users retrieved successfully - returns { stalled_users: StalledUser[], summary: { total_stalled, by_step, average_overdue_hours } }',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getStalledUsers() {
    return await this.adminMetricsService.getStalledUsers();
  }

  @Get('affiliate-performance')
  @ApiOperation({
    summary: 'Get affiliate performance metrics (Admin only)',
    description: 'Quality scoring for both affiliate profiles and user affiliates (role = affiliate_only). Returns clicks, signups, conversions, activation rate, and average time to activation for each affiliate.',
  })
  @ApiResponse({
    status: 200,
    description: 'Affiliate performance metrics calculated successfully - returns { affiliate_profiles: AffiliatePerformanceMetric[], user_affiliates: AffiliatePerformanceMetric[], summary: { total_affiliate_profiles, total_user_affiliates, combined_total_signups, combined_total_conversions, combined_total_activated, overall_activation_rate } }',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAffiliatePerformance() {
    return await this.adminMetricsService.getAffiliatePerformance();
  }
}