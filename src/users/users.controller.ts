import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from './entities/user.entity';
import { GetUsersQueryDto } from './dto/get-users-query.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all users with pagination (Admin only)',
    description: 'Retrieve paginated list of all users ordered by creation date',
  })
  @ApiResponse({
    status: 200,
    description:
      'Users retrieved successfully - returns { users, total, limit, offset }',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async getAllUsers(@Query() query: GetUsersQueryDto) {
    const { limit = 100, offset = 0 } = query;
    return await this.usersService.findAll(limit, offset);
  }

  @Get('profile')
  @Roles(UserRole.AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get agent profile (Agent only)',
    description:
      'Retrieve authenticated agent profile including basic info, role, status, onboarding status, licensing, timestamps, and creator information',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Agent role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - User not found',
  })
  async getAgentProfile(@CurrentUser() user: User) {
    return await this.usersService.getAgentProfile(user.id);
  }
}
