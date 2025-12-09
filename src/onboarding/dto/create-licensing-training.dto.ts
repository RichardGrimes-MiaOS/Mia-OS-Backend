import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateLicensingTrainingDto {
  @IsBoolean()
  isRegistered: boolean;

  @IsEmail()
  @IsOptional()
  examfxEmail?: string;

  @IsString()
  @IsOptional()
  registrationScreenshot?: string;
}