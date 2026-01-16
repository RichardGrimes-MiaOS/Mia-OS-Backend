import { PartialType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../enums/task-status.enum';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({
    enum: TaskStatus,
    description: 'Task status',
    example: TaskStatus.COMPLETED,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}