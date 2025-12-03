# MIA-CRM-Backend

Backend API for MIA CRM - A comprehensive customer relationship management system built with modern technologies.

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/) 11.x
- **Language**: TypeScript
- **Database**: PostgreSQL (Amazon RDS)
- **Authentication**: AWS Cognito + JWT
- **ORM**: TypeORM
- **Package Manager**: pnpm

## Features

- **Authentication & Authorization**
  - AWS Cognito integration for secure user management
  - JWT-based authentication
  - Role-based access control (Agent, Affiliate, Admin, Super-Admin)
  - Email verification flow

- **Applicants Management**
  - Public application submission endpoint
  - Admin dashboard for reviewing applications
  - Status tracking (Pending, Accepted, Rejected)
  - Audit trail with updatedBy tracking

- **API Architecture**
  - RESTful API design
  - Global `/api` prefix
  - Centralized error handling
  - Response transformation interceptor
  - Request logging middleware

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- PostgreSQL database
- AWS Account (for Cognito)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd mia-crm-backend
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Update the `.env` file with your configuration:

4. **Run the application**

   ```bash
   # Development mode with hot reload
   pnpm run start:dev

   # Production mode
   pnpm run build
   pnpm run start:prod
   ```

The API will be available at `http://localhost:4000`

## API Documentation

Comprehensive API documentation is available in the `docs/` directory:

- **[01_APPLICANTS_API.md](docs/01_APPLICANTS_API.md)** - Applicants management endpoints
  - Public application submission
  - Admin applicant management (list, filter, update, delete)
  - Statistics endpoint

- **[02_AUTH_API.md](docs/02_AUTH_API.md)** - Authentication & user management endpoints
  - User registration and login
  - Email verification
  - Password management
  - Role and status management
  - Token refresh

Each document includes:

- Endpoint descriptions
- Request/response examples
- Authentication requirements
- Error handling
- Validation rules

## Database

The application uses TypeORM with PostgreSQL. Database synchronization is enabled in development mode.

### Entities

- **User**: Authentication and user profile data
- **Applicant**: Application submissions from landing page

The database schema is automatically synchronized in development. For production, use migrations:

```bash
pnpm run migration:generate
pnpm run migration:run
```

## User Roles & Permissions

- **Agent**: Default role for agents
- **Affiliate**: For affiliate partners
- **Admin**: Administrator with elevated permissions
- **Super-Admin**: Full system access

## Development

### Running Tests

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

### Code Quality

```bash
# Lint code
pnpm run lint

# Format code
pnpm run format
```

### Available Scripts

- `pnpm run start` - Start in production mode
- `pnpm run start:dev` - Start in development mode with hot reload
- `pnpm run start:debug` - Start in debug mode
- `pnpm run build` - Build for production
- `pnpm run lint` - Lint code
- `pnpm run format` - Format code with Prettier

## Error Handling

The application implements centralized error handling with consistent error responses:

```json
{
  "statusCode": 400,
  "timestamp": "2025-12-03T10:00:00.000Z",
  "path": "/api/endpoint",
  "method": "POST",
  "message": {
    "message": "Error details",
    "error": "Bad Request",
    "statusCode": 400
  }
}
```

## Security Features

- AWS Cognito for secure authentication
- JWT token validation on protected routes
- Role-based access control
- Password policy enforcement (min 8 chars, uppercase, lowercase, number)
- Email verification required
- SSL/TLS support for production databases
- CORS configuration
- Input validation with class-validator

## Environment Configuration

The application supports multiple environments:

- **Development**: Hot reload, detailed logging, auto-sync database
- **Production**: Optimized build, SSL required, manual migrations

Set `NODE_ENV` environment variable accordingly.

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Update documentation
5. Submit a pull request

## License

This project is proprietary and confidential.

## Support

For issues and questions, please contact the development team.
