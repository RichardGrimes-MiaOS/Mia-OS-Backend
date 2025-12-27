import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyPlanController } from './daily-plan.controller';
import { DailyPlanResolverService } from './services/daily-plan-resolver.service';
import { UserDailyPlan } from './entities/user-daily-plan.entity';
import { User } from '../users/entities/user.entity';
import { UserOnboardingStep } from '../onboarding/entities/user-onboarding-step.entity';
import { LicensedAgentIntake } from '../onboarding/entities/licensed-agent-intake.entity';
import { UserEvent } from '../analytics/entities/user-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserDailyPlan,
      User,
      UserOnboardingStep,
      LicensedAgentIntake,
      UserEvent,
    ]),
  ],
  controllers: [DailyPlanController],
  providers: [DailyPlanResolverService],
  exports: [DailyPlanResolverService],
})
export class DailyPlanModule {}