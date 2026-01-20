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
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
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
import { PresignedDownloadUrlDto } from './dto/presigned-download-url.dto';
import { CompleteAffiliateOnboardingDto } from './dto/complete-affiliate-onboarding.dto';
import { UpdateOnboardingStatusDto } from './dto/update-onboarding-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('onboarding')
@ApiBearerAuth()
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
  @ApiOperation({
    summary: 'Generate presigned URL for S3 upload',
    description:
      'Generate a presigned URL for uploading files to S3. Use PUT request to upload file as binary data to the returned URL.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
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

  @Post('download/presigned-url')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate presigned URL for S3 download (Admin only)',
    description:
      'Generate a presigned URL for downloading files from S3. The URL is valid for 15 minutes. Use GET request to download the file.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned download URL generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - S3 key is required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async getPresignedDownloadUrl(@Body() dto: PresignedDownloadUrlDto) {
    const downloadUrl = await this.s3Service.getPresignedDownloadUrl(dto.key);

    return {
      downloadUrl,
      key: dto.key,
      expiresIn: 900,
      message: 'Use GET request to download the file from the provided URL',
    };
  }

  // ==================== LICENSING TRAINING ====================

  @Post('licensing-training')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create licensing training record',
    description:
      'Create licensing training record for user. Automatically promotes user to AGENT role upon creation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Licensing training record created successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Licensing training record already exists',
  })
  async createLicensingTraining(
    @CurrentUser() user: User,
    @Body() dto: CreateLicensingTrainingDto,
  ) {
    return await this.onboardingService.createLicensingTraining(user.id, dto);
  }

  @Get('licensing-training')
  @ApiOperation({
    summary: 'Get licensing training record',
    description: 'Retrieve licensing training record for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Licensing training record retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Licensing training record does not exist',
  })
  async getLicensingTraining(@CurrentUser() user: User) {
    return await this.onboardingService.getLicensingTraining(user.id);
  }

  @Patch('licensing-training')
  @ApiOperation({
    summary: 'Update licensing training record',
    description: 'Update existing licensing training record for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Licensing training record updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Licensing training record does not exist',
  })
  async updateLicensingTraining(
    @CurrentUser() user: User,
    @Body() dto: UpdateLicensingTrainingDto,
  ) {
    return await this.onboardingService.updateLicensingTraining(user.id, dto);
  }

  // ==================== LICENSING EXAM ====================

  @Post('licensing-exam')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create/update exam record with attempt tracking',
    description:
      'Create or update licensing exam record for user. Automatically tracks exam attempts with frozen snapshots for event sourcing.',
  })
  @ApiResponse({
    status: 201,
    description: 'Licensing exam record created/updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async createLicensingExam(
    @CurrentUser() user: User,
    @Body() dto: CreateLicensingExamDto,
  ) {
    return await this.onboardingService.createLicensingExam(user.id, dto);
  }

  @Get('licensing-exam')
  @ApiOperation({
    summary: 'Get licensing exam record',
    description: 'Retrieve the current licensing exam record for the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Licensing exam record retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Licensing exam record does not exist',
  })
  async getLicensingExam(@CurrentUser() user: User) {
    return await this.onboardingService.getLicensingExam(user.id);
  }

  @Patch('licensing-exam')
  @ApiOperation({
    summary: 'Update licensing exam record',
    description: 'Update existing licensing exam record for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Licensing exam record updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Licensing exam record does not exist',
  })
  async updateLicensingExam(
    @CurrentUser() user: User,
    @Body() dto: UpdateLicensingExamDto,
  ) {
    return await this.onboardingService.updateLicensingExam(user.id, dto);
  }

  @Get('licensing-exam/attempts')
  @ApiOperation({
    summary: 'Get all exam attempts history',
    description:
      'Retrieve complete history of all licensing exam attempts with frozen snapshots for compliance and audit.',
  })
  @ApiResponse({
    status: 200,
    description: 'Exam attempts history retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async getLicensingExamAttempts(@CurrentUser() user: User) {
    return await this.onboardingService.getLicensingExamAttempts(user.id);
  }

  // ==================== E&O INSURANCE ====================

  @Post('e-and-o-insurance')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create E&O insurance record',
    description:
      'Create E&O insurance record for user. Requires passed licensing exam. Automatically creates activation request and sends notification email to admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'E&O insurance record created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - User must pass licensing exam before submitting E&O insurance',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async createEAndOInsurance(
    @CurrentUser() user: User,
    @Body() dto: CreateEAndOInsuranceDto,
  ) {
    return await this.onboardingService.createEAndOInsurance(user.id, dto);
  }

  @Get('e-and-o-insurance')
  @ApiOperation({
    summary: 'List all E&O insurance records for user',
    description: 'Retrieve all E&O insurance records for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'E&O insurance records retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async listEAndOInsurance(@CurrentUser() user: User) {
    return await this.onboardingService.listEAndOInsurance(user.id);
  }

  @Get('e-and-o-insurance/:id')
  @ApiParam({
    name: 'id',
    description: 'E&O insurance record ID (UUID)',
    type: String,
  })
  @ApiOperation({
    summary: 'Get specific E&O insurance by ID',
    description: 'Retrieve a specific E&O insurance record by its ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'E&O insurance record retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - E&O insurance record does not exist',
  })
  async getEAndOInsuranceById(@Param('id', ParseUUIDPipe) id: string) {
    return await this.onboardingService.getEAndOInsuranceById(id);
  }

  // ==================== LICENSED AGENT INTAKE (Fast-Track Path) ====================

  @Post('licensed-intake')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create licensed agent intake (fast-track path)',
    description:
      'Fast-track path for already-licensed agents. Submit licenses, E&O insurance, and experience details. Automatically creates activation request and sends notification email to admin.',
  })
  @ApiResponse({
    status: 201,
    description: 'Licensed agent intake created successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Licensed agent intake already exists',
  })
  async createLicensedAgentIntake(
    @CurrentUser() user: User,
    @Body() dto: CreateLicensedAgentIntakeDto,
  ) {
    return await this.onboardingService.createLicensedAgentIntake(user.id, dto);
  }

  @Get('licensed-intake')
  @ApiOperation({
    summary: 'Get licensed agent intake record',
    description: 'Retrieve licensed agent intake record for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Licensed agent intake record retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Licensed agent intake record does not exist',
  })
  async getLicensedAgentIntake(@CurrentUser() user: User) {
    return await this.onboardingService.getLicensedAgentIntake(user.id);
  }

  // ==================== AFFILIATE-ONLY ONBOARDING ====================

  @Post('affiliate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete affiliate-only onboarding',
    description:
      'Complete onboarding for affiliate-only users. Generates referral link and QR code. Updates user role to affiliate_only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Affiliate-only onboarding completed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid role or user already has a referral code',
  })
  async completeAffiliateOnboarding(
    @CurrentUser() user: User,
    @Body() dto: CompleteAffiliateOnboardingDto,
  ) {
    return await this.onboardingService.completeAffiliateOnboarding(
      user.id,
      dto,
    );
  }

  // ==================== UPDATE ONBOARDING STATUS ====================

  @Patch('status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update onboarding status (Agent only)',
    description:
      'Update onboarding status for the current user. Only agents can update their onboarding status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only agents can update onboarding status',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User not found',
  })
  async updateOnboardingStatus(
    @CurrentUser() user: User,
    @Body() dto: UpdateOnboardingStatusDto,
  ) {
    return await this.onboardingService.updateOnboardingStatus(
      user.id,
      dto.status,
    );
  }

  // ==================== ADMIN ACTIVATION ====================

  @Post('activate/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: 'userId',
    description: 'User ID to activate/reject (UUID)',
    type: String,
  })
  @ApiOperation({
    summary: 'Approve/reject user activation (Admin/Super Admin only)',
    description:
      'Approve or reject user activation request. Admin/Super Admin only. Updates user status and onboarding status based on decision.',
  })
  @ApiResponse({
    status: 200,
    description: 'User activation decision processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only admins and super admins can activate users',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User or activation request not found',
  })
  async activateUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() admin: User,
    @Body() dto: ActivateUserDto,
  ) {
    return await this.onboardingService.activateUser(userId, admin, dto);
  }

  @Get('review-submissions')
  @ApiOperation({
    summary: 'Get all onboarding review submission attempts',
    description:
      'Retrieve complete history of all onboarding review submissions with frozen snapshots for compliance and audit.',
  })
  @ApiResponse({
    status: 200,
    description: 'Review submissions retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async getOnboardingReviewSubmissions(@CurrentUser() user: User) {
    return await this.onboardingService.getOnboardingReviewSubmissions(user.id);
  }

  // ==================== GET ONBOARDING STATUS (MCP TOOL) ====================

  @Get('status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get comprehensive onboarding status (Agent only, MCP tool)',
    description:
      'Retrieve comprehensive onboarding status including all completed steps, pending requirements, and current onboarding stage. Agent only. Used by MCP tool for onboarding guidance.',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only agents can view onboarding status',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User not found',
  })
  async getOnboardingStatus(@CurrentUser() user: User) {
    return await this.onboardingService.getOnboardingStatus(user.id);
  }
}
