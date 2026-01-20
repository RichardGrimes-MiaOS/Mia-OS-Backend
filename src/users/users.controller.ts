import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
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
    summary: 'Get all users with minimal fields for table view (Admin only)',
    description: `
Retrieve paginated list of all users with basic info for table display. Excludes admin and super-admin users.

**Filters:**
- \`role\`: Filter by user role (applicant, agent, affiliate, affiliate_only)
- \`status\`: Filter by user status (active, inactive, suspended)
- \`isLicensed\`: Filter by licensing status (true/false)
- \`onboardingStatus\`: Filter by onboarding status (in_progress, licensed, pending_activation, onboarded)

**Response includes minimal fields:**
- id, email, firstName, lastName
- role, status, onboardingStatus, activationStatus
- createdAt

**For full details:** Use GET /users/:id
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Users list retrieved successfully',
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

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get single user with full onboarding details (Admin only)',
    description: `
Retrieve complete user information including all onboarding details and documents.

**Response includes:**
- Full user info (id, email, name, phone)
- Role, status, licensing, onboarding status
- Timestamps (created, approved, activated)
- Complete onboarding details:
  - Licensing training (completion, registration screenshot)
  - Licensing exam (result, exam date, result document)
  - E&O insurance (document path, carrier, policy number, expiration)
  - Activation request (status, requested date, approved date, approver, notes)
  - Current onboarding step
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
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
    description: 'User not found',
  })
  async getUserById(@Param('id') id: string) {
    return await this.usersService.findByIdWithOnboarding(id);
  }
}
