import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { LicensingTraining } from '../onboarding/entities/licensing-training.entity';
import { LicensingExam } from '../onboarding/entities/licensing-exam.entity';
import { EAndOInsurance } from '../onboarding/entities/e-and-o-insurance.entity';
import { ActivationRequest } from '../onboarding/entities/activation-request.entity';
import { UserOnboardingStep } from '../onboarding/entities/user-onboarding-step.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      LicensingTraining,
      LicensingExam,
      EAndOInsurance,
      ActivationRequest,
      UserOnboardingStep,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
