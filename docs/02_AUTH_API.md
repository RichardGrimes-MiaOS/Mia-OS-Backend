# Authentication API Documentation

## Overview
The Authentication module handles user authentication and authorization using AWS Cognito and JWT tokens. User data is stored in both Cognito (for authentication) and PostgreSQL (for application data and relationships).

**Important**: There is no public sign-up endpoint. All users are created either by:
1. **Applicants**: When an admin approves an applicant, a user account is automatically created
2. **Admins**: Super-admins can manually create admin users via the API

## Base URL
```
http://localhost:4000/api/auth
```

## Architecture
- **Authentication**: AWS Cognito handles password management and token generation
- **Database**: PostgreSQL stores user profiles and relationships with other entities
- **Tokens**: JWT tokens are issued by Cognito and validated on each request
- **User Creation**: Uses `AdminCreateUser` with temporary passwords that must be changed on first login

## User Roles
- `agent` - Default role for approved applicants (can be changed during onboarding)
- `affiliate` - For affiliate partners
- `admin` - Administrator with elevated permissions
- `super-admin` - Super administrator with full access

## Endpoints

### 1. Login
Authenticate user and receive access tokens. On first login with temporary password, returns a challenge to set a new password.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "TempPassword123"
}
```

**Response (Normal Login):** `200 OK`
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
  "timestamp": "2025-12-04T10:00:00.000Z"
}
```

**Response (First Login - Password Change Required):** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "challengeName": "NEW_PASSWORD_REQUIRED",
    "session": "AWSCognitoSessionToken...",
    "message": "Please set a new password"
  },
  "timestamp": "2025-12-04T10:00:00.000Z"
}
```

**Token Details:**
- `accessToken`: Use this in the `Authorization` header for API requests
- `idToken`: Contains user claims (email, name, etc.)
- `refreshToken`: Use to get new access tokens when expired
- `expiresIn`: Token expiration time in seconds (typically 3600 = 1 hour)

---

### 2. Complete New Password Challenge
Complete the password change requirement on first login with temporary password.

**Endpoint:** `POST /api/auth/complete-new-password`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "session": "AWSCognitoSessionToken...",
  "newPassword": "MyNewSecurePassword123!"
}
```

**Field Requirements:**
- `email`: Required, valid email format
- `session`: Required, session token from login response
- `newPassword`: Required, min 8 characters, must contain uppercase, lowercase, and number

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
  "timestamp": "2025-12-04T10:00:00.000Z"
}
```

**Error Responses:**

**400 Bad Request - Invalid Password**
```json
{
  "statusCode": 400,
  "message": "New password does not meet requirements"
}
```

**401 Unauthorized - Invalid Session**
```json
{
  "statusCode": 401,
  "message": "Invalid session or credentials"
}
```

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
  "timestamp": "2025-12-04T10:00:00.000Z"
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
    "lastLogin": "2025-12-04T10:00:00.000Z",
    "createdBy": {
      "id": "admin-uuid",
      "firstName": "Admin",
      "lastName": "User"
    },
    "createdAt": "2025-12-04T09:00:00.000Z",
    "updatedAt": "2025-12-04T10:00:00.000Z"
  },
  "timestamp": "2025-12-04T10:00:00.000Z"
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
  "oldPassword": "CurrentPassword123",
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
  "timestamp": "2025-12-04T10:00:00.000Z"
}
```

---

### 6. Create User (Super Admin Only)
Create a new admin user. User receives an email with temporary credentials and must change password on first login.

**Endpoint:** `POST /api/auth/users`

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+1234567890",
  "role": "admin"
}
```

**Field Requirements:**
- `firstName`: Required, max 100 characters
- `lastName`: Required, max 100 characters
- `email`: Required, valid email format
- `phone`: Optional, valid phone format
- `role`: Required, one of: `admin`, `super-admin`

**Response:** `201 Created`
```json
{
  "statusCode": 201,
  "message": "Success",
  "data": {
    "user": {
      "id": "uuid",
      "cognitoSub": "cognito-user-sub",
      "email": "jane.smith@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "phone": "+1234567890",
      "role": "admin",
      "status": "active",
      "createdById": "super-admin-uuid",
      "createdAt": "2025-12-04T10:00:00.000Z",
      "updatedAt": "2025-12-04T10:00:00.000Z"
    },
    "temporaryPassword": "TempPass123!",
    "message": "User created successfully. Temporary password must be changed on first login."
  },
  "timestamp": "2025-12-04T10:00:00.000Z"
}
```

**Notes:**
- User's email is automatically verified
- Temporary password is sent via email to the user
- User must change password on first login
- `createdById` tracks which super-admin created the user

**Access Control:**
- **Only users with `super-admin` role can access this endpoint**

---

### 7. Update User Role (Super Admin Only)
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
  "timestamp": "2025-12-04T10:00:00.000Z"
}
```

**Access Control:**
- **Only users with `super-admin` role can access this endpoint**

---

### 8. Update User Status (Admin Only)
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
  "timestamp": "2025-12-04T10:00:00.000Z"
}
```

**Access Control:**
- Only users with `admin` or `super-admin` role can access this endpoint

---

## Authentication Flow

### For Approved Applicants (Agents/Affiliates)
1. User submits application via `POST /api/applicants`
2. Admin reviews and approves via `PATCH /api/applicants/:id/status`
3. System automatically creates user account with temporary password
4. User receives welcome email with credentials
5. User logs in via `POST /api/auth/login` with temporary password
6. System returns `NEW_PASSWORD_REQUIRED` challenge
7. User sets new password via `POST /api/auth/complete-new-password`
8. User receives access and refresh tokens
9. User completes onboarding flow (role determined during onboarding)
10. User includes `Authorization: Bearer <accessToken>` in subsequent requests

### For Admin Users
1. Super-admin creates admin via `POST /api/auth/users`
2. System creates account with temporary password
3. New admin receives welcome email with credentials
4. Same login flow as above (steps 5-10)

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
  "timestamp": "2025-12-04T10:00:00.000Z",
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

1. **No Public Sign-Up**: All users are created through admin approval or super-admin action
2. **Email Auto-Verified**: Admin-created users have email automatically verified
3. **Temporary Passwords**: All new users receive temporary passwords that must be changed
4. **Token Storage**: Store tokens securely on the client (HttpOnly cookies recommended)
5. **HTTPS**: Always use HTTPS in production
6. **Token Expiry**: Access tokens expire in 1 hour, use refresh tokens to get new ones
7. **Password Policy**: Enforced by Cognito - min 8 chars, uppercase, lowercase, number
8. **Audit Trail**: `createdById` field tracks which super-admin created each admin user
9. **Rate Limiting**: Cognito automatically rate limits auth requests

---

## Removed Endpoints

The following endpoints have been removed as they are no longer needed:
- `POST /api/auth/signup` - No public sign-up allowed
- `POST /api/auth/confirm-email` - Email automatically verified for admin-created users
- `POST /api/auth/resend-confirmation` - Not needed without email confirmation flow
