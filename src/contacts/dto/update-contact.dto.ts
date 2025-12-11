import { PartialType } from '@nestjs/mapped-types';
import { CreateContactDto } from './create-contact.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { PipelineStage } from '../enums/pipeline-stage.enum';

export class UpdateContactDto extends PartialType(CreateContactDto) {
  @IsOptional()
  @IsEnum(PipelineStage)
  pipelineStage?: PipelineStage;
}