import { PartialType } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PipelineStage } from '../enums/pipeline-stage.enum';

export class UpdateContactDto extends PartialType(CreateContactDto) {
  @ApiPropertyOptional({
    enum: PipelineStage,
    description: 'Contact pipeline stage',
    example: PipelineStage.IN_PROGRESS,
  })
  @IsOptional()
  @IsEnum(PipelineStage)
  pipelineStage?: PipelineStage;
}