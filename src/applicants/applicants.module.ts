import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicantsService } from './applicants.service';
import { ApplicantsController } from './applicants.controller';
import { Applicant } from './entities/applicant.entity';
import { User } from '../users/entities/user.entity';
import { AffiliateProfile } from '../affiliates/entities/affiliate-profile.entity';
import { AffiliateEvents } from '../affiliates/entities/affiliate-events.entity';
import { AffiliateUserPerformance } from '../affiliates/entities/affiliate-user-performance.entity';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { ActivationModule } from '../activation/activation.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Applicant,
      User,
      AffiliateProfile,
      AffiliateEvents,
      AffiliateUserPerformance,
    ]),
    EmailModule,
    forwardRef(() => AuthModule),
    ActivationModule,
    OnboardingModule,
  ],
  controllers: [ApplicantsController],
  providers: [ApplicantsService],
  exports: [ApplicantsService],
})
export class ApplicantsModule {}
