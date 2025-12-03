# Authentication API Documentation

## Overview
The Authentication module handles user registration, login, and authorization using AWS Cognito and JWT tokens. User data is stored in both Cognito (for authentication) and PostgreSQL (for application data and relationships).

## Base URL
```
http://localhost:4000/api/auth
```

## Architecture
- **Authentication**: AWS Cognito handles password management, email verification, and token generation
- **Database**: PostgreSQL stores user profiles and relationships with other entities
- **Tokens**: JWT tokens are issued by Cognito and validated on each request

## User Roles
- `agent` - Default role for agents
- `affiliate` - For affiliate partners
- `admin` - Administrator with elevated permissions
- `super-admin` - Super administrator with full access

## Endpoints

### 1. Sign Up (Register)
Create a new user account in both Cognito and the database.

**Endpoint:** `POST /api/auth/signup`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "Password123",
  "phone": "+1234567890",
  "role": "agent"
}
```

**Field Requirements:**
- `firstName`: Required, max 100 characters
- `lastName`: Required, max 100 characters
- `email`: Required, valid email format
- `password`: Required, min 8 characters, must contain uppercase, lowercase, and number
- `phone`: Optional, valid phone format
- `role`: Optional, defaults to `agent`

**Response:** `201 Created`
```json
{
  "statusCode": 201,
  "message": "Success",
  "data": {
    "message": "User registered successfully. Please check your email to verify your account.",
    "userSub": "cognito-user-sub-uuid"
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

**Notes:**
- User must verify email before logging in
- Cognito sends verification email automatically
- User record is created in both Cognito and database

---

### 2. Login
Authenticate user and receive access tokens.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "Password123"
}
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "accessToken": "eyJraWQiOiJxxx...",
    "idToken": "eyJraWQiOiJxxx...",
    "refreshToken": "eyJjdHkiOiJKV1Q...",
    "expiresIn": 3600
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

**Token Details:**
- `accessToken`: Use this in the `Authorization` header for API requests
- `idToken`: Contains user claims (email, name, etc.)
- `refreshToken`: Use to get new access tokens when expired
- `expiresIn`: Token expiration time in seconds (typically 3600 = 1 hour)

---

### 3. Refresh Token
Get new access tokens using a refresh token.

**Endpoint:** `POST /api/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "eyJjdHkiOiJKV1Q..."
}
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "accessToken": "eyJraWQiOiJxxx...",
    "idToken": "eyJraWQiOiJxxx...",
    "expiresIn": 3600
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

---

### 4. Get Profile
Get current authenticated user's profile.

**Endpoint:** `GET /api/auth/profile`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "id": "uuid",
    "cognitoSub": "cognito-user-sub",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "avatarUrl": null,
    "role": "agent",
    "status": "active",
    "lastLogin": "2025-12-03T10:00:00.000Z",
    "createdAt": "2025-12-03T09:00:00.000Z",
    "updatedAt": "2025-12-03T10:00:00.000Z"
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

---

### 5. Change Password
Change the current user's password.

**Endpoint:** `POST /api/auth/change-password`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "oldPassword": "Password123",
  "newPassword": "NewPassword456"
}
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "message": "Password changed successfully"
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

---

### 6. Confirm Email
Verify user's email address using the confirmation code sent by Cognito.

**Endpoint:** `POST /api/auth/confirm-email`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "code": "123456"
}
```

**Field Requirements:**
- `email`: Required, valid email format
- `code`: Required, 6-digit confirmation code from email

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "message": "Email verified successfully. You can now log in."
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

**Error Responses:**

**400 Bad Request - Invalid Code**
```json
{
  "statusCode": 400,
  "message": "Invalid verification code"
}
```

**400 Bad Request - Expired Code**
```json
{
  "statusCode": 400,
  "message": "Verification code has expired. Please request a new one."
}
```

**400 Bad Request - Already Confirmed**
```json
{
  "statusCode": 400,
  "message": "User is already confirmed"
}
```

---

### 7. Resend Confirmation Code
Request a new verification code if the original has expired.

**Endpoint:** `POST /api/auth/resend-confirmation`

**Request Body:**
```json
{
  "email": "john.doe@example.com"
}
```

**Field Requirements:**
- `email`: Required, valid email format

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "message": "Verification code sent to your email."
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

**Error Responses:**

**400 Bad Request - User Not Found**
```json
{
  "statusCode": 400,
  "message": "User not found"
}
```

**400 Bad Request - Already Confirmed**
```json
{
  "statusCode": 400,
  "message": "User is already confirmed"
}
```

**400 Bad Request - Rate Limited**
```json
{
  "statusCode": 400,
  "message": "Too many requests. Please try again later."
}
```

---

### 8. Update User Role (Super Admin Only)
Update a user's role. Requires super-admin privileges.

**Endpoint:** `PATCH /api/auth/users/:id/role`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Parameters:**
- `id`: User UUID

**Request Body:**
```json
{
  "role": "admin"
}
```

**Valid Roles:**
- `agent`
- `affiliate`
- `admin`
- `super-admin`

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "id": "uuid",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    ...
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

**Access Control:**
- **Only users with `super-admin` role can access this endpoint**

---

### 9. Update User Status (Admin Only)
Update a user's account status.

**Endpoint:** `PATCH /api/auth/users/:id/status`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**URL Parameters:**
- `id`: User UUID

**Request Body:**
```json
{
  "status": "suspended"
}
```

**Valid Statuses:**
- `active`
- `inactive`
- `suspended`

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "id": "uuid",
    "email": "john.doe@example.com",
    "status": "suspended",
    ...
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

**Access Control:**
- Only users with `admin` or `super-admin` role can access this endpoint

---

## Authentication Flow

### First Time User
1. User signs up via `POST /api/auth/signup`
2. Cognito creates auth user and sends verification email
3. Database creates user profile record
4. User receives verification code in email
5. User verifies email via `POST /api/auth/confirm-email` with code
   - If code expires, user can request a new one via `POST /api/auth/resend-confirmation`
6. User logs in via `POST /api/auth/login`
7. User receives access and refresh tokens
8. User includes `Authorization: Bearer <accessToken>` in subsequent requests

### Existing User
1. User logs in via `POST /api/auth/login`
2. User receives access and refresh tokens
3. User includes `Authorization: Bearer <accessToken>` in subsequent requests
4. When token expires, use `POST /api/auth/refresh` to get new tokens

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "timestamp": "2025-12-03T10:00:00.000Z",
  "path": "/api/auth/login",
  "method": "POST",
  "message": {
    "message": "Invalid email or password",
    "error": "Unauthorized",
    "statusCode": 401
  }
}
```

### Common Error Codes

**400 Bad Request**
- Invalid input data
- Password doesn't meet requirements

**401 Unauthorized**
- Invalid credentials
- Invalid or expired token
- Email not verified

**403 Forbidden**
- Insufficient permissions (not admin/super-admin)

**409 Conflict**
- User with email already exists

**500 Internal Server Error**
- Server error
- Cognito service error

---

## Protected Routes

To protect routes with authentication, use the `@UseGuards(JwtAuthGuard)` decorator:

```typescript
@Get('protected')
@UseGuards(JwtAuthGuard)
getProtectedData(@CurrentUser() user: User) {
  return user;
}
```

### Role-Based Protection

To protect routes by role:

```typescript
@Patch(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
updateResource(@CurrentUser() user: User) {
  // Only admins can access
}
```

---

## Security Notes

1. **Token Storage**: Store tokens securely on the client (HttpOnly cookies recommended)
2. **HTTPS**: Always use HTTPS in production
3. **Token Expiry**: Access tokens expire in 1 hour, use refresh tokens to get new ones
4. **Password Policy**: Enforced by Cognito - min 8 chars, uppercase, lowercase, number
5. **Email Verification**: Required before first login
6. **Rate Limiting**: Cognito automatically rate limits auth requests
