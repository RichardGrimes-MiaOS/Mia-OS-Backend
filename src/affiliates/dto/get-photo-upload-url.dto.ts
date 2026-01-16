import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetPhotoUploadUrlDto {
  @ApiProperty({
    description: 'File name for the photo',
    example: 'profile-photo.jpg',
  })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty({
    description: 'MIME type of the image file',
    enum: ['image/png', 'image/jpeg', 'image/jpg'],
    example: 'image/jpeg',
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/jpg'], {
    message: 'File type must be image/png, image/jpeg, or image/jpg',
  })
  fileType: string;
}