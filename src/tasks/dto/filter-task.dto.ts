import { IsEnum, IsOptional, IsString, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../enums/task-status.enum';

export class FilterTaskDto {
  @ApiPropertyOptional({
    enum: TaskStatus,
    description: 'Filter by task status',
    example: TaskStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Filter by contact UUID',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({
    description: 'Search by title or description',
    example: 'follow up',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter overdue tasks (only applies to open tasks)',
    example: 'true',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsString()
  overdue?: string; // 'true' or 'false'

  @ApiPropertyOptional({
    description: 'Maximum number of tasks to return',
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
    description: 'Number of tasks to skip',
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