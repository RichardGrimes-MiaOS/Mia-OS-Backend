import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { UpdateApplicantDto } from './dto/update-applicant.dto';
import { UpdateApplicantStatusDto } from './dto/update-applicant-status.dto';
import { ApplicantStatus } from './entities/applicant.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('applicants')
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new applicant (Public endpoint)' })
  @ApiResponse({
    status: 201,
    description: 'Applicant successfully created',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Failed to create applicant',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflict - An application or user with this email already exists',
  })
  create(@Body() createApplicantDto: CreateApplicantDto) {
    return this.applicantsService.create(createApplicantDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all applicants (Admin only)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ApplicantStatus,
    description: 'Filter applicants by status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of applicants retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  findAll(@Query('status') status?: ApplicantStatus) {
    if (status) {
      return this.applicantsService.findByStatus(status);
    }
    return this.applicantsService.findAll();
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get applicant statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  getStatistics() {
    return this.applicantsService.getStatistics();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a single applicant by ID (Admin only)',
    description:
      'Retrieves applicant details. If applicant has a linked user account, also includes onboarding data (licensingTraining, licensingExam, eAndOInsurance).',
  })
  @ApiParam({
    name: 'id',
    description: 'Applicant UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description:
      'Applicant retrieved successfully with optional onboarding data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Applicant with ID not found',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicantsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update applicant details (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Applicant UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Applicant updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Failed to update applicant',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Applicant with ID not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Applicant with email already exists',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateApplicantDto: UpdateApplicantDto,
    @CurrentUser() user: User,
  ) {
    return this.applicantsService.update(id, updateApplicantDto, user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update applicant status (Admin only)',
    description:
      'Updates applicant status. When status changes to ACCEPTED, creates a user account in Cognito and DB, sets up onboarding steps, and sends welcome email. When status changes to REJECTED, sends rejection email.',
  })
  @ApiParam({
    name: 'id',
    description: 'Applicant UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description:
      'Applicant status updated successfully. If accepted, user account created and onboarding initialized.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Failed to create user in Cognito, failed to create user account, or failed to update applicant status',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Applicant with ID not found',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateApplicantStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.applicantsService.updateStatus(id, updateStatusDto, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an applicant (Admin only)' })
  @ApiParam({
    name: 'id',
    description: 'Applicant UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Applicant deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Failed to delete applicant',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Applicant with ID not found',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.applicantsService.remove(id);
  }
}
