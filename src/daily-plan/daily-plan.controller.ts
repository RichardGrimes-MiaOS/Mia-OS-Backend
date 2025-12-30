import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyPlanResolverService } from './services/daily-plan-resolver.service';

@Controller('daily-plan')
@UseGuards(JwtAuthGuard)
export class DailyPlanController {
  constructor(
    private readonly dailyPlanResolverService: DailyPlanResolverService,
  ) {}

  /**
   * GET /daily-plan
   *
   * Returns today's progress for the authenticated user
   *
   * Response:
   * {
   *   "required_actions": ["exam_scheduled", "license_uploaded"],
   *   "completed_actions": ["account_created", "licensed_check"],
   *   "progress_percent": 50,
   *   "next_required_action_key": null,
   *   "computed_at": "2025-12-25T10:30:00.000Z"
   * }
   */
  @Get()
  async getDailyPlan(@Request() req: any) {
    const userId = req.user.userId;
    return this.dailyPlanResolverService.resolveDailyPlan(userId);
  }
}
