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
} from '@nestjs/common';
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
  async create(@Body() createDto: CreateAffiliateProfileDto) {
    return this.affiliateProfilesService.create(createDto);
  }

  @Get()
  async findAll(@Query() filters: FilterAffiliateProfileDto) {
    return this.affiliateProfilesService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.affiliateProfilesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAffiliateProfileDto,
  ) {
    return this.affiliateProfilesService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.affiliateProfilesService.remove(id);
  }
}
