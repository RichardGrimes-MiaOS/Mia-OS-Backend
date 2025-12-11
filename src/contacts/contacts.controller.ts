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
} from '@nestjs/common';
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

@Controller('contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
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
  async findAll(
    @CurrentUser() user: User,
    @Query() filters: FilterContactDto,
  ) {
    return this.contactsService.findAll(user.id, user.role, filters);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.contactsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
  ) {
    return this.contactsService.update(id, user.id, user.role, updateContactDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.contactsService.remove(id, user.id, user.role);
  }

  @Patch(':id/stage')
  async updateStage(
    @CurrentUser() user: User,
    @Param('id') id: string,
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