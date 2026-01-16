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
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactDto } from './dto/filter-contact.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { PipelineStage } from './enums/pipeline-stage.enum';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new contact (Agent only)',
    description:
      'Create a new CRM contact. Only agents can create contacts. Creates lead_created transition event and triggers activation check.',
  })
  @ApiResponse({
    status: 201,
    description: 'Contact created successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only agents can create contacts',
  })
  async create(
    @CurrentUser() user: User,
    @Body() createContactDto: CreateContactDto,
  ) {
    // Only agents can create contacts
    if (user.role !== UserRole.AGENT) {
      throw new ForbiddenException('Only agents can create contacts');
    }

    return this.contactsService.create(user.id, createContactDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all contacts with filtering and pagination',
    description:
      'Retrieve contacts with optional filters. Agents see only their contacts, admins see all contacts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contacts retrieved successfully - returns array of contacts',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async findAll(
    @CurrentUser() user: User,
    @Query() filters: FilterContactDto,
  ) {
    return this.contactsService.findAll(user.id, user.role, filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get contact by ID',
    description:
      'Retrieve a specific contact by ID. Agents can only access their own contacts, admins can access all contacts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contact UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Contact retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to access this contact',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Contact not found',
  })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contactsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update contact',
    description:
      'Update contact information. Agents can only update their own contacts, admins can update all contacts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contact UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Contact updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to update this contact',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Contact not found',
  })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateContactDto: UpdateContactDto,
  ) {
    return this.contactsService.update(id, user.id, user.role, updateContactDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete contact',
    description:
      'Delete a contact. Agents can only delete their own contacts, admins can delete all contacts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contact UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Contact deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to delete this contact',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Contact not found',
  })
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.contactsService.remove(id, user.id, user.role);
  }

  @Patch(':id/stage')
  @ApiOperation({
    summary: 'Update contact pipeline stage',
    description:
      'Update the pipeline stage of a contact. Agents can only update their own contacts, admins can update all contacts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contact UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pipelineStage: {
          type: 'string',
          enum: Object.values(PipelineStage),
          example: PipelineStage.IN_PROGRESS,
        },
      },
      required: ['pipelineStage'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Contact pipeline stage updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to update this contact',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Contact not found',
  })
  async updateStage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('pipelineStage') pipelineStage: PipelineStage,
  ) {
    return this.contactsService.updatePipelineStage(
      id,
      user.id,
      user.role,
      pipelineStage,
    );
  }
}