import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

/**
 * DTO for creating a new pipeline stage
 * Admin-only operation
 */
export class CreatePipelineStageDto {
  @ApiProperty({
    description: 'Display name of the pipeline stage',
    example: 'New Lead',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Unique key for programmatic access (snake_case)',
    example: 'new_lead',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  key: string;

  @ApiProperty({
    description: 'Order of stage in pipeline progression (1, 2, 3, ...)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  order: number;

  @ApiPropertyOptional({
    description: 'Whether this is a terminal/end state (e.g., closed_won, closed_lost)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isTerminal?: boolean;

  @ApiPropertyOptional({
    description: 'Business type for this pipeline',
    example: 'insurance',
    default: 'insurance',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessType?: string;

  @ApiPropertyOptional({
    description: 'Whether this stage is currently active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
