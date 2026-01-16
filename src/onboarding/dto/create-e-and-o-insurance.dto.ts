import { IsDateString, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEAndOInsuranceDto {
  @ApiProperty({
    description: 'S3 key for E&O insurance document',
    example: 'e-and-o/user-uuid/policy.pdf',
  })
  @IsString()
  @IsNotEmpty()
  documentPath: string;

  @ApiProperty({
    description: 'Insurance carrier name',
    example: 'State Farm',
  })
  @IsString()
  @IsNotEmpty()
  carrierName: string;

  @ApiProperty({
    description: 'Policy number',
    example: 'POL-123456',
  })
  @IsString()
  @IsNotEmpty()
  policyNumber: string;

  @ApiProperty({
    description: 'Policy expiration date (ISO 8601 format)',
    example: '2027-01-15',
  })
  @IsDateString()
  expirationDate: string;
}