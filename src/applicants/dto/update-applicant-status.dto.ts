import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApplicantStatus } from '../entities/applicant.entity';

export class UpdateApplicantStatusDto {
  @IsEnum(ApplicantStatus)
  @IsNotEmpty()
  status: ApplicantStatus;
}
