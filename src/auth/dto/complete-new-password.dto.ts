import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CompleteNewPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  session: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
