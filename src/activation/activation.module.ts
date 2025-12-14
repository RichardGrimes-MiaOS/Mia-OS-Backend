import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivationService } from './activation.service';
import { User } from '../users/entities/user.entity';
import { Applicant } from '../applicants/entities/applicant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Applicant])],
  providers: [ActivationService],
  exports: [ActivationService],
})
export class ActivationModule {}