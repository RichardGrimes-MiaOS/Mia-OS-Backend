import { IsNotEmpty, IsString, IsIn } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class CompleteAffiliateOnboardingDto {
  @IsNotEmpty()
  @IsString()
  @IsIn([UserRole.AFFILIATE_ONLY], {
    message: 'Role must be affiliate_only',
  })
  role: UserRole.AFFILIATE_ONLY;
}