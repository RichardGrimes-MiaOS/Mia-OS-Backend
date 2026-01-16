import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { Contact } from './entities/contact.entity';
import { ActivationModule } from '../activation/activation.module';
import { FlowbarModule } from '../flowbar/flowbar.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact]),
    ActivationModule,
    FlowbarModule, // Provides TransitionEventService for lead_created events
  ],
  providers: [ContactsService],
  controllers: [ContactsController],
  exports: [ContactsService],
})
export class ContactsModule {}