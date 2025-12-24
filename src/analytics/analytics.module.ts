import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { UserEvent } from './entities/user-event.entity';
import { User } from '../users/entities/user.entity';
import { SSMService } from '../cadence/services/ssm.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEvent, User]), ConfigModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, SSMService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}