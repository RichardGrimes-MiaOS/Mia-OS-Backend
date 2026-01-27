import { PartialType } from '@nestjs/swagger';
import { CreatePipelineStageDto } from './create-pipeline-stage.dto';

/**
 * DTO for updating an existing pipeline stage
 * Admin-only operation
 * All fields are optional
 */
export class UpdatePipelineStageDto extends PartialType(CreatePipelineStageDto) {}
