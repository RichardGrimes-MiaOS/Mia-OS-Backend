import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLicensingTrainingDto {
  @ApiProperty({
    description: 'Whether user is registered for ExamFX licensing training',
    example: true,
  })
  @IsBoolean()
  isRegistered: boolean;

  @ApiPropertyOptional({
    description: 'ExamFX account email address',
    example: 'agent@example.com',
  })
  @IsEmail()
  @IsOptional()
  examfxEmail?: string;

  @ApiPropertyOptional({
    description: 'S3 key for registration screenshot',
    example: 'licensing-training/user-uuid/registration.png',
  })
  @IsString()
  @IsOptional()
  registrationScreenshot?: string;
}