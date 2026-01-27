import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { PipelineStageService } from '../services/pipeline-stage.service';
import { CreatePipelineStageDto } from '../dto/create-pipeline-stage.dto';
import { UpdatePipelineStageDto } from '../dto/update-pipeline-stage.dto';
import { ReorderPipelineStagesDto } from '../dto/reorder-pipeline-stages.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

/**
 * PipelineStageController
 *
 * Admin-only endpoints for managing pipeline stage configuration.
 * Enables creating, updating, reordering, and deactivating stages.
 */
@Controller('pipeline-stages')
@ApiTags('pipeline-stages')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PipelineStageController {
  constructor(private readonly pipelineStageService: PipelineStageService) {}

  @Get()
  @ApiOperation({
    summary: 'List all pipeline stages',
    description:
      'Returns all pipeline stages ordered by order field. Optionally filter by active status.',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter by active status (default: true)',
  })
  @ApiQuery({
    name: 'businessType',
    required: false,
    type: String,
    description: 'Filter by business type (default: insurance)',
  })
  @ApiResponse({
    status: 200,
    description: 'Pipeline stages retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT' })
  async findAll(
    @Query('active') active?: string,
    @Query('businessType') businessType?: string,
  ) {
    const activeOnly = active === undefined ? true : active === 'true';
    return this.pipelineStageService.findAll(
      businessType || 'insurance',
      activeOnly,
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create new pipeline stage (admin only)',
    description:
      'Create a custom pipeline stage with specified configuration. Admin/Super Admin only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pipeline stage created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Key already exists' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async create(@Body() createPipelineStageDto: CreatePipelineStageDto) {
    return this.pipelineStageService.create(createPipelineStageDto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update pipeline stage (admin only)',
    description: 'Update stage configuration. Admin/Super Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Pipeline stage UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Pipeline stage updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Key conflict' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Pipeline stage not found' })
  async update(
    @Param('id') id: string,
    @Body() updatePipelineStageDto: UpdatePipelineStageDto,
  ) {
    return this.pipelineStageService.update(id, updatePipelineStageDto);
  }

  @Patch('reorder')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Reorder pipeline stages (admin only)',
    description: 'Bulk update stage order values. Admin/Super Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pipeline stages reordered successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'One or more stages not found' })
  async reorder(@Body() reorderDto: ReorderPipelineStagesDto) {
    return this.pipelineStageService.reorder(reorderDto.stages);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Deactivate pipeline stage (admin only)',
    description:
      'Soft delete by setting active=false. Existing contacts in this stage are unaffected. Admin/Super Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Pipeline stage UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Pipeline stage deactivated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Pipeline stage not found' })
  async deactivate(@Param('id') id: string) {
    return this.pipelineStageService.deactivate(id);
  }
}
