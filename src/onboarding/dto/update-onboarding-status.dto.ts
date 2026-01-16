import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OnboardingStatus } from '../../users/entities/user.entity';

export class UpdateOnboardingStatusDto {
  @ApiProperty({
    enum: OnboardingStatus,
    description: 'Onboarding status to set',
    example: OnboardingStatus.LICENSED,
  })
  @IsEnum(OnboardingStatus)
  status: OnboardingStatus;
}
