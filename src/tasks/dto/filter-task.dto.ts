import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskStatus } from '../enums/task-status.enum';

export class FilterTaskDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  overdue?: string; // 'true' or 'false'
}