import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ChangePasswordCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
  GetUserCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  AdminCreateUserCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventType } from '../analytics/entities/user-event.entity';

@Injectable()
export class AuthService {
  private cognitoClient: CognitoIdentityProviderClient;
  private clientId: string;
  private userPoolId: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private analyticsService: AnalyticsService,
  ) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('AWS_REGION'),
    });
    this.clientId = this.configService.get<string>('AWS_COGNITO_CLIENT_ID')!;
    this.userPoolId = this.configService.get<string>(
      'AWS_COGNITO_USER_POOL_ID',
    )!;
  }

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

      // Sign up user in Cognito
      const signUpCommand = new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
          ...(phone ? [{ Name: 'phone_number', Value: phone }] : []),
          ...(role ? [{ Name: 'custom:role', Value: role }] : []),
        ],
      });

      const signUpResponse = await this.cognitoClient.send(signUpCommand);

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
        throw new ConflictException(
          'User with this email already exists in Cognito',
        );
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

  async login(loginDto: LoginDto): Promise<
    | {
        accessToken: string;
        idToken: string;
        refreshToken: string;
        expiresIn: number;
      }
    | {
        challengeName: string;
        session: string;
        message: string;
      }
  > {
    const { email, password } = loginDto;

    try {
      const authCommand = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const authResponse = await this.cognitoClient.send(authCommand);

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
        const user = await this.userRepository.findOne({
          where: { email },
        });

        if (user) {
          user.lastLogin = new Date();
          await this.userRepository.save(user);

          // Track login event
          await this.analyticsService.trackEvent({
            userId: user.id,
            eventType: EventType.LOGIN,
            role: user.role,
            affiliateId: user.affiliate_profile_id,
          });
        }
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
      const refreshCommand = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshTokenDto.refreshToken,
        },
      });

      const refreshResponse = await this.cognitoClient.send(refreshCommand);

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
      const changePasswordCommand = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: changePasswordDto.oldPassword,
        ProposedPassword: changePasswordDto.newPassword,
      });

      await this.cognitoClient.send(changePasswordCommand);

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
      const updateCommand = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: user.cognitoSub,
        UserAttributes: [{ Name: 'custom:role', Value: role }],
      });

      await this.cognitoClient.send(updateCommand);
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
      const confirmCommand = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: confirmEmailDto.email,
        ConfirmationCode: confirmEmailDto.code,
      });

      await this.cognitoClient.send(confirmCommand);

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
      const resendCommand = new ResendConfirmationCodeCommand({
        ClientId: this.clientId,
        Username: resendDto.email,
      });

      await this.cognitoClient.send(resendCommand);

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
   */
  async createUser(
    email: string,
    firstName: string,
    lastName: string,
    phone: string | undefined,
    role: UserRole,
    createdById?: string,
  ): Promise<{ user: User; temporaryPassword: string }> {
    try {
      // Check if user already exists in database
      const existingUser = await this.userRepository.findOne({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Generate secure temporary password
      const temporaryPassword = this.generateTemporaryPassword();

      // Create user in Cognito with AdminCreateUser
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        TemporaryPassword: temporaryPassword,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' }, // Auto-verify email
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
          ...(phone ? [{ Name: 'phone_number', Value: phone }] : []),
          { Name: 'custom:role', Value: role },
        ],
        MessageAction: 'SUPPRESS', // Don't send Cognito's default email
      });

      const createUserResponse =
        await this.cognitoClient.send(createUserCommand);

      if (!createUserResponse.User?.Username) {
        throw new InternalServerErrorException(
          'Failed to create user in Cognito',
        );
      }

      // Get the Cognito Sub from the user attributes
      const cognitoSub = createUserResponse.User.Attributes?.find(
        (attr) => attr.Name === 'sub',
      )?.Value;

      if (!cognitoSub) {
        throw new InternalServerErrorException(
          'Failed to retrieve Cognito Sub',
        );
      }

      // Create user record in database
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
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (error.name === 'UsernameExistsException') {
        throw new ConflictException(
          'User with this email already exists in Cognito',
        );
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
  }

  /**
   * Complete the NEW_PASSWORD_REQUIRED challenge on first login
   */
  async completeNewPasswordChallenge(
    email: string,
    session: string,
    newPassword: string,
  ): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      const respondCommand = new RespondToAuthChallengeCommand({
        ClientId: this.clientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword,
        },
      });

      const response = await this.cognitoClient.send(respondCommand);

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
