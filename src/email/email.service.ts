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

export interface SendActivationEmailDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userId: string;
  isFastTrack?: boolean;
}

export interface SendOnboardedEmailDto {
  email: string;
  firstName: string;
  lastName: string;
}

export interface SendActivationRejectedEmailDto {
  email: string;
  firstName: string;
  lastName: string;
  notes?: string;
}

export interface SendApplicationRejectedEmailDto {
  email: string;
  firstName: string;
  lastName: string;
  notes?: string;
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
      region: process.env.AWS_REGION || 'us-east-1',
      ...(isDevelopment && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      }),
    });

    this.fromEmail = process.env.SES_FROM_EMAIL!;

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
   * Send activation request email to Richard
   */
  async sendActivationEmail(
    data: SendActivationEmailDto,
    recipientEmail: string,
  ): Promise<void> {
    try {
      const htmlTemplate = this.loadEmailTemplate('activation-request.html');
      const adminPortalUrl =
        process.env.ADMIN_PORTAL_URL || 'https://admin.makeincomeanywhere.com';

      // Generate completed steps based on path type
      const completedSteps = data.isFastTrack
        ? '✅ Licensed Agent Intake Submitted<br />\n                              ✅ Multi-State Licenses Uploaded<br />\n                              ✅ E&O Insurance Uploaded'
        : '✅ Pre-licensing Training Registered<br />\n                              ✅ Licensing Exam Passed<br />\n                              ✅ E&O Insurance Uploaded';

      const htmlBody = this.replaceTemplateVariables(htmlTemplate, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || 'N/A',
        userId: data.userId,
        adminPortalUrl,
        completedSteps,
        currentYear: new Date().getFullYear().toString(),
      });

      const textBody = this.generateActivationTextVersion(data, adminPortalUrl);

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [recipientEmail],
        },
        Message: {
          Subject: {
            Data: `Agent Activation Request - ${data.firstName} ${data.lastName}`,
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
      console.log(
        `Activation email sent to ${recipientEmail} for user ${data.userId}`,
      );
    } catch (error) {
      console.error('Failed to send activation email via SES:', error);
      // Don't throw error - log for monitoring
    }
  }

  /**
   * Generate plain text version of the activation email
   */
  private generateActivationTextVersion(
    data: SendActivationEmailDto,
    adminPortalUrl: string,
  ): string {
    const completedSteps = data.isFastTrack
      ? `✅ Licensed Agent Intake Submitted
✅ Multi-State Licenses Uploaded
✅ E&O Insurance Uploaded`
      : `✅ Pre-licensing Training Registered
✅ Licensing Exam Passed
✅ E&O Insurance Uploaded`;

    return `
AGENT ACTIVATION REQUEST

Hi Richard,

A new agent has completed their onboarding requirements and is ready for activation!

AGENT INFORMATION:
- Name: ${data.firstName} ${data.lastName}
- Email: ${data.email}
- Phone: ${data.phone || 'N/A'}
- User ID: ${data.userId}

COMPLETED STEPS:
${completedSteps}

Please review the agent's information in the admin portal and approve for activation.

Review in Admin Portal: ${adminPortalUrl}

This is an automated notification from the MIA CRM system.

© ${new Date().getFullYear()} Make Income Anywhere. All rights reserved.
    `.trim();
  }

  /**
   * Send onboarded confirmation email to agent
   */
  async sendOnboardedEmail(data: SendOnboardedEmailDto): Promise<void> {
    try {
      const htmlTemplate = this.loadEmailTemplate('onboarded.html');
      const dashboardUrl =
        process.env.AGENT_DASHBOARD_URL || 'https://app.makeincomeanywhere.com';

      const htmlBody = this.replaceTemplateVariables(htmlTemplate, {
        firstName: data.firstName,
        lastName: data.lastName,
        dashboardUrl,
        currentYear: new Date().getFullYear().toString(),
      });

      const textBody = this.generateOnboardedTextVersion(data, dashboardUrl);

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [data.email],
        },
        Message: {
          Subject: {
            Data: "Congratulations! You're Now an Active Agent - MIA",
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
      console.log(`Onboarded email sent to ${data.email}`);
    } catch (error) {
      console.error('Failed to send onboarded email via SES:', error);
      // Don't throw error - log for monitoring
    }
  }

  /**
   * Generate plain text version of the onboarded email
   */
  private generateOnboardedTextVersion(
    data: SendOnboardedEmailDto,
    dashboardUrl: string,
  ): string {
    return `
CONGRATULATIONS!

Hi ${data.firstName},

You've been officially activated as a MIA Agent!

Your onboarding is complete and you're now ready to start your journey with us. Welcome to the team!

YOUR STATUS:
- Role: Agent
- Onboarding Status: ✅ Complete

WHAT'S NEXT?
📱 Access your full agent dashboard
📊 Review available resources and tools
👥 Connect with your team
🚀 Start making income anywhere!

We're excited to have you on board! Your dedication during the onboarding process shows your commitment to success. If you have any questions as you get started, don't hesitate to reach out to your team lead or support.

Go to Dashboard: ${dashboardUrl}

If you have any questions, please contact your team lead or support.

© ${new Date().getFullYear()} Make Income Anywhere. All rights reserved.
    `.trim();
  }

  /**
   * Send activation rejected email to agent
   */
  async sendActivationRejectedEmail(
    data: SendActivationRejectedEmailDto,
  ): Promise<void> {
    try {
      const htmlTemplate = this.loadEmailTemplate('activation-rejected.html');
      const dashboardUrl =
        process.env.AGENT_DASHBOARD_URL || 'https://app.makeincomeanywhere.com';

      const htmlBody = this.replaceTemplateVariables(htmlTemplate, {
        firstName: data.firstName,
        lastName: data.lastName,
        notes: data.notes || 'Please review your submission and resubmit.',
        dashboardUrl,
        currentYear: new Date().getFullYear().toString(),
      });

      const textBody = this.generateActivationRejectedTextVersion(
        data,
        dashboardUrl,
      );

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [data.email],
        },
        Message: {
          Subject: {
            Data: 'Activation Request Update - MIA',
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
      console.log(`Activation rejected email sent to ${data.email}`);
    } catch (error) {
      console.error('Failed to send activation rejected email via SES:', error);
      // Don't throw error - log for monitoring
    }
  }

  /**
   * Generate plain text version of the activation rejected email
   */
  private generateActivationRejectedTextVersion(
    data: SendActivationRejectedEmailDto,
    dashboardUrl: string,
  ): string {
    return `
ACTIVATION REQUEST UPDATE

Hi ${data.firstName},

We've reviewed your activation request, and unfortunately we need you to make some adjustments before we can approve your activation.

CURRENT STATUS:
- Activation Status: ⚠️ Requires Changes
- Onboarding Status: In Progress

REVIEW FEEDBACK:
${data.notes || 'Please review your submission and resubmit.'}

WHAT'S NEXT?
📝 Review the feedback above carefully
🔧 Make the necessary adjustments
📤 Resubmit your activation request
✅ We'll review it as soon as possible

Don't be discouraged! This is a normal part of the process. Review the feedback, make the necessary updates, and resubmit. We're here to help you succeed!

Go to Dashboard: ${dashboardUrl}

If you have any questions about the feedback, please contact your team lead or support.

© ${new Date().getFullYear()} Make Income Anywhere. All rights reserved.
    `.trim();
  }

  /**
   * Send application rejected email to applicant
   */
  async sendApplicationRejectedEmail(
    data: SendApplicationRejectedEmailDto,
  ): Promise<void> {
    try {
      const htmlTemplate = this.loadEmailTemplate('application-rejected.html');

      const htmlBody = this.replaceTemplateVariables(htmlTemplate, {
        firstName: data.firstName,
        lastName: data.lastName,
        notes:
          data.notes ||
          'Unfortunately, we are unable to move forward with your application at this time.',
        currentYear: new Date().getFullYear().toString(),
      });

      const textBody = this.generateApplicationRejectedTextVersion(data);

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [data.email],
        },
        Message: {
          Subject: {
            Data: 'Application Status Update - MIA',
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
      console.log(`Application rejected email sent to ${data.email}`);
    } catch (error) {
      console.error(
        'Failed to send application rejected email via SES:',
        error,
      );
      // Don't throw error - log for monitoring
    }
  }

  /**
   * Generate plain text version of the application rejected email
   */
  private generateApplicationRejectedTextVersion(
    data: SendApplicationRejectedEmailDto,
  ): string {
    return `
APPLICATION STATUS UPDATE

Hi ${data.firstName},

Thank you for your interest in joining MIA. After careful review of your application, we regret to inform you that we are unable to move forward at this time.

FEEDBACK:
${data.notes || 'Unfortunately, we are unable to move forward with your application at this time.'}

We appreciate the time and effort you put into your application. If you have any questions or would like more information, please don't hesitate to reach out to us.

We wish you the best in your future endeavors.

If you have any questions, please contact our support team at support@makeincomeanywhere.com

© ${new Date().getFullYear()} Make Income Anywhere. All rights reserved.
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
