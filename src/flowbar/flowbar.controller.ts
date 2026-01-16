import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BestNextActionResolver } from './services/best-next-action-resolver.service';
import {
  ActionableRecommendationDto,
  SupportiveGuidanceDto,
} from './dto/bna-response.dto';

/**
 * FlowbarController
 *
 * Provides the Best Next Action (BNA) recommendation endpoint.
 * Returns a single, personalized action recommendation for the authenticated user.
 */
@ApiTags('flowbar')
@ApiBearerAuth()
@Controller('flowbar')
@UseGuards(JwtAuthGuard)
export class FlowbarController {
  constructor(private readonly bnaResolver: BestNextActionResolver) {}

  /**
   * GET /flowbar/guide
   *
   * Returns the best next action recommendation for the authenticated user.
   *
   * The system analyzes the user's state, daily plan, cadence alignment, and available
   * actions to determine the single most important action the user should take next.
   *
   * Response can be either:
   * 1. Actionable recommendation with a specific action to take
   * 2. Supportive guidance when no actions are available
   *
   * @param req - Authenticated request containing user info
   * @param context - Optional UI context (e.g., "dashboard", "mobile_home")
   * @returns BNA recommendation (actionable or supportive)
   */
  @Get('guide')
  @ApiOperation({
    summary: 'Get best next action recommendation',
    description:
      'Returns a personalized action recommendation based on user state, daily plan, and cadence alignment',
  })
  @ApiQuery({
    name: 'context',
    required: false,
    description:
      'UI context for the request (e.g., "dashboard", "mobile_home")',
    example: 'dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Actionable recommendation returned',
    type: ActionableRecommendationDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Supportive guidance returned',
    type: SupportiveGuidanceDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - valid JWT required',
  })
  async getGuide(
    @Req() req: any,
    @Query('context') context?: string,
  ): Promise<ActionableRecommendationDto | SupportiveGuidanceDto> {
    const userId = req.user.userId;
    return this.bnaResolver.resolve(userId, context);
  }
}
