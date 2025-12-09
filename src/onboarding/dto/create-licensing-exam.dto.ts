import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ExamResult } from '../entities/licensing-exam.entity';

export class CreateLicensingExamDto {
  @IsBoolean()
  isScheduled: boolean;

  @ValidateIf((o) => o.isScheduled === true)
  @IsDateString()
  examDate?: string;

  @IsEnum(ExamResult)
  @IsOptional()
  result?: ExamResult;

  @IsString()
  @IsOptional()
  resultDocument?: string;
}