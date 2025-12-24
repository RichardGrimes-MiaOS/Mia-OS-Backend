import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CadenceController } from './cadence.controller';
import { CadenceService } from './cadence.service';
import { SSMService } from './services/ssm.service';
import { RhythmResolverService } from './services/rhythm-resolver.service';
import { CadenceLog } from './entities/cadence-log.entity';
import { RhythmStateSnapshot } from './entities/rhythm-state-snapshot.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CadenceLog, RhythmStateSnapshot]),
    ConfigModule,
    UsersModule,
  ],
  controllers: [CadenceController],
  providers: [CadenceService, SSMService, RhythmResolverService],
  exports: [CadenceService, SSMService, RhythmResolverService],
})
export class CadenceModule {}