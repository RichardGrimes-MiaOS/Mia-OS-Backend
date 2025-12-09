import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { LicensingTraining } from './entities/licensing-training.entity';
import { LicensingExam } from './entities/licensing-exam.entity';
import { EAndOInsurance } from './entities/e-and-o-insurance.entity';
import { ActivationRequest } from './entities/activation-request.entity';
import { User } from '../users/entities/user.entity';
import { EmailModule } from '../email/email.module';
import { S3Service } from './services/s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LicensingTraining,
      LicensingExam,
      EAndOInsurance,
      ActivationRequest,
      User,
    ]),
    EmailModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService, S3Service],
  exports: [OnboardingService],
})
export class OnboardingModule {}