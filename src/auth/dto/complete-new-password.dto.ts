import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteNewPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Session token from NEW_PASSWORD_REQUIRED challenge response',
    example: 'AYABe...',
  })
  @IsString()
  @IsNotEmpty()
  session: string;

  @ApiProperty({
    description: 'New password to set (min 8 characters)',
    example: 'NewSecureP@ss123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
