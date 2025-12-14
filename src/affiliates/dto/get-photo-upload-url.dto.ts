import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class GetPhotoUploadUrlDto {
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/jpg'], {
    message: 'File type must be image/png, image/jpeg, or image/jpg',
  })
  fileType: string;
}