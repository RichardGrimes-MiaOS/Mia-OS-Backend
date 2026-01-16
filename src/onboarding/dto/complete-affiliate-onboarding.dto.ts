import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class CompleteAffiliateOnboardingDto {
  @ApiProperty({
    description: 'User role for affiliate-only onboarding (must be affiliate_only)',
    example: UserRole.AFFILIATE_ONLY,
    enum: [UserRole.AFFILIATE_ONLY],
  })
  @IsNotEmpty()
  @IsString()
  @IsIn([UserRole.AFFILIATE_ONLY], {
    message: 'Role must be affiliate_only',
  })
  role: UserRole.AFFILIATE_ONLY;
}