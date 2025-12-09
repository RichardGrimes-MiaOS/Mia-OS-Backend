import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class PresignedUrlRequestDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'])
  fileType: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['licensing/training', 'licensing/exam', 'e-and-o'])
  folder: string;
}