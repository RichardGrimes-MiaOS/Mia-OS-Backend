import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateApplicantDto } from './create-applicant.dto';
import { ApplicantStatus } from '../entities/applicant.entity';

export class UpdateApplicantDto extends PartialType(CreateApplicantDto) {
  @IsEnum(ApplicantStatus)
  @IsOptional()
  status?: ApplicantStatus;
}
