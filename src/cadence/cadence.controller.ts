import { Controller, Get, UseGuards } from '@nestjs/common';

import { CadenceService } from './cadence.service';
import { RhythmResolverService } from './services/rhythm-resolver.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('cadence')
@UseGuards(JwtAuthGuard)
export class CadenceController {
  constructor(
    private readonly cadenceService: CadenceService,
    private readonly rhythmResolver: RhythmResolverService,
  ) {}

  @Get('today')
  async getTodayLog(@CurrentUser() user: User) {
    return await this.cadenceService.getTodayLog(user.id);
  }

  @Get('history')
  async getHistory(@CurrentUser() user: User) {
    return await this.cadenceService.getHistory(user.id);
  }

  @Get('check-rhythm')
  async checkRhythm(@CurrentUser() user: User) {
    return await this.rhythmResolver.resolveRhythmState(user.id);
  }
}
