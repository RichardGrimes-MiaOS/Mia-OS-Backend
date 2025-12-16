import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminMetricsService } from './admin-metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminMetricsController {
  constructor(private readonly adminMetricsService: AdminMetricsService) {}

  @Get('activation-rate')
  async getActivationRate() {
    return await this.adminMetricsService.getActivationRate();
  }

  @Get('step-conversions')
  async getStepConversions() {
    return await this.adminMetricsService.getStepConversionMetrics();
  }

  @Get('stalled-users')
  async getStalledUsers() {
    return await this.adminMetricsService.getStalledUsers();
  }

  @Get('affiliate-performance')
  async getAffiliatePerformance() {
    return await this.adminMetricsService.getAffiliatePerformance();
  }
}