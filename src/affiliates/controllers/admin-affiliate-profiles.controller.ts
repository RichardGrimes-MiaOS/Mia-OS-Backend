import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AffiliateProfilesService } from '../services/affiliate-profiles.service';
import { CreateAffiliateProfileDto } from '../dto/create-affiliate-profile.dto';
import { UpdateAffiliateProfileDto } from '../dto/update-affiliate-profile.dto';
import { FilterAffiliateProfileDto } from '../dto/filter-affiliate-profile.dto';
import { GetPhotoUploadUrlDto } from '../dto/get-photo-upload-url.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { S3Service } from '../../onboarding/services/s3.service';

@ApiTags('affiliates')
@ApiBearerAuth()
@Controller('/affiliate-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminAffiliateProfilesController {
  constructor(
    private readonly affiliateProfilesService: AffiliateProfilesService,
    private readonly s3Service: S3Service,
  ) {}

  @Post('photo-upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get S3 presigned URL for photo upload (Admin only)',
    description: 'Generate presigned URL for direct upload of affiliate profile photo to S3. Returns upload URL and public photo URL.',
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully - returns { uploadUrl, photoUrl, key }',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getPhotoUploadUrl(@Body() dto: GetPhotoUploadUrlDto) {
    const { uploadUrl, key } = await this.s3Service.getAffiliatePhotoPresignedUrl(
      dto.fileName,
      dto.fileType,
    );

    // Generate the public URL that will be stored in photo_url
    const photoUrl = this.s3Service.getPublicUrl(key);

    return {
      uploadUrl,
      photoUrl,
      key,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create affiliate profile (Admin only)',
    description: 'Create new affiliate profile with auto-generated referral code and link. Also auto-creates AffiliateEvents record for tracking.',
  })
  @ApiResponse({
    status: 201,
    description: 'Affiliate profile created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Failed to generate unique referral code. Please try again.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Affiliate profile with this slug already exists',
  })
  async create(@Body() createDto: CreateAffiliateProfileDto) {
    return this.affiliateProfilesService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all affiliate profiles (Admin only)',
    description: 'Retrieve all affiliate profiles with optional filters (search by name/slug, filter by audience type). Includes event statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Affiliate profiles retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async findAll(@Query() filters: FilterAffiliateProfileDto) {
    return this.affiliateProfilesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get affiliate profile by ID (Admin only)',
    description: 'Retrieve single affiliate profile with event statistics',
  })
  @ApiParam({
    name: 'id',
    description: 'Affiliate profile UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Affiliate profile retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Affiliate profile with ID not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.affiliateProfilesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update affiliate profile (Admin only)',
    description: 'Update affiliate profile fields. Note: slug cannot be changed after creation.',
  })
  @ApiParam({
    name: 'id',
    description: 'Affiliate profile UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Affiliate profile updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Affiliate profile with ID not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAffiliateProfileDto,
  ) {
    return this.affiliateProfilesService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete affiliate profile (Admin only)',
    description: 'Delete affiliate profile. Only allowed if no user is linked to the profile.',
  })
  @ApiParam({
    name: 'id',
    description: 'Affiliate profile UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Affiliate profile deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Cannot delete affiliate profile with linked user. Please unlink the user first.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Affiliate profile with ID not found',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.affiliateProfilesService.remove(id);
  }
}
