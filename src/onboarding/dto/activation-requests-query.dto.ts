import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { ActivationStatus } from '../entities/activation-request.entity';

/**
 * Query parameters for filtering activation requests list
 */
export class ActivationRequestsQueryDto {
  @ApiPropertyOptional({
    enum: ActivationStatus,
    description: 'Filter by activation status',
    example: ActivationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(ActivationStatus)
  status?: ActivationStatus;
}
