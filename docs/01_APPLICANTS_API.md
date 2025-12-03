# Applicants API Documentation

## Overview
The Applicants module handles customer applications from the landing page. All applications start with a `pending` status and can be accepted or rejected by admins.

## Access Control
- **Create Applicant**: Public (no authentication required)
- **All Other Endpoints**: Admin or Super-Admin only

## Base URL
```
http://localhost:4000/api/applicants
```

## Endpoints

### 1. Create Applicant
Submit a new application from the landing page.

**Endpoint:** `POST /api/applicants`

**Authentication:** None required (Public endpoint)

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "organization": "Acme Corp",
  "primaryState": "California",
  "purpose": "Looking to expand our agency services",
  "roleIntent": "join_agency"
}
```

**Role Intent Options:**
- `join_agency`
- `external`

**Response:** `201 Created`
```json
{
  "statusCode": 201,
  "message": "Success",
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "organization": "Acme Corp",
    "primaryState": "California",
    "purpose": "Looking to expand our agency services",
    "roleIntent": "join_agency",
    "status": "pending",
    "updatedById": null,
    "updatedBy": null,
    "createdAt": "2025-12-03T10:00:00.000Z",
    "updatedAt": "2025-12-03T10:00:00.000Z"
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

**Notes:**
- `updatedById` and `updatedBy` are `null` for newly created applicants
- These fields are populated when an admin/super-admin updates the applicant

### 2. Get All Applicants
Retrieve all applicants or filter by status.

**Endpoint:** `GET /api/applicants`

**Authentication:** Required - Admin or Super-Admin only

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `accepted`, `rejected`)

**Examples:**
```
GET /api/applicants
GET /api/applicants?status=pending
GET /api/applicants?status=accepted
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": [
    {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "organization": "Acme Corp",
      "primaryState": "California",
      "purpose": "Looking to expand our agency services",
      "roleIntent": "join_agency",
      "status": "accepted",
      "updatedById": "3ed4cd7b-d452-43af-8afe-1e7e56007935",
      "updatedBy": {
        "id": "3ed4cd7b-d452-43af-8afe-1e7e56007935",
        "email": "admin@example.com",
        "firstName": "Admin",
        "lastName": "User",
        "role": "super-admin",
        "status": "active"
      },
      "createdAt": "2025-12-03T10:00:00.000Z",
      "updatedAt": "2025-12-03T11:30:00.000Z"
    }
  ],
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

**Notes:**
- The `updatedBy` object includes the admin/super-admin who last modified the applicant
- For pending applicants that haven't been updated, `updatedBy` will be `null`

### 3. Get Applicant by ID
Retrieve a specific applicant.

**Endpoint:** `GET /api/applicants/:id`

**Authentication:** Required - Admin or Super-Admin only

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
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "organization": "Acme Corp",
    "primaryState": "California",
    "purpose": "Looking to expand our agency services",
    "roleIntent": "join_agency",
    "status": "accepted",
    "updatedById": "3ed4cd7b-d452-43af-8afe-1e7e56007935",
    "updatedBy": {
      "id": "3ed4cd7b-d452-43af-8afe-1e7e56007935",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "super-admin",
      "status": "active"
    },
    "createdAt": "2025-12-03T10:00:00.000Z",
    "updatedAt": "2025-12-03T11:30:00.000Z"
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

### 4. Get Statistics
Get applicant statistics.

**Endpoint:** `GET /api/applicants/statistics`

**Authentication:** Required - Admin or Super-Admin only

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
    "total": 100,
    "pending": 45,
    "accepted": 50,
    "rejected": 5
  },
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

### 5. Update Applicant
Update applicant information.

**Endpoint:** `PATCH /api/applicants/:id`

**Authentication:** Required - Admin or Super-Admin only

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:** (All fields optional)
```json
{
  "firstName": "Jane",
  "email": "jane.doe@example.com",
  "phone": "+0987654321"
}
```

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@example.com",
    "phone": "+0987654321",
    "organization": "Acme Corp",
    "primaryState": "California",
    "purpose": "Looking to expand our agency services",
    "roleIntent": "join_agency",
    "status": "pending",
    "updatedById": "3ed4cd7b-d452-43af-8afe-1e7e56007935",
    "updatedBy": {
      "id": "3ed4cd7b-d452-43af-8afe-1e7e56007935",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "super-admin",
      "status": "active"
    },
    "createdAt": "2025-12-03T10:00:00.000Z",
    "updatedAt": "2025-12-03T12:00:00.000Z"
  },
  "timestamp": "2025-12-03T12:00:00.000Z"
}
```

**Notes:**
- The `updatedBy` field shows which admin/super-admin made the changes
- `updatedById` is automatically set to the authenticated user

### 6. Update Applicant Status
Accept or reject an applicant.

**Endpoint:** `PATCH /api/applicants/:id/status`

**Authentication:** Required - Admin or Super-Admin only

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "status": "accepted"
}
```

**Status Options:**
- `pending`
- `accepted`
- `rejected`

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "organization": "Acme Corp",
    "primaryState": "California",
    "purpose": "Looking to expand our agency services",
    "roleIntent": "join_agency",
    "status": "accepted",
    "updatedById": "3ed4cd7b-d452-43af-8afe-1e7e56007935",
    "updatedBy": {
      "id": "3ed4cd7b-d452-43af-8afe-1e7e56007935",
      "email": "admin@example.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "super-admin",
      "status": "active"
    },
    "createdAt": "2025-12-03T10:00:00.000Z",
    "updatedAt": "2025-12-03T12:30:00.000Z"
  },
  "timestamp": "2025-12-03T12:30:00.000Z"
}
```

**Notes:**
- The `updatedBy` field shows which admin/super-admin accepted/rejected the applicant
- This is useful for audit trails to track who made decisions on applications

### 7. Delete Applicant
Delete an applicant.

**Endpoint:** `DELETE /api/applicants/:id`

**Authentication:** Required - Admin or Super-Admin only

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:** `204 No Content`

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "timestamp": "2025-12-03T10:00:00.000Z",
  "path": "/api/applicants",
  "method": "POST",
  "message": {
    "message": ["email must be a valid email"],
    "error": "Bad Request",
    "statusCode": 400
  }
}
```

### Common Error Codes:
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions (not admin/super-admin)
- `404 Not Found`: Applicant not found
- `409 Conflict`: Duplicate email
- `500 Internal Server Error`: Server error

## Validation Rules

- **firstName**: Required, max 100 characters
- **lastName**: Required, max 100 characters
- **email**: Required, valid email format, unique, max 255 characters
- **phone**: Required, valid phone format (digits, spaces, +, -, (, ) allowed), 10-20 characters
- **organization**: Required, max 255 characters
- **primaryState**: Required, max 100 characters
- **purpose**: Required, text field
- **roleIntent**: Required, must be `join_agency` or `external`
- **status**: Auto-set to `pending`, can be updated to `accepted` or `rejected`
