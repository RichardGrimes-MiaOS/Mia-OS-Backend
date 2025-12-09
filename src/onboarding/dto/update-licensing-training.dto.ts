import { PartialType } from '@nestjs/mapped-types';
import { CreateLicensingTrainingDto } from './create-licensing-training.dto';

export class UpdateLicensingTrainingDto extends PartialType(
  CreateLicensingTrainingDto,
) {}