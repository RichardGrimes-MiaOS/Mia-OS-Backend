import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { Contact } from './entities/contact.entity';
import { PipelineStage } from './entities/pipeline-stage.entity';
import { PipelineHistory } from './entities/pipeline-history.entity';
import { PipelineStageService } from './services/pipeline-stage.service';
import { PipelineHistoryService } from './services/pipeline-history.service';
import { PipelineStageSeedingService } from './services/pipeline-stage-seeding.service';
import { PipelineStageController } from './controllers/pipeline-stage.controller';
import { ActivationModule } from '../activation/activation.module';
import { FlowbarModule } from '../flowbar/flowbar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, PipelineStage, PipelineHistory]),
    ActivationModule,
    forwardRef(() => FlowbarModule), // Provides TransitionEventService for lead_created events
  ],
  providers: [
    ContactsService,
    PipelineStageService,
    PipelineHistoryService,
    PipelineStageSeedingService,
  ],
  controllers: [ContactsController, PipelineStageController],
  exports: [ContactsService, PipelineStageService],
})
export class ContactsModule {}