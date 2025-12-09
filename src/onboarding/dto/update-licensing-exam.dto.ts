import { PartialType } from '@nestjs/mapped-types';
import { CreateLicensingExamDto } from './create-licensing-exam.dto';

export class UpdateLicensingExamDto extends PartialType(
  CreateLicensingExamDto,
) {}