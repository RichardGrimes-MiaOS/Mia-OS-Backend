# Email Setup with AWS SES

This guide explains how to set up and configure AWS SES (Simple Email Service) for sending automated emails.

## Overview

The application automatically sends confirmation emails to applicants when they submit an application through the public endpoint.

## AWS SES Configuration

### 1. Verify Your Email/Domain

**Option A: Single Email Address (for testing)**
1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Navigate to **Verified identities**
3. Click **Create identity**
4. Select **Email address**
5. Enter your email (e.g., `noreply@yourdomain.com`)
6. Check your inbox and click the verification link
7. Status will change to "Verified"

**Option B: Domain Verification (for production)**
1. In SES Console, click **Create identity**
2. Select **Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Choose **Easy DKIM** (recommended)
5. Add the provided DNS records to your domain
6. Wait for verification (can take up to 72 hours)

### 2. Get Out of SES Sandbox

By default, SES is in **sandbox mode** which restricts:
- Can only send to verified email addresses
- Limited to 200 emails/day
- 1 email per second

**To request production access:**
1. In SES Console, click **Account dashboard**
2. Click **Request production access**
3. Fill out the form:
   - **Use case**: Transactional emails
   - **Website URL**: Your domain
   - **Expected sending volume**: Your estimate
   - **Describe how you'll handle bounces/complaints**: Explain your process
4. Submit and wait for approval (usually 24 hours)


##### Production (ECS)

**Use IAM Task Role** (No credentials needed in environment)

1. Create IAM Role for ECS Task:
   - Go to IAM Console → **Roles** → **Create role**
   - Select **AWS service** → **Elastic Container Service** → **Elastic Container Service Task**
   - Attach custom SES policy (see below)
   - Name: `mia-crm-ecs-task-role`

2. Attach to ECS Task Definition:
   ```json
   {
     "taskRoleArn": "arn:aws:iam::123456789012:role/mia-crm-ecs-task-role",
     "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"
   }
   ```

3. Environment variables for production:
   ```env
   NODE_ENV=production
   AWS_REGION=us-east-2
   SES_FROM_EMAIL=noreply@yourdomain.com
   # No AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY needed - IAM role is used
   ```

**Custom SES Policy (Least Privilege):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

### 4. How Credential Resolution Works

The email service automatically detects the environment:

```typescript
// Development: Uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from .env
// Production: Uses IAM role attached to ECS task (no credentials needed)
const isDevelopment = process.env.NODE_ENV === 'development';
```

**Credential Priority:**
1. Production (ECS): IAM Task Role (automatic)
2. Development: Environment variables from `.env`
3. Development: AWS CLI profile from `~/.aws/credentials`

**Important Security Notes:**
- ✅ Never commit `.env` file to git
- ✅ Use IAM roles for ECS (no credentials in environment)
- ✅ Use different IAM users/roles for dev and prod
- ✅ Follow principle of least privilege
- ✅ Rotate development credentials regularly
- ✅ Monitor CloudTrail for credential usage

## Email Service Features

### Automatic Application Confirmation

When an applicant submits their application:

1. Application is saved to database
2. Email is sent asynchronously (doesn't block the request)
3. If email fails, the application still succeeds
4. Email errors are logged but don't affect the user

### Email Content

- **HTML version**: Branded email with Vice theme colors
- **Plain text version**: Automatically generated fallback
- **Responsive design**: Works on all devices and email clients
- **Template variables**: Dynamically filled with applicant data

### Template Location

Email templates are located in:
```
src/templates/email/
├── application-received.html
└── README.md
```
