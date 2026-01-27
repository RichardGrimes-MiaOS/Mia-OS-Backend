import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsOptional } from 'class-validator';

/**
 * DTO for updating a contact's pipeline stage
 * Used by PATCH /contacts/:id/stage endpoint
 */
export class UpdateContactPipelineStageDto {
  @ApiProperty({
    description: 'New pipeline stage ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  stageId: string;

  @ApiPropertyOptional({
    enum: ['user', 'system', 'mia'],
    description: 'Who initiated the change',
    default: 'user',
  })
  @IsOptional()
  @IsEnum(['user', 'system', 'mia'])
  changedBy?: 'user' | 'system' | 'mia';

  @ApiPropertyOptional({
    enum: ['manual', 'automation', 'ai_suggested'],
    description: 'How the change occurred',
    default: 'manual',
  })
  @IsOptional()
  @IsEnum(['manual', 'automation', 'ai_suggested'])
  reason?: 'manual' | 'automation' | 'ai_suggested';

  @ApiPropertyOptional({
    description: 'Additional context (JSON)',
    example: { note: 'Customer requested quote' },
  })
  @IsOptional()
  metadata?: any;
}
