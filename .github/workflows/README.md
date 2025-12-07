# GitHub Actions Workflows

This directory contains automated deployment workflows for the MIA CRM Backend.

## Workflows

### 1. Deploy to Development (`deploy-dev.yml`)

**Triggers:**
- Manual trigger via workflow_dispatch
- Push to `develop` branch
- Push to `main` branch (for testing before production)

**What it does:**
- Builds Docker image
- Pushes to ECR repository: `mia-development-backend`
- Deploys to ECS service: `mia-backend-dev`
- Waits for deployment to stabilize

**Environment:** `development`

### 2. Deploy to Production (`deploy-prod.yml`)

**Triggers:**
- Manual trigger via workflow_dispatch
- GitHub release published

**What it does:**
- Builds Docker image
- Pushes to ECR repository: `mia-production-backend`
- Tags with release version (if triggered by release)
- Deploys to ECS service: `mia-backend-prod`
- Waits for deployment to stabilize

**Environment:** `production`

## Setup Required

### GitHub Secrets

Add these secrets to your repository settings:

```
AWS_ACCESS_KEY_ID        - AWS IAM user access key
AWS_SECRET_ACCESS_KEY    - AWS IAM user secret key
```

### GitHub Environments

Configure these environments in repository settings:

1. **development** - For dev deployments
2. **production** - For production deployments (add protection rules)

### IAM Permissions Required

The AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices"
      ],
      "Resource": [
        "arn:aws:ecs:us-east-1:*:service/mia-backend-cluster/mia-backend-dev",
        "arn:aws:ecs:us-east-1:*:service/mia-backend-cluster/mia-backend-prod"
      ]
    }
  ]
}
```

## Usage

### Manual Deployment

**Development:**
1. Go to Actions tab
2. Select "Deploy to Development"
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

**Production:**
1. Go to Actions tab
2. Select "Deploy to Production"
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

### Automated Deployment

**Development:**
- Push to `develop` branch triggers automatic deployment

**Production:**
- Create and publish a GitHub release triggers automatic deployment
- Release tag is used for Docker image tagging

## Deployment Flow

```
┌─────────────────┐
│  GitHub Action  │
│     Starts      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Checkout Code  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Build Image   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Push to ECR   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update ECS Svc  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Wait for       │
│  Stabilization  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Complete     │
└─────────────────┘
```

## Notes

- Images are tagged with both `latest` and the commit SHA
- Production images also tagged with release version
- Deployments wait for service to stabilize before completing
- Failed deployments will automatically roll back (ECS circuit breaker)

## Troubleshooting

### Deployment fails with "CannotPullContainerError"

This happens on first deployment when ECR repository is empty:

1. Deploy infrastructure: `ENVIRONMENT=development pnpm cdk deploy`
2. Manually build and push first image using `scripts/deploy-backend.sh build`
3. Then GitHub Actions will work for subsequent deployments

### Service stuck in "DRAINING" state

- Check ECS service events in AWS Console
- Check CloudWatch logs for container errors
- Verify health check endpoint is responding

### Authentication errors

- Verify AWS credentials are correct in GitHub Secrets
- Check IAM user has required permissions
- Ensure ECR repository exists in the correct region
