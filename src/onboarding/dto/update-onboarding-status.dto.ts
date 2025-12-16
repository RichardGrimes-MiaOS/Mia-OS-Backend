import { IsEnum } from 'class-validator';
import { OnboardingStatus } from '../../users/entities/user.entity';

export class UpdateOnboardingStatusDto {
  @IsEnum(OnboardingStatus)
  status: OnboardingStatus;
}
