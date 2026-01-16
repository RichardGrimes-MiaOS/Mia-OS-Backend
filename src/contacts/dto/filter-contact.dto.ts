import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PipelineStage } from '../enums/pipeline-stage.enum';

export class FilterContactDto {
  @ApiPropertyOptional({
    enum: PipelineStage,
    description: 'Filter by pipeline stage',
    example: PipelineStage.IN_PROGRESS,
  })
  @IsOptional()
  @IsEnum(PipelineStage)
  pipelineStage?: PipelineStage;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'active',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Search by name, email, or phone',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of contacts to return',
    minimum: 1,
    default: 5,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 5;

  @ApiPropertyOptional({
    description: 'Number of contacts to skip',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}