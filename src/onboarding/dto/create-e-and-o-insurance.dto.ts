import { IsDateString, IsString, IsNotEmpty } from 'class-validator';

export class CreateEAndOInsuranceDto {
  @IsString()
  @IsNotEmpty()
  documentPath: string;

  @IsString()
  @IsNotEmpty()
  carrierName: string;

  @IsString()
  @IsNotEmpty()
  policyNumber: string;

  @IsDateString()
  expirationDate: string;
}