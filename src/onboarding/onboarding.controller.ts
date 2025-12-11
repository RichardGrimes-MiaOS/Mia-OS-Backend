import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { S3Service } from './services/s3.service';
import { CreateLicensingTrainingDto } from './dto/create-licensing-training.dto';
import { UpdateLicensingTrainingDto } from './dto/update-licensing-training.dto';
import { CreateLicensingExamDto } from './dto/create-licensing-exam.dto';
import { UpdateLicensingExamDto } from './dto/update-licensing-exam.dto';
import { CreateEAndOInsuranceDto } from './dto/create-e-and-o-insurance.dto';
import { CreateLicensedAgentIntakeDto } from './dto/create-licensed-agent-intake.dto';
import { ActivateUserDto } from './dto/activate-user.dto';
import { PresignedUrlRequestDto } from './dto/presigned-url-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly s3Service: S3Service,
  ) {}

  // ==================== S3 PRE-SIGNED URLs ====================

  @Post('upload/presigned-url')
  @HttpCode(HttpStatus.OK)
  async getPresignedUrl(
    @CurrentUser() user: User,
    @Body() dto: PresignedUrlRequestDto,
  ) {
    const { uploadUrl, key } = await this.s3Service.getPresignedUploadUrl(
      user.id,
      dto.fileName,
      dto.fileType,
      dto.folder,
    );

    return {
      uploadUrl,
      key,
      message:
        'Upload your file to the provided URL using PUT request with the file as binary data',
    };
  }

  // ==================== LICENSING TRAINING ====================

  @Post('licensing-training')
  @HttpCode(HttpStatus.CREATED)
  async createLicensingTraining(
    @CurrentUser() user: User,
    @Body() dto: CreateLicensingTrainingDto,
  ) {
    return await this.onboardingService.createLicensingTraining(user.id, dto);
  }

  @Get('licensing-training')
  async getLicensingTraining(@CurrentUser() user: User) {
    return await this.onboardingService.getLicensingTraining(user.id);
  }

  @Patch('licensing-training')
  async updateLicensingTraining(
    @CurrentUser() user: User,
    @Body() dto: UpdateLicensingTrainingDto,
  ) {
    return await this.onboardingService.updateLicensingTraining(user.id, dto);
  }

  // ==================== LICENSING EXAM ====================

  @Post('licensing-exam')
  @HttpCode(HttpStatus.CREATED)
  async createLicensingExam(
    @CurrentUser() user: User,
    @Body() dto: CreateLicensingExamDto,
  ) {
    return await this.onboardingService.createLicensingExam(user.id, dto);
  }

  @Get('licensing-exam')
  async getLicensingExam(@CurrentUser() user: User) {
    return await this.onboardingService.getLicensingExam(user.id);
  }

  @Patch('licensing-exam')
  async updateLicensingExam(
    @CurrentUser() user: User,
    @Body() dto: UpdateLicensingExamDto,
  ) {
    return await this.onboardingService.updateLicensingExam(user.id, dto);
  }

  // ==================== E&O INSURANCE ====================

  @Post('e-and-o-insurance')
  @HttpCode(HttpStatus.CREATED)
  async createEAndOInsurance(
    @CurrentUser() user: User,
    @Body() dto: CreateEAndOInsuranceDto,
  ) {
    return await this.onboardingService.createEAndOInsurance(user.id, dto);
  }

  @Get('e-and-o-insurance')
  async listEAndOInsurance(@CurrentUser() user: User) {
    return await this.onboardingService.listEAndOInsurance(user.id);
  }

  @Get('e-and-o-insurance/:id')
  async getEAndOInsuranceById(@Param('id') id: string) {
    return await this.onboardingService.getEAndOInsuranceById(id);
  }

  // ==================== LICENSED AGENT INTAKE (Fast-Track Path) ====================

  @Post('licensed-intake')
  @HttpCode(HttpStatus.CREATED)
  async createLicensedAgentIntake(
    @CurrentUser() user: User,
    @Body() dto: CreateLicensedAgentIntakeDto,
  ) {
    return await this.onboardingService.createLicensedAgentIntake(
      user.id,
      dto,
    );
  }

  @Get('licensed-intake')
  async getLicensedAgentIntake(@CurrentUser() user: User) {
    return await this.onboardingService.getLicensedAgentIntake(user.id);
  }

  // ==================== ADMIN ACTIVATION ====================

  @Post('activate/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async activateUser(
    @Param('userId') userId: string,
    @CurrentUser() admin: User,
    @Body() dto: ActivateUserDto,
  ) {
    return await this.onboardingService.activateUser(userId, admin.id, dto);
  }
}
