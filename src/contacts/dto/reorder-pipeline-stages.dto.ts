import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Single stage reorder item
 */
export class StageOrderItem {
  @ApiProperty({
    description: 'Pipeline stage UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'New order value for this stage',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  order: number;
}

/**
 * DTO for bulk reordering pipeline stages
 * Admin-only operation
 */
export class ReorderPipelineStagesDto {
  @ApiProperty({
    description: 'Array of stage ID and new order pairs',
    type: [StageOrderItem],
    example: [
      { id: '123e4567-e89b-12d3-a456-426614174000', order: 1 },
      { id: '123e4567-e89b-12d3-a456-426614174001', order: 2 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageOrderItem)
  stages: StageOrderItem[];
}
