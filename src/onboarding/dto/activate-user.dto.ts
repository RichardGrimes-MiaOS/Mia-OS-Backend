import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivationStatus } from '../entities/activation-request.entity';

export class ActivateUserDto {
  @ApiProperty({
    enum: ActivationStatus,
    description: 'Activation decision (approved/rejected)',
    example: ActivationStatus.APPROVED,
  })
  @IsEnum(ActivationStatus)
  status: ActivationStatus;

  @ApiPropertyOptional({
    description: 'Admin notes for activation decision',
    example: 'All requirements met, approved for activation',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}