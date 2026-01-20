import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignedDownloadUrlDto {
  @ApiProperty({
    description: 'S3 object key for the document to download',
    example:
      'users/29914c8d-dbb8-44f5-9c9e-57af1195123c/licensing/training/095698dd-1e75-40cb-950a-a7c7c5235547.pdf',
  })
  @IsString()
  @IsNotEmpty()
  key: string;
}
