import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowbarController } from './flowbar.controller';
import { BestNextActionResolver } from './services/best-next-action-resolver.service';
import { ActionRecommendation } from './entities/action-recommendation.entity';
import { User } from '../users/entities/user.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { DailyPlanModule } from '../daily-plan/daily-plan.module';
import { CadenceModule } from '../cadence/cadence.module';

/**
 * FlowbarModule
 *
 * Provides the Best Next Action (BNA) recommendation system.
 * Integrates with DailyPlan and Cadence systems to deliver personalized action guidance.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ActionRecommendation, User, Contact]),
    DailyPlanModule, // Provides DailyPlanResolverService
    CadenceModule, // Provides SSMService
  ],
  controllers: [FlowbarController],
  providers: [BestNextActionResolver],
  exports: [BestNextActionResolver],
})
export class FlowbarModule {}