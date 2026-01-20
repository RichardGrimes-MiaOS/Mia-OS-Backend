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
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


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

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all users with onboarding details (Admin only)',
    description: `
Retrieve paginated list of all users with their onboarding status and details.

**Filters:**
- \`role\`: Filter by user role (applicant, agent, affiliate, affiliate_only, admin, super-admin)
- \`status\`: Filter by user status (active, inactive, suspended)
- \`isLicensed\`: Filter by licensing status (true/false)
- \`onboardingStatus\`: Filter by onboarding status (in_progress, licensed, pending_activation, onboarded)

**Response includes:**
- Basic user info (id, email, name, phone)
- Role and status
- Licensing and onboarding status
- Timestamps (created, approved, activated)
- Onboarding details:
  - Licensing training completion
  - Licensing exam result and date
  - E&O insurance upload and expiration
  - Activation request status
  - Current onboarding step
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully with onboarding details',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async getAdminUsers(@Query() query: ListUsersQueryDto) {
    return await this.usersService.findAllWithOnboarding(query);
  }
}
