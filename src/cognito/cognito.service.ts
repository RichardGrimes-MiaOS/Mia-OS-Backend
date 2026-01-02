import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminGetUserCommandOutput,
  SignUpCommand,
  SignUpCommandOutput,
  InitiateAuthCommand,
  InitiateAuthCommandOutput,
  ChangePasswordCommand,
  AdminUpdateUserAttributesCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  AdminCreateUserCommand,
  AdminCreateUserCommandOutput,
  RespondToAuthChallengeCommand,
  RespondToAuthChallengeCommandOutput,
  AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * Central service for all AWS Cognito operations.
 * Provides a shared Cognito client and common user management methods.
 *
 * All Cognito operations should go through this service to ensure
 * consistent configuration and avoid duplicating the Cognito client.
 */
@Injectable()
export class CognitoService {
  private cognitoClient: CognitoIdentityProviderClient;
  private userPoolId: string;
  readonly clientId: string;

  constructor(private configService: ConfigService) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('AWS_REGION'),
    });
    this.userPoolId = this.configService.get<string>(
      'AWS_COGNITO_USER_POOL_ID',
    )!;
    this.clientId = this.configService.get<string>('AWS_COGNITO_CLIENT_ID')!;
  }

  /**
   * Get the User Pool ID
   */
  getUserPoolId(): string {
    return this.userPoolId;
  }

  // ==================== USER LOOKUP ====================

  /**
   * Check if a user exists in Cognito by email (username)
   *
   * @param email - The email/username to check
   * @returns true if user exists, false otherwise
   */
  async userExists(email: string): Promise<boolean> {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });

      await this.cognitoClient.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get user details from Cognito by email (username)
   *
   * @param email - The email/username to look up
   * @returns Cognito user details or null if not found
   */
  async getUser(email: string): Promise<AdminGetUserCommandOutput | null> {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });

      return await this.cognitoClient.send(command);
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  // ==================== USER REGISTRATION ====================

  /**
   * Sign up a new user (self-registration flow)
   *
   * @param email - User's email (used as username)
   * @param password - User's password
   * @param attributes - Additional user attributes
   * @returns SignUp response with UserSub
   */
  async signUp(
    email: string,
    password: string,
    attributes: AttributeType[],
  ): Promise<SignUpCommandOutput> {
    const command = new SignUpCommand({
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: attributes,
    });

    return await this.cognitoClient.send(command);
  }

  /**
   * Create a user with admin privileges (admin-created user flow)
   * User will need to change password on first login
   *
   * @param email - User's email (used as username)
   * @param temporaryPassword - Temporary password for first login
   * @param attributes - User attributes
   * @param suppressEmail - If true, don't send Cognito's default email
   * @returns AdminCreateUser response
   */
  async adminCreateUser(
    email: string,
    temporaryPassword: string,
    attributes: AttributeType[],
    suppressEmail: boolean = true,
  ): Promise<AdminCreateUserCommandOutput> {
    const command = new AdminCreateUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      TemporaryPassword: temporaryPassword,
      UserAttributes: attributes,
      MessageAction: suppressEmail ? 'SUPPRESS' : undefined,
    });

    return await this.cognitoClient.send(command);
  }

  // ==================== AUTHENTICATION ====================

  /**
   * Authenticate user with email and password
   *
   * @param email - User's email
   * @param password - User's password
   * @returns Authentication result with tokens or challenge
   */
  async initiateAuth(
    email: string,
    password: string,
  ): Promise<InitiateAuthCommandOutput> {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    return await this.cognitoClient.send(command);
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - The refresh token
   * @returns New access and ID tokens
   */
  async refreshTokens(refreshToken: string): Promise<InitiateAuthCommandOutput> {
    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: this.clientId,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    return await this.cognitoClient.send(command);
  }

  /**
   * Respond to NEW_PASSWORD_REQUIRED challenge (first login with temp password)
   *
   * @param email - User's email
   * @param session - Session from challenge response
   * @param newPassword - New password to set
   * @returns Authentication result with tokens
   */
  async respondToNewPasswordChallenge(
    email: string,
    session: string,
    newPassword: string,
  ): Promise<RespondToAuthChallengeCommandOutput> {
    const command = new RespondToAuthChallengeCommand({
      ClientId: this.clientId,
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        NEW_PASSWORD: newPassword,
      },
    });

    return await this.cognitoClient.send(command);
  }

  // ==================== PASSWORD MANAGEMENT ====================

  /**
   * Change password for authenticated user
   *
   * @param accessToken - User's current access token
   * @param oldPassword - Current password
   * @param newPassword - New password
   */
  async changePassword(
    accessToken: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const command = new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: oldPassword,
      ProposedPassword: newPassword,
    });

    await this.cognitoClient.send(command);
  }

  // ==================== EMAIL VERIFICATION ====================

  /**
   * Confirm user's email with verification code
   *
   * @param email - User's email
   * @param code - Verification code from email
   */
  async confirmEmail(email: string, code: string): Promise<void> {
    const command = new ConfirmSignUpCommand({
      ClientId: this.clientId,
      Username: email,
      ConfirmationCode: code,
    });

    await this.cognitoClient.send(command);
  }

  /**
   * Resend email verification code
   *
   * @param email - User's email
   */
  async resendConfirmationCode(email: string): Promise<void> {
    const command = new ResendConfirmationCodeCommand({
      ClientId: this.clientId,
      Username: email,
    });

    await this.cognitoClient.send(command);
  }

  // ==================== USER ATTRIBUTES ====================

  /**
   * Update user attributes in Cognito (admin operation)
   *
   * @param username - User's username (email or cognitoSub)
   * @param attributes - Attributes to update
   */
  async adminUpdateUserAttributes(
    username: string,
    attributes: AttributeType[],
  ): Promise<void> {
    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: this.userPoolId,
      Username: username,
      UserAttributes: attributes,
    });

    await this.cognitoClient.send(command);
  }
}
