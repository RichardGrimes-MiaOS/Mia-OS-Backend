import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventType } from '../analytics/entities/user-event.entity';
import { CognitoService } from '../cognito/cognito.service';

/** Successful authentication response with tokens */
export interface AuthTokensResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Challenge response when user needs to change password on first login */
export interface AuthChallengeResponse {
  challengeName: string;
  session: string;
  message: string;
}

/** Login can return either tokens or a challenge */
export type LoginResponse = AuthTokensResponse | AuthChallengeResponse;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private analyticsService: AnalyticsService,
    private cognitoService: CognitoService,
  ) {}

  async signup(
    signupDto: SignupDto,
  ): Promise<{ message: string; userSub: string }> {
    const { email, password, firstName, lastName, phone, role } = signupDto;

    try {
      // Check if user already exists in database
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Build user attributes for Cognito
      const attributes = [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
        ...(phone ? [{ Name: 'phone_number', Value: phone }] : []),
        ...(role ? [{ Name: 'custom:role', Value: role }] : []),
      ];

      // Sign up user in Cognito
      const signUpResponse = await this.cognitoService.signUp(
        email,
        password,
        attributes,
      );

      if (!signUpResponse.UserSub) {
        throw new InternalServerErrorException(
          'Failed to create user in Cognito',
        );
      }

      // Create user record in database
      const user = this.userRepository.create({
        cognitoSub: signUpResponse.UserSub,
        email,
        firstName,
        lastName,
        phone,
        ...(role && { role }),
        status: UserStatus.ACTIVE,
      });

      await this.userRepository.save(user);

      return {
        message:
          'User registered successfully. Please check your email to verify your account.',
        userSub: signUpResponse.UserSub,
      };
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (error.name === 'UsernameExistsException') {
        throw new ConflictException('User with this email already exists');
      }

      if (error.name === 'InvalidPasswordException') {
        throw new BadRequestException('Password does not meet requirements');
      }

      if (error.name === 'InvalidParameterException') {
        throw new BadRequestException(`Invalid parameter: ${error.message}`);
      }

      if (error.name === 'ResourceNotFoundException') {
        throw new InternalServerErrorException(
          'Cognito User Pool not found. Please check your AWS configuration.',
        );
      }

      // Log the actual error for debugging
      console.error('Cognito signup error:', error);
      throw new InternalServerErrorException(
        `Failed to register user: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password } = loginDto;

    // Check if user exists in database before authenticating with Cognito
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('No user found');
    }

    try {
      const authResponse = await this.cognitoService.initiateAuth(
        email,
        password,
      );

      // Check if user needs to change password (first login with temp password)
      if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return {
          challengeName: authResponse.ChallengeName,
          session: authResponse.Session!,
          message: 'Please set a new password',
        };
      }

      if (!authResponse.AuthenticationResult) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update lastLogin timestamp and track login event
      try {
        user.lastLogin = new Date();
        await this.userRepository.save(user);

        // Track login event
        await this.analyticsService.trackEvent({
          userId: user.id,
          eventType: EventType.LOGIN,
          role: user.role,
          affiliateId: user.affiliate_profile_id,
        });
      } catch (dbError) {
        // Log error but don't fail the login
        console.error('Failed to update lastLogin:', dbError);
      }

      return {
        accessToken: authResponse.AuthenticationResult.AccessToken!,
        idToken: authResponse.AuthenticationResult.IdToken!,
        refreshToken: authResponse.AuthenticationResult.RefreshToken!,
        expiresIn: authResponse.AuthenticationResult.ExpiresIn!,
      };
    } catch (error: any) {
      if (
        error.name === 'NotAuthorizedException' ||
        error.name === 'UserNotFoundException'
      ) {
        throw new UnauthorizedException('Invalid email or password');
      }

      if (error.name === 'UserNotConfirmedException') {
        throw new UnauthorizedException(
          'Please verify your email before logging in',
        );
      }

      throw new InternalServerErrorException('Login failed');
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{
    accessToken: string;
    idToken: string;
    expiresIn: number;
  }> {
    try {
      const refreshResponse = await this.cognitoService.refreshTokens(
        refreshTokenDto.refreshToken,
      );

      if (!refreshResponse.AuthenticationResult) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return {
        accessToken: refreshResponse.AuthenticationResult.AccessToken!,
        idToken: refreshResponse.AuthenticationResult.IdToken!,
        expiresIn: refreshResponse.AuthenticationResult.ExpiresIn!,
      };
    } catch (error: any) {
      if (error.name === 'NotAuthorizedException') {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      throw new InternalServerErrorException('Token refresh failed');
    }
  }

  async changePassword(
    accessToken: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    try {
      await this.cognitoService.changePassword(
        accessToken,
        changePasswordDto.oldPassword,
        changePasswordDto.newPassword,
      );

      return { message: 'Password changed successfully' };
    } catch (error: any) {
      if (error.name === 'NotAuthorizedException') {
        throw new UnauthorizedException('Current password is incorrect');
      }

      if (error.name === 'InvalidPasswordException') {
        throw new BadRequestException(
          'New password does not meet requirements',
        );
      }

      throw new InternalServerErrorException('Password change failed');
    }
  }

  async getProfile(cognitoSub: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { cognitoSub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Update role in database
    user.role = role;
    await this.userRepository.save(user);

    // Update role in Cognito
    try {
      await this.cognitoService.adminUpdateUserAttributes(user.cognitoSub, [
        { Name: 'custom:role', Value: role },
      ]);
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to update Cognito role:', error);
    }

    return user;
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.status = status;
    return await this.userRepository.save(user);
  }

  async confirmEmail(
    confirmEmailDto: ConfirmEmailDto,
  ): Promise<{ message: string }> {
    try {
      await this.cognitoService.confirmEmail(
        confirmEmailDto.email,
        confirmEmailDto.code,
      );

      return {
        message: 'Email verified successfully. You can now log in.',
      };
    } catch (error: any) {
      if (error.name === 'CodeMismatchException') {
        throw new BadRequestException('Invalid verification code');
      }

      if (error.name === 'ExpiredCodeException') {
        throw new BadRequestException(
          'Verification code has expired. Please request a new one.',
        );
      }

      if (error.name === 'UserNotFoundException') {
        throw new BadRequestException('User not found');
      }

      if (error.name === 'NotAuthorizedException') {
        throw new BadRequestException('User is already confirmed');
      }

      console.error('Cognito confirmation error:', error);
      throw new InternalServerErrorException(
        `Email confirmation failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async resendConfirmationCode(
    resendDto: ResendConfirmationDto,
  ): Promise<{ message: string }> {
    try {
      await this.cognitoService.resendConfirmationCode(resendDto.email);

      return {
        message: 'Verification code sent to your email.',
      };
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        throw new BadRequestException('User not found');
      }

      if (error.name === 'InvalidParameterException') {
        throw new BadRequestException('User is already confirmed');
      }

      if (error.name === 'LimitExceededException') {
        throw new BadRequestException(
          'Too many requests. Please try again later.',
        );
      }

      console.error('Cognito resend code error:', error);
      throw new InternalServerErrorException(
        `Failed to resend code: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a user with a temporary password (for admin-created users)
   * Email is auto-verified and user must change password on first login
   *
   * Uses Saga pattern: If DB operations fail after Cognito user creation,
   * the Cognito user is deleted as a compensating transaction.
   */
  async createUser(
    email: string,
    firstName: string,
    lastName: string,
    phone: string | undefined,
    role: UserRole,
    createdById?: string,
  ): Promise<{ user: User; temporaryPassword: string }> {
    // Check if user already exists in database
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate secure temporary password
    const temporaryPassword = this.generateTemporaryPassword();

    // Build user attributes for Cognito
    const attributes = [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' }, // Auto-verify email
      { Name: 'given_name', Value: firstName },
      { Name: 'family_name', Value: lastName },
      ...(phone ? [{ Name: 'phone_number', Value: phone }] : []),
      { Name: 'custom:role', Value: role },
    ];

    // Step 1: Create user in Cognito (external service - cannot be rolled back by DB transaction)
    let createUserResponse;
    try {
      createUserResponse = await this.cognitoService.adminCreateUser(
        email,
        temporaryPassword,
        attributes,
        true, // Suppress Cognito's default email
      );
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        throw new ConflictException('User with this email already exists');
      }
      if (error.name === 'InvalidPasswordException') {
        throw new BadRequestException('Password does not meet requirements');
      }
      if (error.name === 'InvalidParameterException') {
        throw new BadRequestException(`Invalid parameter: ${error.message}`);
      }
      console.error('Cognito create user error:', error);
      throw new InternalServerErrorException(
        `Failed to create user: ${error.message || 'Unknown error'}`,
      );
    }

    if (!createUserResponse.User?.Username) {
      throw new InternalServerErrorException('Failed to create user');
    }

    // Get the Cognito Sub from the user attributes
    const cognitoSub = createUserResponse.User.Attributes?.find(
      (attr) => attr.Name === 'sub',
    )?.Value;

    if (!cognitoSub) {
      // Compensating transaction: Delete Cognito user if we can't get the sub
      await this.deleteCognitoUserSafe(email);
      throw new InternalServerErrorException('Failed to retrieve Cognito Sub');
    }

    // Step 2: Create user in database (with compensating transaction if it fails)
    try {
      const user = this.userRepository.create({
        cognitoSub,
        email,
        firstName,
        lastName,
        phone,
        role,
        status: UserStatus.ACTIVE,
        createdById,
      });

      await this.userRepository.save(user);

      return {
        user,
        temporaryPassword,
      };
    } catch (dbError: any) {
      // Compensating transaction: Delete Cognito user since DB save failed
      console.error(
        `[AuthService] DB save failed, rolling back Cognito user: ${email}`,
        dbError,
      );
      await this.deleteCognitoUserSafe(email);

      if (dbError instanceof ConflictException) {
        throw dbError;
      }
      throw new InternalServerErrorException(
        `Failed to create user in database: ${dbError.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a Cognito user only (no DB record)
   * Used when caller wants to handle DB operations in their own transaction.
   *
   * This method:
   * 1. Checks if user already exists in DB (throws ConflictException if yes)
   * 2. Creates user in Cognito with temporary password
   * 3. Returns cognitoSub and temporaryPassword for caller to use
   *
   * Caller is responsible for:
   * - Creating the DB user record
   * - Implementing compensating transaction (delete Cognito user) if DB fails
   *
   * @param email - User email
   * @param firstName - User first name
   * @param lastName - User last name
   * @param phone - User phone (optional)
   * @param role - User role
   * @returns cognitoSub and temporaryPassword
   */
  async createCognitoUserOnly(
    email: string,
    firstName: string,
    lastName: string,
    phone: string | undefined,
    role: UserRole,
  ): Promise<{ cognitoSub: string; temporaryPassword: string }> {
    // Check if user already exists in database
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate secure temporary password
    const temporaryPassword = this.generateTemporaryPassword();

    // Build user attributes for Cognito
    const attributes = [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'given_name', Value: firstName },
      { Name: 'family_name', Value: lastName },
      ...(phone ? [{ Name: 'phone_number', Value: phone }] : []),
      { Name: 'custom:role', Value: role },
    ];

    // Create user in Cognito
    let createUserResponse;
    try {
      createUserResponse = await this.cognitoService.adminCreateUser(
        email,
        temporaryPassword,
        attributes,
        true, // Suppress Cognito's default email
      );
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        throw new ConflictException('User with this email already exists');
      }
      if (error.name === 'InvalidPasswordException') {
        throw new BadRequestException('Password does not meet requirements');
      }
      if (error.name === 'InvalidParameterException') {
        throw new BadRequestException(`Invalid parameter: ${error.message}`);
      }
      console.error('Cognito create user error:', error);
      throw new InternalServerErrorException(
        `Failed to create user: ${error.message || 'Unknown error'}`,
      );
    }

    if (!createUserResponse.User?.Username) {
      throw new InternalServerErrorException('Failed to create user');
    }

    // Get the Cognito Sub from the user attributes
    const cognitoSub = createUserResponse.User.Attributes?.find(
      (attr) => attr.Name === 'sub',
    )?.Value;

    if (!cognitoSub) {
      // Delete Cognito user if we can't get the sub
      await this.deleteCognitoUserSafe(email);
      throw new InternalServerErrorException('Failed to retrieve Cognito Sub');
    }

    return { cognitoSub, temporaryPassword };
  }

  /**
   * Safely delete a Cognito user (compensating transaction helper)
   * Logs errors but doesn't throw to avoid masking the original error
   */
  private async deleteCognitoUserSafe(email: string): Promise<void> {
    try {
      await this.cognitoService.adminDeleteUser(email);
      console.log(
        `[AuthService] Compensating transaction: Deleted Cognito user ${email}`,
      );
    } catch (deleteError) {
      // Log but don't throw - we don't want to mask the original error
      console.error(
        `[AuthService] Failed to delete Cognito user ${email} during rollback:`,
        deleteError,
      );
    }
  }

  /**
   * Complete the NEW_PASSWORD_REQUIRED challenge on first login
   */
  async completeNewPasswordChallenge(
    email: string,
    session: string,
    newPassword: string,
  ): Promise<AuthTokensResponse> {
    try {
      const response = await this.cognitoService.respondToNewPasswordChallenge(
        email,
        session,
        newPassword,
      );

      if (!response.AuthenticationResult) {
        throw new UnauthorizedException('Failed to complete password change');
      }

      // Update lastLogin and onboarding status in database
      try {
        const user = await this.userRepository.findOne({
          where: { email },
        });

        if (user) {
          user.lastLogin = new Date();
          // Set onboarding status to 'in_progress' on first password change
          if (!user.onboardingStatus) {
            user.onboardingStatus = 'in_progress' as any;
          }
          await this.userRepository.save(user);
        }
      } catch (dbError) {
        // Log error but don't fail the login
        console.error(
          'Failed to update lastLogin and onboarding status:',
          dbError,
        );
      }

      return {
        accessToken: response.AuthenticationResult.AccessToken!,
        idToken: response.AuthenticationResult.IdToken!,
        refreshToken: response.AuthenticationResult.RefreshToken!,
        expiresIn: response.AuthenticationResult.ExpiresIn!,
      };
    } catch (error: any) {
      if (error.name === 'InvalidPasswordException') {
        throw new BadRequestException(
          'New password does not meet requirements',
        );
      }

      if (error.name === 'NotAuthorizedException') {
        throw new UnauthorizedException('Invalid session or credentials');
      }

      console.error('Complete new password error:', error);
      throw new InternalServerErrorException('Failed to set new password');
    }
  }

  /**
   * Generate a secure temporary password that meets Cognito requirements
   */
  private generateTemporaryPassword(): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed I, O for clarity
    const lowercase = 'abcdefghijkmnopqrstuvwxyz'; // Removed l for clarity
    const numbers = '23456789'; // Removed 0, 1 for clarity
    const symbols = '!@#$%^&*';

    // Ensure at least one of each type
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest randomly (total 12 characters)
    const allChars = uppercase + lowercase + numbers + symbols;
    for (let i = password.length; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
