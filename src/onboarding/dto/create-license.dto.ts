import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class CreateLicenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  licenseNumber: string;

  @IsDateString()
  @IsNotEmpty()
  expirationDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  licenseDocumentPath: string;
}