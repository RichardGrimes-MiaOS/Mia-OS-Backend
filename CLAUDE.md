# MIA CRM Backend

## Project Overview

A NestJS-based CRM backend system designed for managing insurance agent onboarding, licensing workflows, affiliate tracking, and activation processes. The system implements event sourcing patterns for complete audit trails, integrates with AWS Cognito for authentication, and uses AWS services (S3, SES) for document storage and email notifications.

## Technology Stack

- **Framework**: NestJS 11.0.1
- **Language**: TypeScript 5.7.3 (ES2023, strict mode)
- **Database**: PostgreSQL with TypeORM 0.3.28
- **Authentication**: AWS Cognito with JWT (passport-jwt)
- **Cloud Services**:
  - AWS Cognito Identity Provider (user management)
  - AWS S3 (document storage with presigned URLs)
  - AWS SES (email notifications)
- **Validation**: class-validator, class-transformer
- **Development**: ts-node, tsconfig-paths for path resolution

## Directory Structure

```
src/
├── activation/              # Admin activation workflows
├── admin-metrics/           # Admin dashboard metrics
├── affiliates/              # Affiliate system & tracking
│   ├── controllers/
│   ├── dto/
│   ├── entities/
│   ├── services/
│   └── utils/
├── analytics/               # Event tracking & analytics
│   ├── dto/
│   └── entities/
├── applicants/              # Pre-signup applicant tracking
│   ├── dto/
│   └── entities/
├── auth/                    # Authentication & authorization
│   ├── decorators/
│   ├── dto/
│   ├── guards/
│   └── strategies/
├── cognito/                 # Central AWS Cognito service (global module)
├── common/                  # Shared utilities
│   ├── filters/
│   ├── interceptors/
│   └── middleware/
├── contacts/                # Contact management (CRM)
│   ├── dto/
│   ├── entities/
│   └── enums/
├── email/                   # Email service (AWS SES)
├── health/                  # Health check endpoints
├── onboarding/              # Agent onboarding workflows
│   ├── dto/
│   ├── entities/
│   └── services/
├── scripts/                 # Utility scripts (create-super-admin)
├── tasks/                   # Task management (CRM)
│   ├── dto/
│   ├── entities/
│   └── enums/
├── templates/               # Email templates
│   └── email/
├── users/                   # User management
│   ├── dto/
│   ├── entities/
│   └── enums/
├── app.module.ts            # Root application module
└── main.ts                  # Application entry point
```

## Coding Conventions

### Entity & Database

- **Entity Properties**: Use camelCase (e.g., `createdAt`, not `created_at`)
- **Database Columns**: TypeORM maps camelCase to snake_case automatically
- **Development Mode**: Using `synchronize: true` - no manual migrations needed during development
- **Event Sourcing**: Append-only history tables (never UPDATE, only INSERT)
- **Snapshots**: Use JSONB columns for frozen point-in-time state captures
- **Audit Fields**: Include `createdAt`, `updatedAt` on all entities

### NestJS Patterns

- **Controllers**: HTTP endpoints with route decorators, use DTOs for validation
- **Services**: Business logic with `@Injectable()`, inject repositories via `@InjectRepository()`
- **Modules**: Feature modules with imports/exports, register in `app.module.ts`
- **Guards**: Use `JwtAuthGuard` + `RolesGuard` for protected endpoints
- **Decorators**: `@CurrentUser()` for extracting authenticated user from request
- **DTOs**: class-validator decorators for request validation
- **API Documentation**: Use `@ApiProperty()` decorator from `@nestjs/swagger` on all DTO properties for automatic OpenAPI/Swagger documentation generation
  ```typescript
  // Example: Documenting a DTO property
  @ApiProperty({
    enum: ActionCategory,
    description: 'Action category for precedence ordering'
  })
  category: ActionCategory;
  ```

### Code Style

- **TypeScript**: Strict mode enabled (`strictNullChecks`, `noImplicitAny`)
- **Async/Await**: Use `async/await` over promises
- **Imports**: Use absolute paths via tsconfig-paths
- **Module Resolution**: nodenext (ES modules)
- **Decorators**: experimentalDecorators enabled for NestJS/TypeORM
- **Comments**: Write comprehensive JSDoc-style comments for all major functions and classes
- **Code Documentation Pattern**: Follow this structure:
  ```typescript
  /**
   * Brief description of what this function/class does
   *
   * Detailed explanation (if needed):
   * - Key points about behavior
   * - Important constraints or assumptions
   * - Phase boundaries (if applicable: "Phase 1: X, Phase 2: Y")
   *
   * @param paramName - Description of parameter
   * @returns Description of return value
   *
   * @example
   * const result = myFunction(param);
   */
  ```
- **Inline Comments**: Use inline comments to explain:
  - Complex business logic decisions
  - "Why" over "what" (code shows what, comments explain why)
  - State transitions or thresholds
  - Special cases or edge cases
  - Prerequisite ordering or dependencies
- **Block Comments**: Use block comments for:
  - Rule explanations (e.g., "Rule 1: If onboardingStatus = 'onboarded' → required_actions = []")
  - Algorithm descriptions (e.g., "Density-based pattern analysis")
  - Phase boundaries (e.g., "Phase 1: Static lookup, Phase 2: AI-driven")
- **Enum Documentation**: Add JSDoc comments to enum values explaining their meaning
- **Constant Documentation**: Document magic numbers and thresholds with inline comments

### Security

- **Role-Based Access**: `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` on sensitive endpoints
- **Authentication**: All CRM endpoints protected with `@UseGuards(JwtAuthGuard, RolesGuard)`
- **Token Management**: Cognito handles JWT tokens (accessToken, idToken, refreshToken)

## Key Commands

```bash
# Development
pnpm start:dev             # Start in watch mode
pnpm start:debug           # Start with debugger

# Production
pnpm build                 # Compile TypeScript
pnpm start:prod            # Run compiled code

# Testing
pnpm test                  # Run unit tests
pnpm test:watch            # Run tests in watch mode
pnpm test:cov              # Generate coverage report
pnpm test:e2e              # Run end-to-end tests

# Code Quality
pnpm lint                  # Run ESLint with auto-fix
pnpm format                # Format code with Prettier
npx tsc --noEmit           # Check TypeScript errors without emitting files

# Database
pnpm create-super-admin    # Create initial super admin user
```

## Validation Rules

- **TypeScript Check**: Always run `npx tsc --noEmit` after making code changes to ensure there are no TypeScript errors before committing.

## Important Notes

### Event Sourcing Pattern

- **History = Events**: All historical data stored as append-only events
- **State = Derived**: Current state derived from latest event
- **Example**: `OnboardingReviewSubmission` captures frozen JSONB snapshots on each submission
- **Attempt Numbering**: Auto-incrementing attempt numbers track submission counts
- **Never Delete**: Mark as inactive/archived instead of deleting records

### AWS Cognito Integration

- **Central CognitoService**: Always use `CognitoService` from `src/cognito/` for all Cognito operations. Never instantiate `CognitoIdentityProviderClient` directly in other services.
- **Token Expiration**: Access tokens expire in 1 hour (configurable in AWS, not backend code)
- **Token Refresh**: Use refresh tokens for automatic token renewal (handled client-side)
- **User Profile**: Call `GET /auth/profile` after login to get user details
- **ID Token**: Contains user claims but decode server-side for security
- **User Existence Check**: Use `UsersService.findByEmail()` which validates user exists in both database AND Cognito

### Common Gotchas

1. **Module Registration**: Always add new modules to `app.module.ts` imports
2. **Repository Injection**: Must register entity in module via `TypeOrmModule.forFeature([Entity])`
3. **Relations**: Only load needed relations to avoid N+1 queries and non-existent relation errors
4. **DTO Validation**: Use `@Type(() => Number)` for query parameters to ensure proper type conversion
5. **Role Updates**: Track role changes via analytics events for audit trail
6. **Pagination**: Use limit/offset pattern, default limit=100
7. **File Uploads**: Generate S3 presigned URLs for client-side direct uploads
8. **Email Sending**: AWS SES requires verified sender email addresses
9. **Database Sync**: TypeORM auto-syncs schema in development - just create entities, no migrations needed

### Onboarding Workflows

- **Standard Path**: Licensing Training → Licensing Exam → E&O Insurance → Admin Activation
- **Fast-Track Path**: Licensed Agent Intake → Licenses Upload → E&O Insurance → Admin Activation
- **Role Promotion**: Users auto-promoted to AGENT role upon completing licensing training
- **Review Submissions**: Complete history with frozen snapshots for compliance

### Development Tips

- Use `@CurrentUser()` decorator to access authenticated user in controllers
- Leverage TypeORM QueryBuilder for complex queries
- Test with Cognito local user pools or mock JWT tokens
- Check AWS credentials are configured for S3/SES operations
- Run `create-super-admin` script before first login
