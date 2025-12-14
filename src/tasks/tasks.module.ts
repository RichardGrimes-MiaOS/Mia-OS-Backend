import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { ActivationModule } from '../activation/activation.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Contact]), ActivationModule],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}