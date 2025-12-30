import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from './entities/user.entity';
import { GetUsersQueryDto } from './dto/get-users-query.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users
   * Get all users with pagination
   * Accessible only by admin and super_admin
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getAllUsers(@Query() query: GetUsersQueryDto) {
    const { limit = 100, offset = 0 } = query;
    return await this.usersService.findAll(limit, offset);
  }

  // ==================== GET AGENT PROFILE (MCP TOOL) ====================

  /**
   * GET /users/profile
   * Get agent profile for MCP tools
   * Accessible only by agents
   */
  @Get('profile')
  @Roles(UserRole.AGENT)
  @HttpCode(HttpStatus.OK)
  async getAgentProfile(@CurrentUser() user: User) {
    return await this.usersService.getAgentProfile(user.id);
  }
}
