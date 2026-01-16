import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowbarController } from './flowbar.controller';
import { BestNextActionResolver } from './services/best-next-action-resolver.service';
import { TransitionEventService } from './services/transition-event.service';
import { ActionRecommendation } from './entities/action-recommendation.entity';
import { TransitionEvent } from './entities/transition-event.entity';
import { User } from '../users/entities/user.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { DailyPlanModule } from '../daily-plan/daily-plan.module';
import { CadenceModule } from '../cadence/cadence.module';

/**
 * FlowbarModule
 *
 * Provides the Best Next Action (BNA) recommendation system and transition event tracking.
 * Integrates with DailyPlan and Cadence systems to deliver personalized action guidance.
 *
 * Key services:
 * - BestNextActionResolver: Determines the best next action for a user
 * - TransitionEventService: Tracks contact lifecycle events for Flow Bar state
 *
 * Note: SQSService is provided globally via CommonModule
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ActionRecommendation, TransitionEvent, User, Contact]),
    DailyPlanModule, // Provides DailyPlanResolverService
    CadenceModule, // Provides SSMService
  ],
  controllers: [FlowbarController],
  providers: [BestNextActionResolver, TransitionEventService],
  exports: [BestNextActionResolver, TransitionEventService],
})
export class FlowbarModule {}