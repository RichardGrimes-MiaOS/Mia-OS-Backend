import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExamResult } from '../entities/licensing-exam.entity';

export class CreateLicensingExamDto {
  @ApiProperty({
    description: 'Whether exam is scheduled',
    example: true,
  })
  @IsBoolean()
  isScheduled: boolean;

  @ApiPropertyOptional({
    description: 'Exam date (ISO 8601 format). Required if isScheduled is true',
    example: '2026-02-15T10:00:00Z',
  })
  @ValidateIf((o) => o.isScheduled === true)
  @IsDateString()
  examDate?: string;

  @ApiPropertyOptional({
    enum: ExamResult,
    description: 'Exam result',
    example: ExamResult.PASSED,
  })
  @IsEnum(ExamResult)
  @IsOptional()
  result?: ExamResult;

  @ApiPropertyOptional({
    description: 'S3 key for exam result document',
    example: 'licensing-exam/user-uuid/result.pdf',
  })
  @IsString()
  @IsOptional()
  resultDocument?: string;
}