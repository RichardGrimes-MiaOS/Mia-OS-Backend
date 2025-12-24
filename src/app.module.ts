import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_PIPE, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApplicantsModule } from './applicants/applicants.module';
import { AuthModule } from './auth/auth.module';
import { Applicant } from './applicants/entities/applicant.entity';
import { User } from './users/entities/user.entity';
import { LicensingTraining } from './onboarding/entities/licensing-training.entity';
import { LicensingExam } from './onboarding/entities/licensing-exam.entity';
import { LicensingExamAttempt } from './onboarding/entities/licensing-exam-attempt.entity';
import { EAndOInsurance } from './onboarding/entities/e-and-o-insurance.entity';
import { OnboardingReviewSubmission } from './onboarding/entities/onboarding-review-submission.entity';
import { ActivationRequest } from './onboarding/entities/activation-request.entity';
import { LicensedAgentIntake } from './onboarding/entities/licensed-agent-intake.entity';
import { License } from './onboarding/entities/license.entity';
import { Contact } from './contacts/entities/contact.entity';
import { Task } from './tasks/entities/task.entity';
import { AffiliateProfile } from './affiliates/entities/affiliate-profile.entity';
import { AffiliateEvents } from './affiliates/entities/affiliate-events.entity';
import { AffiliateUserPerformance } from './affiliates/entities/affiliate-user-performance.entity';
import { AffiliateVisitor } from './affiliates/entities/affiliate-visitor.entity';
import { UserOnboardingStep } from './onboarding/entities/user-onboarding-step.entity';
import { UserEvent } from './analytics/entities/user-event.entity';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HealthModule } from './health/health.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ContactsModule } from './contacts/contacts.module';
import { TasksModule } from './tasks/tasks.module';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { ActivationModule } from './activation/activation.module';
import { AdminMetricsModule } from './admin-metrics/admin-metrics.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UsersModule } from './users/users.module';
import { CadenceModule } from './cadence/cadence.module';
import { CadenceLog } from './cadence/entities/cadence-log.entity';
import { RhythmStateSnapshot } from './cadence/entities/rhythm-state-snapshot.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        Applicant,
        User,
        LicensingTraining,
        LicensingExam,
        LicensingExamAttempt,
        EAndOInsurance,
        OnboardingReviewSubmission,
        ActivationRequest,
        LicensedAgentIntake,
        License,
        Contact,
        Task,
        AffiliateProfile,
        AffiliateEvents,
        AffiliateUserPerformance,
        AffiliateVisitor,
        UserOnboardingStep,
        UserEvent,
        CadenceLog,
        RhythmStateSnapshot,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      ssl: process.env.DB_HOST ? { rejectUnauthorized: false } : false,
    }),
    AuthModule,
    ApplicantsModule,
    HealthModule,
    OnboardingModule,
    ContactsModule,
    TasksModule,
    AffiliatesModule,
    ActivationModule,
    AdminMetricsModule,
    AnalyticsModule,
    UsersModule,
    CadenceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
