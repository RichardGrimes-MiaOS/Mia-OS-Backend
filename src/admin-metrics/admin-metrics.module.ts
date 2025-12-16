import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminMetricsController } from './admin-metrics.controller';
import { AdminMetricsService } from './admin-metrics.service';
import { User } from '../users/entities/user.entity';
import { UserOnboardingStep } from '../onboarding/entities/user-onboarding-step.entity';
import { AffiliateProfile } from '../affiliates/entities/affiliate-profile.entity';
import { AffiliateEvents } from '../affiliates/entities/affiliate-events.entity';
import { AffiliateUserPerformance } from '../affiliates/entities/affiliate-user-performance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserOnboardingStep,
      AffiliateProfile,
      AffiliateEvents,
      AffiliateUserPerformance,
    ]),
  ],
  controllers: [AdminMetricsController],
  providers: [AdminMetricsService],
  exports: [AdminMetricsService],
})
export class AdminMetricsModule {}