import { PartialType } from '@nestjs/swagger';
import { CreateLicensingExamDto } from './create-licensing-exam.dto';

export class UpdateLicensingExamDto extends PartialType(
  CreateLicensingExamDto,
) {}