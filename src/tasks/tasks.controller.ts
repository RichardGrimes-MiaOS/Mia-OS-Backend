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
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FilterTaskDto } from './dto/filter-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new task (Agent only)',
    description:
      'Create a new task. Only agents can create tasks. Optionally link to a contact.',
  })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only agents can create tasks, or cannot link to another agent\'s contact',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Contact not found',
  })
  async create(@CurrentUser() user: User, @Body() createTaskDto: CreateTaskDto) {
    // Only agents can create tasks
    if (user.role !== UserRole.AGENT) {
      throw new ForbiddenException('Only agents can create tasks');
    }

    return this.tasksService.create(user.id, createTaskDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all tasks with filtering and pagination',
    description:
      'Retrieve tasks with optional filters. Agents see only their tasks, admins see all tasks. Results include isOverdue flag.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully - returns array of tasks with isOverdue flag',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async findAll(@CurrentUser() user: User, @Query() filters: FilterTaskDto) {
    return this.tasksService.findAll(user.id, user.role, filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get task by ID',
    description:
      'Retrieve a specific task by ID. Agents can only access their own tasks, admins can access all tasks. Response includes isOverdue flag.',
  })
  @ApiParam({
    name: 'id',
    description: 'Task UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Task retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to access this task',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task not found',
  })
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tasksService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update task',
    description:
      'Update task information. Agents can only update their own tasks, admins can update all tasks. Triggers activation check when task is completed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Task UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Task updated successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to update this task, or cannot link to another agent\'s contact',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task or contact not found',
  })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, user.id, user.role, updateTaskDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete task',
    description:
      'Delete a task. Agents can only delete their own tasks, admins can delete all tasks.',
  })
  @ApiParam({
    name: 'id',
    description: 'Task UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 204,
    description: 'Task deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to delete this task',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Task not found',
  })
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.tasksService.remove(id, user.id, user.role);
  }
}