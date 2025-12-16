import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ActivationStatus } from '../entities/activation-request.entity';

export class ActivateUserDto {
  @IsEnum(ActivationStatus)
  status: ActivationStatus;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}