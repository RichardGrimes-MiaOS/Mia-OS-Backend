import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ActivateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}