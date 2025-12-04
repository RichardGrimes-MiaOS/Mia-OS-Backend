import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as fs from 'fs';
import * as path from 'path';

export interface SendApplicationReceivedEmailDto {
  email: string;
  firstName: string;
  lastName: string;
  organization: string;
  primaryState: string;
  submittedDate: string;
}

export interface SendWelcomeEmailDto {
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
  role?: string;
}

@Injectable()
export class EmailService {
  private sesClient: SESClient;
  private fromEmail: string;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // In development: use 'mia' AWS profile
    // In production (ECS): use IAM roles (no credentials needed)
    this.sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-2',
      ...(isDevelopment && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      }),
    });

    this.fromEmail = process.env.SES_FROM_EMAIL || 'noreply@yourdomain.com';

    console.log(
      `[EmailService] Initialized with ${isDevelopment ? 'local credentials' : 'IAM role'} in ${process.env.AWS_REGION || 'us-east-1'}`,
    );
  }

  /**
   * Send application received confirmation email
   */
  async sendApplicationReceivedEmail(
    data: SendApplicationReceivedEmailDto,
  ): Promise<void> {
    try {
      const htmlTemplate = this.loadEmailTemplate('application-received.html');
      const htmlBody = this.replaceTemplateVariables(htmlTemplate, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        organization: data.organization,
        primaryState: data.primaryState,
        submittedDate: data.submittedDate,
        currentYear: new Date().getFullYear().toString(),
      });

      const textBody = this.generateTextVersion(data);

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [data.email],
        },
        Message: {
          Subject: {
            Data: 'Application Received - MIA',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      });

      await this.sesClient.send(command);
      console.log(`Application received email sent to ${data.email}`);
    } catch (error) {
      console.error('Failed to send email via SES:', error);
      // Don't throw error - we don't want to fail the application creation if email fails
      // Just log it for monitoring
    }
  }

  /**
   * Load email template from file
   */
  private loadEmailTemplate(templateName: string): string {
    try {
      // In development: src/templates/email/
      // In production: dist/templates/email/
      const templatePath = path.join(
        __dirname,
        '..',
        'templates',
        'email',
        templateName,
      );

      console.log(`[EmailService] Loading template from: ${templatePath}`);
      return fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error(`Failed to load email template: ${templateName}`, error);
      throw new InternalServerErrorException('Failed to load email template');
    }
  }

  /**
   * Replace template variables with actual values
   */
  private replaceTemplateVariables(
    template: string,
    variables: Record<string, string>,
  ): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  /**
   * Generate plain text version of the email
   */
  private generateTextVersion(data: SendApplicationReceivedEmailDto): string {
    return `
APPLICATION RECEIVED - MIA

Hi ${data.firstName},

Thank you for submitting your application. We've successfully received your information and our team is currently reviewing it.

WHAT HAPPENS NEXT?
Our team will carefully review your application and get back to you within 2-3 business days. If we need any additional information, we'll reach out to you at ${data.email}.

APPLICATION DETAILS:
- Name: ${data.firstName} ${data.lastName}
- Organization: ${data.organization}
- State: ${data.primaryState}
- Submitted: ${data.submittedDate}

If you have any questions, feel free to reply to this email. We're here to help!

© ${new Date().getFullYear()} MIA. All rights reserved.

You're receiving this email because you submitted an application on our website.
    `.trim();
  }

  /**
   * Send welcome email with temporary credentials
   */
  async sendWelcomeEmail(data: SendWelcomeEmailDto): Promise<void> {
    try {
      const htmlTemplate = this.loadEmailTemplate('welcome.html');
      const htmlBody = this.replaceTemplateVariables(htmlTemplate, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        temporaryPassword: data.temporaryPassword,
        role: data.role || '',
        currentYear: new Date().getFullYear().toString(),
      });

      const textBody = this.generateWelcomeTextVersion(data);

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [data.email],
        },
        Message: {
          Subject: {
            Data: 'Welcome to MIA - Your Account is Ready!',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          },
        },
      });

      await this.sesClient.send(command);
      console.log(`Welcome email sent to ${data.email}`);
    } catch (error) {
      console.error('Failed to send welcome email via SES:', error);
      // Don't throw error - log for monitoring
    }
  }

  /**
   * Generate plain text version of the welcome email
   */
  private generateWelcomeTextVersion(data: SendWelcomeEmailDto): string {
    return `
WELCOME TO MIA!

Hi ${data.firstName},

Your application has been approved! Your account has been created and you can now log in to start your onboarding process.

YOUR LOGIN CREDENTIALS:
Email: ${data.email}
Temporary Password: ${data.temporaryPassword}

IMPORTANT: You will be required to change this temporary password when you first log in. Please keep this email safe until you've completed your first login.

Log in here: https://app.mia.com/login

If you have any questions, please contact our support team at support@mia.com

© ${new Date().getFullYear()} MIA. All rights reserved.
    `.trim();
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(testEmail: string): Promise<boolean> {
    try {
      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [testEmail],
        },
        Message: {
          Subject: {
            Data: 'MIA - Email Configuration Test',
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: 'This is a test email to verify SES configuration. If you received this, your email setup is working correctly!',
              Charset: 'UTF-8',
            },
          },
        },
      });

      await this.sesClient.send(command);
      console.log(`Test email sent successfully to ${testEmail}`);
      return true;
    } catch (error) {
      console.error('Email configuration test failed:', error);
      return false;
    }
  }
}
