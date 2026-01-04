import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { LicensingTraining } from './entities/licensing-training.entity';
import { LicensingExam } from './entities/licensing-exam.entity';
import { LicensingExamAttempt } from './entities/licensing-exam-attempt.entity';
import { EAndOInsurance } from './entities/e-and-o-insurance.entity';
import { OnboardingReviewSubmission } from './entities/onboarding-review-submission.entity';
import { ActivationRequest } from './entities/activation-request.entity';
import { LicensedAgentIntake } from './entities/licensed-agent-intake.entity';
import { License } from './entities/license.entity';
import { UserOnboardingStep } from './entities/user-onboarding-step.entity';
import { User } from '../users/entities/user.entity';
import { EmailModule } from '../email/email.module';
import { S3Service } from './services/s3.service';
import { OnboardingStepsService } from './services/onboarding-steps.service';
import { LicensingTrainingService } from './services/licensing-training.service';
import { LicensingExamService } from './services/licensing-exam.service';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LicensingTraining,
      LicensingExam,
      LicensingExamAttempt,
      EAndOInsurance,
      OnboardingReviewSubmission,
      ActivationRequest,
      LicensedAgentIntake,
      License,
      User,
      UserOnboardingStep,
    ]),
    EmailModule,
    AffiliatesModule,
    AnalyticsModule,
    UsersModule,
  ],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    S3Service,
    OnboardingStepsService,
    LicensingTrainingService,
    LicensingExamService,
  ],
  exports: [OnboardingService, OnboardingStepsService],
})
export class OnboardingModule {}