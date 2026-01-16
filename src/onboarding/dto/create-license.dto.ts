import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLicenseDto {
  @ApiProperty({
    description: 'State code',
    example: 'CA',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @ApiProperty({
    description: 'License number',
    example: 'LIC-12345',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  licenseNumber: string;

  @ApiProperty({
    description: 'License expiration date (ISO 8601 format)',
    example: '2027-06-30',
  })
  @IsDateString()
  @IsNotEmpty()
  expirationDate: string;

  @ApiProperty({
    description: 'S3 key for license document',
    example: 'licenses/user-uuid/license-ca.pdf',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  licenseDocumentPath: string;
}