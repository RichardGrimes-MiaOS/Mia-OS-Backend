import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../entities/user-event.entity';
import { UserRole } from '../../users/entities/user.entity';

export class GetEventsQueryDto {
  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Filter events by user role',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    enum: EventType,
    description: 'Filter events by event type',
  })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({
    description: 'Maximum number of events to return',
    minimum: 1,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Number of events to skip for pagination',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}