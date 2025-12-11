import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;
}