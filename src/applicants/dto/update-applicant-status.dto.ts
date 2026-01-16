import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicantStatus } from '../entities/applicant.entity';

export class UpdateApplicantStatusDto {
  @ApiProperty({
    enum: ApplicantStatus,
    description: 'New application status',
    example: ApplicantStatus.ACCEPTED,
  })
  @IsEnum(ApplicantStatus)
  @IsNotEmpty()
  status: ApplicantStatus;

  @ApiPropertyOptional({
    description: 'Notes about the status change',
    example: 'Applicant meets all requirements and has been approved',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
