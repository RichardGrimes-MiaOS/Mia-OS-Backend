import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Task title',
    example: 'Follow up with client',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Task description',
    example: 'Call client to discuss insurance options',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Task due date (ISO 8601 format)',
    example: '2026-01-20T10:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({
    description: 'Contact UUID to associate with task',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}