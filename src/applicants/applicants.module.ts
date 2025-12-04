import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicantsService } from './applicants.service';
import { ApplicantsController } from './applicants.controller';
import { Applicant } from './entities/applicant.entity';
import { User } from '../users/entities/user.entity';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Applicant, User]),
    EmailModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [ApplicantsController],
  providers: [ApplicantsService],
  exports: [ApplicantsService],
})
export class ApplicantsModule {}
