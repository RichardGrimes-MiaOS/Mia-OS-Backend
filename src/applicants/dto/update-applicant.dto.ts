import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateApplicantDto } from './create-applicant.dto';
import { ApplicantStatus } from '../entities/applicant.entity';

export class UpdateApplicantDto extends PartialType(CreateApplicantDto) {
  @ApiPropertyOptional({
    enum: ApplicantStatus,
    description: 'Application status',
    example: ApplicantStatus.ACCEPTED,
  })
  @IsEnum(ApplicantStatus)
  @IsOptional()
  status?: ApplicantStatus;
}
