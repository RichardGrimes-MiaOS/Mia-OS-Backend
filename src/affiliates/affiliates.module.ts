import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateProfile } from './entities/affiliate-profile.entity';
import { AffiliateEvents } from './entities/affiliate-events.entity';
import { AffiliateUserPerformance } from './entities/affiliate-user-performance.entity';
import { AffiliateVisitor } from './entities/affiliate-visitor.entity';
import { User } from '../users/entities/user.entity';
import { AffiliateProfilesService } from './services/affiliate-profiles.service';
import { AffiliateUserPerformanceService } from './services/affiliate-user-performance.service';
import { AffiliateTrackingService } from './services/affiliate-tracking.service';
import { AdminAffiliateProfilesController } from './controllers/admin-affiliate-profiles.controller';
import { PublicAffiliateProfilesController } from './controllers/public-affiliate-profiles.controller';
import { AffiliateTrackingController } from './controllers/affiliate-tracking.controller';
import { S3Service } from '../onboarding/services/s3.service';
import { ActivationModule } from '../activation/activation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AffiliateProfile,
      AffiliateEvents,
      AffiliateUserPerformance,
      AffiliateVisitor,
      User,
    ]),
    ActivationModule,
  ],
  providers: [
    AffiliateProfilesService,
    AffiliateUserPerformanceService,
    AffiliateTrackingService,
    S3Service,
  ],
  controllers: [
    AdminAffiliateProfilesController,
    PublicAffiliateProfilesController,
    AffiliateTrackingController,
  ],
  exports: [AffiliateProfilesService, AffiliateUserPerformanceService],
})
export class AffiliatesModule {}
