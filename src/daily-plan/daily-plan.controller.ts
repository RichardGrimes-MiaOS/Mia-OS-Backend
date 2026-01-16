import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DailyPlanResolverService } from './services/daily-plan-resolver.service';

@ApiTags('daily-plan')
@ApiBearerAuth()
@Controller('daily-plan')
@UseGuards(JwtAuthGuard)
export class DailyPlanController {
  constructor(
    private readonly dailyPlanResolverService: DailyPlanResolverService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Get today's daily plan",
    description: 'Pure read-only resolver that computes daily plan from existing database state. Returns required and completed actions with progress percentage. Uses static role baseline and state filters. Philosophy: Lookup + Filter, not AI magic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily plan computed successfully - returns { required_actions: ActionKey[], completed_actions: ActionKey[], progress_percent: number, next_required_action_key: ActionKey | null, computed_at: string }',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User not found',
  })
  async getDailyPlan(@Request() req: any) {
    const userId = req.user.userId;
    return this.dailyPlanResolverService.resolveDailyPlan(userId);
  }
}
