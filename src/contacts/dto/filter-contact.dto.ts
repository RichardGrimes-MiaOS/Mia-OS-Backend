import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PipelineStage } from '../enums/pipeline-stage.enum';

export class FilterContactDto {
  @IsOptional()
  @IsEnum(PipelineStage)
  pipelineStage?: PipelineStage;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}