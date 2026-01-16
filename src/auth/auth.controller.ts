import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
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
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteNewPasswordDto } from './dto/complete-new-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user with email and password. Returns JWT tokens or NEW_PASSWORD_REQUIRED challenge for first-time users.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Login successful - returns tokens (accessToken, idToken, refreshToken, expiresIn) OR challenge response (challengeName, session, message)',
  })
  @ApiResponse({
    status: 401,
    description:
      'Unauthorized - No user found, invalid email or password, or email not verified',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Login failed',
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Get new access and ID tokens using a valid refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired refresh token',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Token refresh failed',
  })
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password (Authenticated)',
    description: 'Change password for logged-in user',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - New password does not meet requirements',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Current password is incorrect or JWT invalid',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Password change failed',
  })
  changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    return this.authService.changePassword(accessToken, changePasswordDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user profile (Authenticated)',
    description: 'Retrieve authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  getProfile(@Request() req: any) {
    return req.user;
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user role (Super Admin only)',
    description: 'Update user role in both database and Cognito',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: Object.values(UserRole),
          example: UserRole.AGENT,
        },
      },
      required: ['role'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin role required',
  })
  updateUserRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body('role') role: UserRole,
  ) {
    return this.authService.updateUserRole(userId, role);
  }

  @Patch('users/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user status (Admin only)',
    description: 'Update user status in database',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'suspended'],
          example: 'active',
        },
      },
      required: ['status'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  updateUserStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body('status') status: string,
  ) {
    return this.authService.updateUserStatus(userId, status as any);
  }

  @Post('complete-new-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete new password challenge',
    description:
      'Set new password when user receives NEW_PASSWORD_REQUIRED challenge (first login with temporary password). Returns JWT tokens.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Password set successfully - returns tokens (accessToken, idToken, refreshToken, expiresIn)',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - New password does not meet requirements',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid session or credentials',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Failed to set new password',
  })
  completeNewPassword(@Body() completeNewPasswordDto: CompleteNewPasswordDto) {
    return this.authService.completeNewPasswordChallenge(
      completeNewPasswordDto.email,
      completeNewPasswordDto.session,
      completeNewPasswordDto.newPassword,
    );
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create user (Super Admin only)',
    description:
      'Create a new user with temporary password. User must change password on first login. Creates user in both Cognito and database using Saga pattern.',
  })
  @ApiResponse({
    status: 201,
    description:
      'User created successfully - returns user object and temporaryPassword',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Password does not meet requirements or invalid parameter',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin role required',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User with this email already exists',
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal Server Error - Failed to create user in Cognito or database',
  })
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    const result = await this.authService.createUser(
      createUserDto.email,
      createUserDto.firstName,
      createUserDto.lastName,
      createUserDto.phone,
      createUserDto.role,
      currentUser.id,
    );

    return {
      user: result.user,
      temporaryPassword: result.temporaryPassword,
      message: 'User created successfully. Temporary password must be changed on first login.',
    };
  }
}