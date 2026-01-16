import { PartialType } from '@nestjs/swagger';
import { CreateLicensingTrainingDto } from './create-licensing-training.dto';

export class UpdateLicensingTrainingDto extends PartialType(
  CreateLicensingTrainingDto,
) {}