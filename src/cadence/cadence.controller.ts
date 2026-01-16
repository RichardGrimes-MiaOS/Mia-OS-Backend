import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CadenceService } from './cadence.service';
import { RhythmResolverService } from './services/rhythm-resolver.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('cadence')
@ApiBearerAuth()
@Controller('cadence')
@UseGuards(JwtAuthGuard)
export class CadenceController {
  constructor(
    private readonly cadenceService: CadenceService,
    private readonly rhythmResolver: RhythmResolverService,
  ) {}

  @Get('today')
  @ApiOperation({
    summary: "Get today's cadence log",
    description: "Retrieve today's cadence log for the authenticated user matching the current global cadence day. Returns null if no log exists for today.",
  })
  @ApiResponse({
    status: 200,
    description: "Today's cadence log retrieved successfully (or null if not found)",
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  async getTodayLog(@CurrentUser() user: User) {
    return await this.cadenceService.getTodayLog(user.id);
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get cadence history',
    description: 'Retrieve all historical cadence logs for the authenticated user, ordered by date (most recent first).',
  })
  @ApiResponse({
    status: 200,
    description: 'Cadence history retrieved successfully - returns array of CadenceLog',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  async getHistory(@CurrentUser() user: User) {
    return await this.cadenceService.getHistory(user.id);
  }

  @Get('check-rhythm')
  @ApiOperation({
    summary: 'Check rhythm state',
    description: 'Pure read-only resolver that computes rhythm state from existing CadenceLogs. Uses density-based pattern analysis with graceful degradation. Only available for agents and affiliate_only users with active status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rhythm state computed successfully - returns { rhythm_state, streak_days, weeks_on_cadence, next_threshold, days_remaining_to_next_threshold, today_status, internal_degradation, behavioral_constraints, computed_at, peer_alignment_eligible, peer_alignment_signals, peer_context_count }',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not eligible for cadence tracking. Must be agent or affiliate_only with active status.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User not found',
  })
  async checkRhythm(@CurrentUser() user: User) {
    return await this.rhythmResolver.resolveRhythmState(user.id);
  }
}
