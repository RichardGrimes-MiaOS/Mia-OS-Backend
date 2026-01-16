import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlRequestDto {
  @ApiProperty({
    description: 'File name for upload',
    example: 'exam-result.pdf',
  })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    description: 'File MIME type',
    enum: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'])
  fileType: string;

  @ApiProperty({
    description: 'S3 folder for file upload',
    enum: ['licensing/training', 'licensing/exam', 'e-and-o', 'licensing/intake'],
    example: 'licensing/exam',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['licensing/training', 'licensing/exam', 'e-and-o', 'licensing/intake'])
  folder: string;
}
