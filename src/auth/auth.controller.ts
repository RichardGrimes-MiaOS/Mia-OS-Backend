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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    return this.authService.changePassword(accessToken, changePasswordDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: any) {
    return req.user;
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateUserRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body('role') role: UserRole,
  ) {
    return this.authService.updateUserRole(userId, role);
  }

  @Patch('users/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateUserStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body('status') status: string,
  ) {
    return this.authService.updateUserStatus(userId, status as any);
  }

  @Post('complete-new-password')
  @HttpCode(HttpStatus.OK)
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