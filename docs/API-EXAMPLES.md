# Bidyapith API — SQA test reference

Use this file to test every HTTP endpoint. Copy the request JSON, send it, and compare the response shape (field names and types), not the exact UUIDs or timestamps.

| | |
|---|---|
| Live API | https://bidyapith-backend.onrender.com |
| Base path | `https://bidyapith-backend.onrender.com/api/v1` |
| Health | `GET /health` (not under `/api/v1`) |
| Auth header | `Authorization: Bearer <accessToken>` |
| Refresh cookie | `refreshToken` (httpOnly, SameSite=Strict) |
| Pagination | `?page=1&limit=10&sortBy=createdAt&sortOrder=desc` (max `limit` 100) |
| Content-Type | `application/json` except avatar upload and Stripe webhook |

UUIDs below are **examples**. After seed, take real IDs from list responses (`GET /departments`, `GET /programs`, `GET /students`, `GET /offerings`, …).

`studentId` in enrollment/invoice bodies is the **student profile UUID**, not the printed id `2026-BSC-CSE-0001`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin (live / Postman) | `devparvejme@gmail.com` | `12345678` |
| Admin (seed) | `admin@bidyapith.edu` | `Admin1234` |
| Instructor | `instructor01@bidyapith.edu` | `Teach1234` |
| Student | `student01@bidyapith.edu` | `Student1234` |

`student02@bidyapith.edu` / `Student1234` has an overdue invoice → enroll returns **402**.
`student03@bidyapith.edu` / `Student1234` is below 75% attendance → `examEligible: false`.

Password rule: ≥8 characters, at least one letter and one number. Phone: `01XXXXXXXXX` or `+8801XXXXXXXXX`.

## Response contract

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 47,
    "totalPage": 5
  },
  "data": {}
}
```

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation error",
  "errors": [
    {
      "path": "email",
      "message": "Invalid email format"
    }
  ]
}
```

| Code | When |
|---|---|
| 200 / 201 | Success (201 only on create) |
| 400 | Business rule (window closed, illegal status, prereq) |
| 401 | Missing / invalid JWT or refresh cookie |
| 402 | Unpaid invoice blocks enrollment |
| 403 | Wrong role or not the owner |
| 404 | Missing or soft-deleted row |
| 409 | Duplicate / full section / schedule clash |
| 422 | Zod validation |
| 429 | Login 5/15min; forgot-password 3/hour |

## Endpoint checklist

| Method | Path | Access | Success |
|---|---|---|---|
| GET | `/` | Public | 200 |
| GET | `/health` | Public | 200 |
| POST | `/api/v1/auth/register` | Public | 201 |
| POST | `/api/v1/auth/login` | Public | 200 |
| POST | `/api/v1/auth/google` | Public | 200 |
| POST | `/api/v1/auth/refresh-token` | Cookie `refreshToken` | 200 |
| POST | `/api/v1/auth/logout` | Auth + cookie | 200 |
| POST | `/api/v1/auth/change-password` | Auth | 200 |
| POST | `/api/v1/auth/forgot-password` | Public | 200 |
| POST | `/api/v1/auth/reset-password` | Public | 200 |
| POST | `/api/v1/auth/verify-email` | Public | 200 |
| GET | `/api/v1/users/me` | Auth (any role) | 200 |
| PATCH | `/api/v1/users/me` | Auth | 200 |
| POST | `/api/v1/users/me/avatar` | Auth | 200 |
| DELETE | `/api/v1/users/me/avatar` | Auth | 200 |
| POST | `/api/v1/admin/users` | ADMIN | 201 |
| GET | `/api/v1/admin/users` | ADMIN | 200 |
| GET | `/api/v1/admin/users/:id` | ADMIN | 200 |
| PATCH | `/api/v1/admin/users/:id/role` | ADMIN | 200 |
| PATCH | `/api/v1/admin/users/:id/status` | ADMIN | 200 |
| DELETE | `/api/v1/admin/users/:id` | ADMIN | 200 |
| GET | `/api/v1/students/me` | STUDENT | 200 |
| PATCH | `/api/v1/students/me` | STUDENT | 200 |
| GET | `/api/v1/students` | ADMIN, INSTRUCTOR | 200 |
| GET | `/api/v1/students/:id` | ADMIN, INSTRUCTOR | 200 |
| PATCH | `/api/v1/students/:id` | ADMIN | 200 |
| GET | `/api/v1/students/me/attendance` | STUDENT | 200 |
| GET | `/api/v1/students/me/exam-results` | STUDENT | 200 |
| GET | `/api/v1/students/me/results` | STUDENT | 200 |
| GET | `/api/v1/students/me/transcript` | STUDENT | 200 |
| GET | `/api/v1/students/:id/transcript` | ADMIN | 200 |
| GET | `/api/v1/instructors/me` | INSTRUCTOR | 200 |
| PATCH | `/api/v1/instructors/me` | INSTRUCTOR | 200 |
| GET | `/api/v1/instructors` | Auth | 200 |
| GET | `/api/v1/instructors/:id` | Auth | 200 |
| PATCH | `/api/v1/instructors/:id` | ADMIN | 200 |
| POST | `/api/v1/departments` | ADMIN | 201 |
| GET | `/api/v1/departments` | Auth | 200 |
| GET | `/api/v1/departments/:id` | Auth | 200 |
| PATCH | `/api/v1/departments/:id` | ADMIN | 200 |
| DELETE | `/api/v1/departments/:id` | ADMIN | 200 |
| POST | `/api/v1/programs` | ADMIN | 201 |
| GET | `/api/v1/programs` | Auth | 200 |
| GET | `/api/v1/programs/:id` | Auth | 200 |
| PATCH | `/api/v1/programs/:id` | ADMIN | 200 |
| DELETE | `/api/v1/programs/:id` | ADMIN | 200 |
| GET | `/api/v1/programs/:id/curriculum` | Auth | 200 |
| POST | `/api/v1/programs/:id/courses` | ADMIN | 201 |
| PATCH | `/api/v1/programs/:id/courses/:courseId` | ADMIN | 200 |
| DELETE | `/api/v1/programs/:id/courses/:courseId` | ADMIN | 200 |
| POST | `/api/v1/courses` | ADMIN | 201 |
| GET | `/api/v1/courses` | Auth | 200 |
| GET | `/api/v1/courses/:courseId` | Auth | 200 |
| PATCH | `/api/v1/courses/:courseId` | ADMIN | 200 |
| DELETE | `/api/v1/courses/:courseId` | ADMIN | 200 |
| POST | `/api/v1/courses/:courseId/prerequisites` | ADMIN | 201 |
| GET | `/api/v1/courses/:courseId/prerequisites` | Auth | 200 |
| GET | `/api/v1/courses/:courseId/dependents` | Auth | 200 |
| DELETE | `/api/v1/courses/:courseId/prerequisites/:prerequisiteId` | ADMIN | 200 |
| POST | `/api/v1/semesters` | ADMIN | 201 |
| GET | `/api/v1/semesters` | Auth | 200 |
| GET | `/api/v1/semesters/current` | Auth | 200 |
| GET | `/api/v1/semesters/:id` | Auth | 200 |
| PATCH | `/api/v1/semesters/:id` | ADMIN | 200 |
| PATCH | `/api/v1/semesters/:id/status` | ADMIN | 200 |
| DELETE | `/api/v1/semesters/:id` | ADMIN | 200 |
| GET | `/api/v1/semesters/:id/results/readiness` | ADMIN | 200 |
| POST | `/api/v1/semesters/:id/publish-results` | ADMIN | 200 |
| POST | `/api/v1/offerings` | ADMIN | 201 |
| GET | `/api/v1/offerings` | Auth | 200 |
| GET | `/api/v1/offerings/my-teaching` | INSTRUCTOR | 200 |
| GET | `/api/v1/offerings/:id` | Auth | 200 |
| PATCH | `/api/v1/offerings/:id` | ADMIN | 200 |
| PATCH | `/api/v1/offerings/:id/instructor` | ADMIN | 200 |
| PATCH | `/api/v1/offerings/:id/status` | ADMIN | 200 |
| POST | `/api/v1/offerings/:id/schedules` | ADMIN | 201 |
| DELETE | `/api/v1/offerings/:id/schedules/:scheduleId` | ADMIN | 200 |
| DELETE | `/api/v1/offerings/:id` | ADMIN | 200 |
| GET | `/api/v1/offerings/:id/students` | INSTRUCTOR (own offering) or ADMIN | 200 |
| POST | `/api/v1/offerings/:id/attendance` | INSTRUCTOR (own) or ADMIN | 200 |
| GET | `/api/v1/offerings/:id/attendance` | INSTRUCTOR (own) or ADMIN | 200 |
| GET | `/api/v1/offerings/:id/attendance/summary` | INSTRUCTOR (own) or ADMIN | 200 |
| DELETE | `/api/v1/offerings/:id/attendance` | ADMIN | 200 |
| POST | `/api/v1/offerings/:id/exams` | INSTRUCTOR (own) or ADMIN | 201 |
| GET | `/api/v1/offerings/:id/exams` | Auth (students see published only) | 200 |
| GET | `/api/v1/offerings/:id/grades` | INSTRUCTOR (own) or ADMIN | 200 |
| POST | `/api/v1/offerings/:id/grades` | INSTRUCTOR (own) or ADMIN | 200 |
| POST | `/api/v1/enrollments` | STUDENT | 201 |
| POST | `/api/v1/enrollments/admin` | ADMIN | 201 |
| GET | `/api/v1/enrollments/my-courses` | STUDENT | 200 |
| GET | `/api/v1/enrollments/available-courses` | STUDENT | 200 |
| GET | `/api/v1/enrollments` | ADMIN | 200 |
| DELETE | `/api/v1/enrollments/:id` | STUDENT (own enrollment) | 200 |
| PATCH | `/api/v1/enrollments/:id/grade` | INSTRUCTOR (owns offering) or ADMIN | 200 |
| PATCH | `/api/v1/exams/:id` | INSTRUCTOR (owns exam offering) | 200 |
| DELETE | `/api/v1/exams/:id` | INSTRUCTOR (owns exam offering) | 200 |
| PATCH | `/api/v1/exams/:id/publish` | INSTRUCTOR (owns exam offering) | 200 |
| POST | `/api/v1/exams/:id/results` | INSTRUCTOR (owns exam offering) | 200 |
| GET | `/api/v1/exams/:id/results` | INSTRUCTOR (own) or ADMIN | 200 |
| GET | `/api/v1/invoices/my` | STUDENT | 200 |
| GET | `/api/v1/invoices/summary` | ADMIN | 200 |
| GET | `/api/v1/invoices` | ADMIN | 200 |
| POST | `/api/v1/invoices/generate` | ADMIN | 200 |
| POST | `/api/v1/invoices` | ADMIN | 201 |
| GET | `/api/v1/invoices/:id` | STUDENT (own) or ADMIN | 200 |
| PATCH | `/api/v1/invoices/:id/waive` | ADMIN | 200 |
| PATCH | `/api/v1/invoices/:id/cancel` | ADMIN | 200 |
| POST | `/api/v1/payments/initiate` | STUDENT | 200 |
| GET | `/api/v1/payments/verify/:transactionRef` | STUDENT | 200 |
| GET | `/api/v1/payments/my-history` | STUDENT | 200 |
| GET | `/api/v1/payments` | ADMIN | 200 |
| GET | `/api/v1/payments/:id` | STUDENT (own) or ADMIN | 200 |
| POST | `/api/v1/payments/:id/refund` | ADMIN | 200 |
| GET | `/api/v1/payments/expire-stale` | Bearer $CRON_SECRET (not JWT) | 200 |
| POST | `/api/v1/payments/webhook` | Public + stripe-signature | 200 |

## Suggested test order

1. Health + login (admin, instructor, student) + 401/403/422
2. Catalog reads: departments, programs, courses, semesters/current, offerings
3. Self profiles: `/users/me`, `/students/me`, `/instructors/me`
4. Student: available-courses → enroll → my-courses → invoices/my
5. Instructor: my-teaching → roster → attendance → exams → marks → grades
6. Admin writes on unique codes / a future semester (do not smash seed data)
7. Payments only with Stripe test keys

Do not change the live admin password on a shared environment.


## 0. Health

### GET /

| | |
|---|---|
| Name | Root ping |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/` |
| Access | Public |
| Success | **200** |

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Bidyapith API is running"
}
```

### GET /health

| | |
|---|---|
| Name | Health check |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/health` |
| Access | Public |
| Success | **200** |

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": {
    "service": "bidyapith-backend"
  }
}
```


## 1. Auth

### POST /auth/register

| | |
|---|---|
| Name | Register student |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/register` |
| Access | Public |
| Success | **201** |
| Notes | `programId` must be a live program UUID from `GET /programs`. |

**Headers**

```
Content-Type: application/json
```

**Request body**

```json
{
  "firstName": "Nabila",
  "lastName": "Rahman",
  "email": "nabila.rahman@example.com",
  "password": "Student1234",
  "phone": "01712345678",
  "programId": "22222222-2222-4222-8222-222222222222"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": "66666666-6666-4666-8666-666666666670",
      "email": "nabila.rahman@example.com",
      "firstName": "Nabila",
      "lastName": "Rahman",
      "phone": "01712345678",
      "avatarUrl": null,
      "role": "STUDENT",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": false,
      "lastLoginAt": null,
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    },
    "studentId": "2026-BSC-CSE-0031"
  }
}
```

### POST /auth/login

| | |
|---|---|
| Name | Login |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/login` |
| Access | Public |
| Success | **200** |
| Notes | Sets `refreshToken` cookie. Rate limit 5 / 15 min per IP+email. Also test instructor and student logins. |

**Headers**

```
Content-Type: application/json
```

**Request body**

```json
{
  "email": "devparvejme@gmail.com",
  "password": "12345678"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token",
    "user": {
      "id": "66666666-6666-4666-8666-666666666661",
      "email": "devparvejme@gmail.com",
      "firstName": "Parvej",
      "lastName": "Admin",
      "phone": null,
      "avatarUrl": null,
      "role": "ADMIN",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### POST /auth/google

| | |
|---|---|
| Name | Google login |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/google` |
| Access | Public |
| Success | **200** |
| Notes | Existing accounts only. Needs a real Google ID token. |

**Headers**

```
Content-Type: application/json
```

**Request body**

```json
{
  "idToken": "<google-id-token>"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token",
    "user": {
      "id": "66666666-6666-4666-8666-666666666663",
      "email": "student01@bidyapith.edu",
      "firstName": "Aisha",
      "lastName": "Karim",
      "phone": "01712345678",
      "avatarUrl": null,
      "role": "STUDENT",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### POST /auth/refresh-token

| | |
|---|---|
| Name | Refresh token |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/refresh-token` |
| Access | Cookie `refreshToken` |
| Success | **200** |
| Notes | Rotates the cookie. No JSON body. |

**Headers**

```
Cookie: refreshToken=<token from login>
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token",
    "user": {
      "id": "66666666-6666-4666-8666-666666666661",
      "email": "devparvejme@gmail.com",
      "firstName": "Parvej",
      "lastName": "Admin",
      "phone": null,
      "avatarUrl": null,
      "role": "ADMIN",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### POST /auth/logout

| | |
|---|---|
| Name | Logout |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/logout` |
| Access | Auth + cookie |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Cookie: refreshToken=<token>
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logout successful",
  "data": null
}
```

### POST /auth/change-password

| | |
|---|---|
| Name | Change password |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/change-password` |
| Access | Auth |
| Success | **200** |
| Notes | Rotates refresh cookie. On shared live, send the same password back so other testers are not locked out. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "currentPassword": "12345678",
  "newPassword": "12345678"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password changed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token",
    "user": {
      "id": "66666666-6666-4666-8666-666666666661",
      "email": "devparvejme@gmail.com",
      "firstName": "Parvej",
      "lastName": "Admin",
      "phone": null,
      "avatarUrl": null,
      "role": "ADMIN",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### POST /auth/forgot-password

| | |
|---|---|
| Name | Forgot password |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/forgot-password` |
| Access | Public |
| Success | **200** |
| Notes | Always 200 (no email leak). Rate limit 3 / hour. |

**Headers**

```
Content-Type: application/json
```

**Request body**

```json
{
  "email": "student01@bidyapith.edu"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "If an account exists for this email, a reset link has been sent.",
  "data": null
}
```

### POST /auth/reset-password

| | |
|---|---|
| Name | Reset password |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/reset-password` |
| Access | Public |
| Success | **200** |

**Headers**

```
Content-Type: application/json
```

**Request body**

```json
{
  "token": "<token-from-email>",
  "newPassword": "Newpass1234"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password reset successful. Please log in with your new password.",
  "data": null
}
```

### POST /auth/verify-email

| | |
|---|---|
| Name | Verify email |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/auth/verify-email` |
| Access | Public |
| Success | **200** |

**Headers**

```
Content-Type: application/json
```

**Request body**

```json
{
  "token": "<token-from-email>"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully",
  "data": null
}
```


## 2. Users (self)

### GET /users/me

| | |
|---|---|
| Name | Get my profile |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/users/me` |
| Access | Auth (any role) |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "66666666-6666-4666-8666-666666666661",
    "email": "devparvejme@gmail.com",
    "firstName": "Parvej",
    "lastName": "Admin",
    "phone": null,
    "avatarUrl": null,
    "role": "ADMIN",
    "status": "ACTIVE",
    "provider": "CREDENTIALS",
    "emailVerified": true,
    "lastLoginAt": "2026-09-06T09:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "studentProfile": null,
    "instructorProfile": null
  }
}
```

### PATCH /users/me

| | |
|---|---|
| Name | Update my profile |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/users/me` |
| Access | Auth |
| Success | **200** |
| Notes | At least one of `firstName`, `lastName`, `phone`. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "firstName": "Parvej",
  "phone": "01712345678"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile updated successfully",
  "data": {
    "id": "66666666-6666-4666-8666-666666666661",
    "email": "devparvejme@gmail.com",
    "firstName": "Parvej",
    "lastName": "Admin",
    "phone": "01712345678",
    "avatarUrl": null,
    "role": "ADMIN",
    "status": "ACTIVE",
    "provider": "CREDENTIALS",
    "emailVerified": true,
    "lastLoginAt": "2026-09-06T09:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "studentProfile": null,
    "instructorProfile": null
  }
}
```

### POST /users/me/avatar

| | |
|---|---|
| Name | Upload avatar |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/users/me/avatar` |
| Access | Auth |
| Success | **200** |
| Notes | Needs Cloudinary. Missing file → 422. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: multipart/form-data
```

**Request body**

```
form-data field `avatar` = JPEG/PNG/WebP file, max 2 MB
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Avatar uploaded successfully",
  "data": {
    "id": "66666666-6666-4666-8666-666666666661",
    "email": "devparvejme@gmail.com",
    "firstName": "Parvej",
    "lastName": "Admin",
    "phone": null,
    "avatarUrl": "https://res.cloudinary.com/demo/image/upload/v1/bidyapith/avatars/abc.jpg",
    "role": "ADMIN",
    "status": "ACTIVE",
    "provider": "CREDENTIALS",
    "emailVerified": true,
    "lastLoginAt": "2026-09-06T09:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "studentProfile": null,
    "instructorProfile": null
  }
}
```

### DELETE /users/me/avatar

| | |
|---|---|
| Name | Delete avatar |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/users/me/avatar` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Avatar removed successfully",
  "data": {
    "id": "66666666-6666-4666-8666-666666666661",
    "email": "devparvejme@gmail.com",
    "firstName": "Parvej",
    "lastName": "Admin",
    "phone": null,
    "avatarUrl": null,
    "role": "ADMIN",
    "status": "ACTIVE",
    "provider": "CREDENTIALS",
    "emailVerified": true,
    "lastLoginAt": "2026-09-06T09:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "studentProfile": null,
    "instructorProfile": null
  }
}
```


## 3. Admin users

### POST /admin/users

| | |
|---|---|
| Name | Create instructor or admin |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/admin/users` |
| Access | ADMIN |
| Success | **201** |
| Notes | `role` is `INSTRUCTOR` or `ADMIN`. Instructor requires `departmentId`, `designation`, `joiningDate`. Designation: LECTURER | ASSISTANT_PROFESSOR | ASSOCIATE_PROFESSOR | PROFESSOR. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "firstName": "New",
  "lastName": "Teacher",
  "email": "teacher99@bidyapith.edu",
  "role": "INSTRUCTOR",
  "departmentId": "11111111-1111-4111-8111-111111111111",
  "designation": "LECTURER",
  "joiningDate": "2026-01-01",
  "specialization": "Networks",
  "phone": "01912345678"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "66666666-6666-4666-8666-666666666699",
      "email": "teacher99@bidyapith.edu",
      "firstName": "New",
      "lastName": "Teacher",
      "phone": "01912345678",
      "avatarUrl": null,
      "role": "INSTRUCTOR",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "instructorProfile": {
        "id": "77777777-7777-4777-8777-777777777799",
        "employeeId": "EMP-0007",
        "departmentId": "11111111-1111-4111-8111-111111111111",
        "designation": "LECTURER",
        "specialization": "Networks",
        "joiningDate": "2026-01-01T00:00:00.000Z",
        "department": {
          "id": "11111111-1111-4111-8111-111111111111",
          "code": "CSE",
          "name": "Computer Science and Engineering"
        }
      },
      "studentProfile": null
    },
    "temporaryPassword": "xK9aB2mQ1Aa1"
  }
}
```

### GET /admin/users

| | |
|---|---|
| Name | List users |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/admin/users` |
| Access | ADMIN |
| Success | **200** |
| Query | `page, limit, role, status, search` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Users retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 24,
    "totalPage": 3
  },
  "data": [
    {
      "id": "66666666-6666-4666-8666-666666666661",
      "email": "devparvejme@gmail.com",
      "firstName": "Parvej",
      "lastName": "Admin",
      "phone": null,
      "avatarUrl": null,
      "role": "ADMIN",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "studentProfile": null,
      "instructorProfile": null
    }
  ]
}
```

### GET /admin/users/:id

| | |
|---|---|
| Name | Get user by id |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/admin/users/66666666-6666-4666-8666-666666666661` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User retrieved successfully",
  "data": {
    "id": "66666666-6666-4666-8666-666666666661",
    "email": "devparvejme@gmail.com",
    "firstName": "Parvej",
    "lastName": "Admin",
    "phone": null,
    "avatarUrl": null,
    "role": "ADMIN",
    "status": "ACTIVE",
    "provider": "CREDENTIALS",
    "emailVerified": true,
    "lastLoginAt": "2026-09-06T09:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "studentProfile": null,
    "instructorProfile": null
  }
}
```

### PATCH /admin/users/:id/role

| | |
|---|---|
| Name | Change user role |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/admin/users/66666666-6666-4666-8666-666666666699/role` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "role": "ADMIN"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User role updated successfully",
  "data": {
    "id": "66666666-6666-4666-8666-666666666699",
    "email": "instructor01@bidyapith.edu",
    "firstName": "Mahmud",
    "lastName": "Hasan",
    "phone": null,
    "avatarUrl": null,
    "role": "ADMIN",
    "status": "ACTIVE",
    "provider": "CREDENTIALS",
    "emailVerified": true,
    "lastLoginAt": "2026-09-06T09:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### PATCH /admin/users/:id/status

| | |
|---|---|
| Name | Change user status |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/admin/users/66666666-6666-4666-8666-666666666699/status` |
| Access | ADMIN |
| Success | **200** |
| Notes | `ACTIVE` or `BLOCKED`. Blocked users cannot log in (403). |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "status": "BLOCKED"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User status updated successfully",
  "data": {
    "id": "66666666-6666-4666-8666-666666666699",
    "email": "instructor01@bidyapith.edu",
    "firstName": "Mahmud",
    "lastName": "Hasan",
    "phone": null,
    "avatarUrl": null,
    "role": "INSTRUCTOR",
    "status": "BLOCKED",
    "provider": "CREDENTIALS",
    "emailVerified": true,
    "lastLoginAt": "2026-09-06T09:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### DELETE /admin/users/:id

| | |
|---|---|
| Name | Soft-delete user |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/admin/users/66666666-6666-4666-8666-666666666699` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User deleted successfully",
  "data": {
    "id": "66666666-6666-4666-8666-666666666699"
  }
}
```


## 4. Students

### GET /students/me

| | |
|---|---|
| Name | Get my student profile |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/me` |
| Access | STUDENT |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Student profile retrieved successfully",
  "data": {
    "id": "88888888-8888-4888-8888-888888888881",
    "studentId": "2026-BSC-CSE-0001",
    "programId": "22222222-2222-4222-8222-222222222222",
    "batch": "2026",
    "admissionDate": "2026-01-15T00:00:00.000Z",
    "status": "ACTIVE",
    "cgpa": "3.45",
    "totalCreditsEarned": "12.0",
    "guardianName": "Rahim Karim",
    "guardianPhone": "01812345678",
    "address": "Dhaka",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "program": {
      "id": "22222222-2222-4222-8222-222222222222",
      "code": "BSC-CSE",
      "name": "BSc in Computer Science and Engineering",
      "department": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "CSE",
        "name": "Computer Science and Engineering"
      }
    },
    "user": {
      "id": "66666666-6666-4666-8666-666666666663",
      "email": "student01@bidyapith.edu",
      "firstName": "Aisha",
      "lastName": "Karim",
      "phone": "01712345678",
      "avatarUrl": null,
      "role": "STUDENT",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### PATCH /students/me

| | |
|---|---|
| Name | Update my student profile |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/me` |
| Access | STUDENT |
| Success | **200** |
| Notes | At least one of `guardianName`, `guardianPhone`, `address`. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "guardianName": "Rahim Karim",
  "guardianPhone": "01812345678",
  "address": "Dhaka"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Student profile updated successfully",
  "data": {
    "id": "88888888-8888-4888-8888-888888888881",
    "studentId": "2026-BSC-CSE-0001",
    "programId": "22222222-2222-4222-8222-222222222222",
    "batch": "2026",
    "admissionDate": "2026-01-15T00:00:00.000Z",
    "status": "ACTIVE",
    "cgpa": "3.45",
    "totalCreditsEarned": "12.0",
    "guardianName": "Rahim Karim",
    "guardianPhone": "01812345678",
    "address": "Dhaka",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "program": {
      "id": "22222222-2222-4222-8222-222222222222",
      "code": "BSC-CSE",
      "name": "BSc in Computer Science and Engineering",
      "department": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "CSE",
        "name": "Computer Science and Engineering"
      }
    },
    "user": {
      "id": "66666666-6666-4666-8666-666666666663",
      "email": "student01@bidyapith.edu",
      "firstName": "Aisha",
      "lastName": "Karim",
      "phone": "01712345678",
      "avatarUrl": null,
      "role": "STUDENT",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### GET /students

| | |
|---|---|
| Name | List students |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students` |
| Access | ADMIN, INSTRUCTOR |
| Success | **200** |
| Query | `programId, batch, status, search, page, limit` |
| Notes | Student status: ACTIVE | PROBATION | SUSPENDED | GRADUATED | WITHDRAWN. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Students retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "88888888-8888-4888-8888-888888888881",
      "studentId": "2026-BSC-CSE-0001",
      "programId": "22222222-2222-4222-8222-222222222222",
      "batch": "2026",
      "status": "ACTIVE",
      "cgpa": "3.45",
      "totalCreditsEarned": "12.0",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "user": {
        "id": "66666666-6666-4666-8666-666666666663",
        "email": "student01@bidyapith.edu",
        "firstName": "Aisha",
        "lastName": "Karim",
        "phone": "01712345678",
        "avatarUrl": null,
        "role": "STUDENT",
        "status": "ACTIVE",
        "provider": "CREDENTIALS",
        "emailVerified": true,
        "lastLoginAt": "2026-09-06T09:00:00.000Z",
        "createdAt": "2026-09-06T09:00:00.000Z",
        "updatedAt": "2026-09-06T09:00:00.000Z"
      },
      "program": {
        "id": "22222222-2222-4222-8222-222222222222",
        "code": "BSC-CSE",
        "name": "BSc in Computer Science and Engineering",
        "department": {
          "id": "11111111-1111-4111-8111-111111111111",
          "code": "CSE",
          "name": "Computer Science and Engineering"
        }
      }
    }
  ]
}
```

### GET /students/:id

| | |
|---|---|
| Name | Get student by profile id |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/88888888-8888-4888-8888-888888888881` |
| Access | ADMIN, INSTRUCTOR |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Student retrieved successfully",
  "data": {
    "id": "88888888-8888-4888-8888-888888888881",
    "studentId": "2026-BSC-CSE-0001",
    "programId": "22222222-2222-4222-8222-222222222222",
    "batch": "2026",
    "admissionDate": "2026-01-15T00:00:00.000Z",
    "status": "ACTIVE",
    "cgpa": "3.45",
    "totalCreditsEarned": "12.0",
    "guardianName": "Rahim Karim",
    "guardianPhone": "01812345678",
    "address": "Dhaka",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "program": {
      "id": "22222222-2222-4222-8222-222222222222",
      "code": "BSC-CSE",
      "name": "BSc in Computer Science and Engineering",
      "department": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "CSE",
        "name": "Computer Science and Engineering"
      }
    },
    "user": {
      "id": "66666666-6666-4666-8666-666666666663",
      "email": "student01@bidyapith.edu",
      "firstName": "Aisha",
      "lastName": "Karim",
      "phone": "01712345678",
      "avatarUrl": null,
      "role": "STUDENT",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### PATCH /students/:id

| | |
|---|---|
| Name | Admin update student |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/88888888-8888-4888-8888-888888888881` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "batch": "2026",
  "status": "ACTIVE"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Student updated successfully",
  "data": {
    "id": "88888888-8888-4888-8888-888888888881",
    "studentId": "2026-BSC-CSE-0001",
    "programId": "22222222-2222-4222-8222-222222222222",
    "batch": "2026",
    "admissionDate": "2026-01-15T00:00:00.000Z",
    "status": "ACTIVE",
    "cgpa": "3.45",
    "totalCreditsEarned": "12.0",
    "guardianName": "Rahim Karim",
    "guardianPhone": "01812345678",
    "address": "Dhaka",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "program": {
      "id": "22222222-2222-4222-8222-222222222222",
      "code": "BSC-CSE",
      "name": "BSc in Computer Science and Engineering",
      "department": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "CSE",
        "name": "Computer Science and Engineering"
      }
    },
    "user": {
      "id": "66666666-6666-4666-8666-666666666663",
      "email": "student01@bidyapith.edu",
      "firstName": "Aisha",
      "lastName": "Karim",
      "phone": "01712345678",
      "avatarUrl": null,
      "role": "STUDENT",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### GET /students/me/attendance

| | |
|---|---|
| Name | My attendance + exam eligibility |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/me/attendance` |
| Access | STUDENT |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance retrieved successfully",
  "data": {
    "semester": {
      "id": "44444444-4444-4444-8444-444444444441",
      "name": "Fall 2026",
      "status": "REGISTRATION"
    },
    "overall": {
      "attended": 9,
      "counted": 10,
      "rate": 0.9,
      "eligible": true
    },
    "ineligibleCourses": [],
    "courses": [
      {
        "offeringId": "55555555-5555-4555-8555-555555555551",
        "section": "A",
        "course": {
          "code": "CSE-2101",
          "title": "Data Structures"
        },
        "attended": 9,
        "counted": 10,
        "rate": 0.9,
        "eligible": true,
        "examEligible": true
      }
    ]
  }
}
```

### GET /students/me/exam-results

| | |
|---|---|
| Name | My published exam marks |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/me/exam-results` |
| Access | STUDENT |
| Success | **200** |
| Query | `offeringId?` |
| Notes | Only published exams. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exam results retrieved successfully",
  "data": {
    "data": [
      {
        "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
        "marksObtained": "42.00",
        "remarks": null,
        "exam": {
          "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
          "title": "Midterm 1",
          "type": "MIDTERM",
          "totalMarks": "50.00",
          "weight": "30.00",
          "examDate": "2026-10-01T00:00:00.000Z",
          "offering": {
            "id": "55555555-5555-4555-8555-555555555551",
            "section": "A",
            "course": {
              "code": "CSE-2101",
              "title": "Data Structures"
            }
          }
        }
      }
    ]
  }
}
```

### GET /students/me/results

| | |
|---|---|
| Name | My semester GPAs |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/me/results` |
| Access | STUDENT |
| Success | **200** |
| Query | `semesterId?` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Results retrieved successfully",
  "data": [
    {
      "semesterId": "44444444-4444-4444-8444-444444444441",
      "name": "Spring 2026",
      "term": "SPRING",
      "year": 2026,
      "gpa": "3.45",
      "creditsAttempted": "12.0",
      "creditsEarned": "12.0",
      "cgpaSnapshot": "3.45",
      "publishedAt": "2026-09-06T09:00:00.000Z",
      "courses": [
        {
          "code": "CSE-1101",
          "title": "Introduction to Programming",
          "credits": "3.0",
          "letterGrade": "A",
          "gradePoint": "4.00"
        }
      ]
    }
  ]
}
```

### GET /students/me/transcript

| | |
|---|---|
| Name | My transcript |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/me/transcript` |
| Access | STUDENT |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Transcript retrieved successfully",
  "data": {
    "student": {
      "id": "88888888-8888-4888-8888-888888888881",
      "studentId": "2026-BSC-CSE-0001",
      "firstName": "Aisha",
      "lastName": "Karim"
    },
    "semesters": [
      {
        "semesterId": "44444444-4444-4444-8444-444444444441",
        "name": "Spring 2026",
        "term": "SPRING",
        "year": 2026,
        "gpa": "3.45",
        "creditsAttempted": "12.0",
        "creditsEarned": "12.0",
        "cgpaSnapshot": "3.45",
        "publishedAt": "2026-09-06T09:00:00.000Z",
        "courses": [
          {
            "code": "CSE-1101",
            "title": "Introduction to Programming",
            "credits": "3.0",
            "letterGrade": "A",
            "gradePoint": "4.00"
          }
        ]
      }
    ],
    "cumulative": {
      "cgpa": "3.45",
      "creditsEarned": "12.0"
    }
  }
}
```

### GET /students/:id/transcript

| | |
|---|---|
| Name | Admin transcript by student profile id |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/students/88888888-8888-4888-8888-888888888881/transcript` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Transcript retrieved successfully",
  "data": {
    "student": {
      "id": "88888888-8888-4888-8888-888888888881",
      "studentId": "2026-BSC-CSE-0001",
      "firstName": "Aisha",
      "lastName": "Karim"
    },
    "semesters": [],
    "cumulative": {
      "cgpa": "3.45",
      "creditsEarned": "12.0"
    }
  }
}
```


## 5. Instructors

### GET /instructors/me

| | |
|---|---|
| Name | Get my instructor profile |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/instructors/me` |
| Access | INSTRUCTOR |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Instructor profile retrieved successfully",
  "data": {
    "id": "77777777-7777-4777-8777-777777777771",
    "employeeId": "EMP-0001",
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "designation": "PROFESSOR",
    "specialization": "Algorithms",
    "joiningDate": "2018-01-15T00:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    },
    "user": {
      "id": "66666666-6666-4666-8666-666666666662",
      "email": "instructor01@bidyapith.edu",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "phone": null,
      "avatarUrl": null,
      "role": "INSTRUCTOR",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### PATCH /instructors/me

| | |
|---|---|
| Name | Update my specialization |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/instructors/me` |
| Access | INSTRUCTOR |
| Success | **200** |
| Notes | Empty string stores `null`. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "specialization": "Algorithms"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Instructor profile updated successfully",
  "data": {
    "id": "77777777-7777-4777-8777-777777777771",
    "employeeId": "EMP-0001",
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "designation": "PROFESSOR",
    "specialization": "Algorithms",
    "joiningDate": "2018-01-15T00:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    },
    "user": {
      "id": "66666666-6666-4666-8666-666666666662",
      "email": "instructor01@bidyapith.edu",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "phone": null,
      "avatarUrl": null,
      "role": "INSTRUCTOR",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### GET /instructors

| | |
|---|---|
| Name | List instructors |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/instructors` |
| Access | Auth |
| Success | **200** |
| Query | `departmentId, designation, search, page, limit` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Instructors retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "77777777-7777-4777-8777-777777777771",
      "employeeId": "EMP-0001",
      "departmentId": "11111111-1111-4111-8111-111111111111",
      "designation": "PROFESSOR",
      "specialization": "Algorithms",
      "joiningDate": "2018-01-15T00:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "department": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "CSE",
        "name": "Computer Science and Engineering"
      },
      "user": {
        "id": "66666666-6666-4666-8666-666666666662",
        "email": "instructor01@bidyapith.edu",
        "firstName": "Mahmud",
        "lastName": "Hasan",
        "phone": null,
        "avatarUrl": null,
        "role": "INSTRUCTOR",
        "status": "ACTIVE",
        "provider": "CREDENTIALS",
        "emailVerified": true,
        "lastLoginAt": "2026-09-06T09:00:00.000Z",
        "createdAt": "2026-09-06T09:00:00.000Z",
        "updatedAt": "2026-09-06T09:00:00.000Z"
      }
    }
  ]
}
```

### GET /instructors/:id

| | |
|---|---|
| Name | Get instructor by profile id |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/instructors/77777777-7777-4777-8777-777777777771` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Instructor retrieved successfully",
  "data": {
    "id": "77777777-7777-4777-8777-777777777771",
    "employeeId": "EMP-0001",
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "designation": "PROFESSOR",
    "specialization": "Algorithms",
    "joiningDate": "2018-01-15T00:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    },
    "user": {
      "id": "66666666-6666-4666-8666-666666666662",
      "email": "instructor01@bidyapith.edu",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "phone": null,
      "avatarUrl": null,
      "role": "INSTRUCTOR",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```

### PATCH /instructors/:id

| | |
|---|---|
| Name | Admin update instructor |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/instructors/77777777-7777-4777-8777-777777777771` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "designation": "PROFESSOR",
  "specialization": "Algorithms"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Instructor updated successfully",
  "data": {
    "id": "77777777-7777-4777-8777-777777777771",
    "employeeId": "EMP-0001",
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "designation": "PROFESSOR",
    "specialization": "Algorithms",
    "joiningDate": "2018-01-15T00:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    },
    "user": {
      "id": "66666666-6666-4666-8666-666666666662",
      "email": "instructor01@bidyapith.edu",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "phone": null,
      "avatarUrl": null,
      "role": "INSTRUCTOR",
      "status": "ACTIVE",
      "provider": "CREDENTIALS",
      "emailVerified": true,
      "lastLoginAt": "2026-09-06T09:00:00.000Z",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  }
}
```


## 6. Departments

### POST /departments

| | |
|---|---|
| Name | Create department |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/departments` |
| Access | ADMIN |
| Success | **201** |
| Notes | `code` is 2–6 uppercase letters. Duplicate code → 409. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "code": "EEE",
  "name": "Electrical and Electronic Engineering",
  "contactEmail": "eee@bidyapith.edu"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Department created successfully",
  "data": {
    "id": "11111111-1111-4111-8111-111111111199",
    "code": "EEE",
    "name": "Electrical and Electronic Engineering",
    "contactEmail": "eee@bidyapith.edu",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### GET /departments

| | |
|---|---|
| Name | List departments |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/departments` |
| Access | Auth |
| Success | **200** |
| Query | `search, page, limit` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Departments retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering",
      "contactEmail": "cse@bidyapith.edu",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  ]
}
```

### GET /departments/:id

| | |
|---|---|
| Name | Get department |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/departments/11111111-1111-4111-8111-111111111111` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Department retrieved successfully",
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "code": "CSE",
    "name": "Computer Science and Engineering",
    "contactEmail": "cse@bidyapith.edu",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "courseCount": 12,
    "instructorCount": 6
  }
}
```

### PATCH /departments/:id

| | |
|---|---|
| Name | Update department |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/departments/11111111-1111-4111-8111-111111111111` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "contactEmail": "cse-office@bidyapith.edu"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Department updated successfully",
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "code": "CSE",
    "name": "Computer Science and Engineering",
    "contactEmail": "cse-office@bidyapith.edu",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### DELETE /departments/:id

| | |
|---|---|
| Name | Soft-delete department |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/departments/11111111-1111-4111-8111-111111111111` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Department deleted successfully",
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "code": "CSE",
    "name": "Computer Science and Engineering",
    "contactEmail": "cse@bidyapith.edu",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```


## 7. Programs

### POST /programs

| | |
|---|---|
| Name | Create program |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs` |
| Access | ADMIN |
| Success | **201** |
| Notes | degreeType: BSC | BA | BBA | MSC | MA | MBA. totalCredits 30–200. Money as string or number. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "code": "BSC-EEE",
  "name": "BSc in EEE",
  "departmentId": "11111111-1111-4111-8111-111111111111",
  "degreeType": "BSC",
  "totalCredits": 160,
  "feePerCredit": "3500",
  "durationYears": 4,
  "minCreditsPerSemester": 9,
  "maxCreditsPerSemester": 15,
  "registrationFee": "5000"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Program created successfully",
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "code": "BSC-EEE",
    "name": "BSc in EEE",
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "degreeType": "BSC",
    "totalCredits": 160,
    "durationYears": 4,
    "minCreditsPerSemester": 9,
    "maxCreditsPerSemester": 15,
    "feePerCredit": "3500.00",
    "registrationFee": "5000.00",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    }
  }
}
```

### GET /programs

| | |
|---|---|
| Name | List programs |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs` |
| Access | Auth |
| Success | **200** |
| Query | `departmentId, degreeType, page, limit` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Programs retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "code": "BSC-CSE",
      "name": "BSc in Computer Science and Engineering",
      "departmentId": "11111111-1111-4111-8111-111111111111",
      "degreeType": "BSC",
      "totalCredits": 160,
      "durationYears": 4,
      "minCreditsPerSemester": 9,
      "maxCreditsPerSemester": 15,
      "feePerCredit": "3500.00",
      "registrationFee": "5000.00",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "department": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "CSE",
        "name": "Computer Science and Engineering"
      }
    }
  ]
}
```

### GET /programs/:id

| | |
|---|---|
| Name | Get program |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs/22222222-2222-4222-8222-222222222222` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Program retrieved successfully",
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "code": "BSC-CSE",
    "name": "BSc in Computer Science and Engineering",
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "degreeType": "BSC",
    "totalCredits": 160,
    "durationYears": 4,
    "minCreditsPerSemester": 9,
    "maxCreditsPerSemester": 15,
    "feePerCredit": "3500.00",
    "registrationFee": "5000.00",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    }
  }
}
```

### PATCH /programs/:id

| | |
|---|---|
| Name | Update program |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs/22222222-2222-4222-8222-222222222222` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "feePerCredit": "3600"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Program updated successfully",
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "code": "BSC-CSE",
    "name": "BSc in Computer Science and Engineering",
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "degreeType": "BSC",
    "totalCredits": 160,
    "durationYears": 4,
    "minCreditsPerSemester": 9,
    "maxCreditsPerSemester": 15,
    "feePerCredit": "3600.00",
    "registrationFee": "5000.00",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    }
  }
}
```

### DELETE /programs/:id

| | |
|---|---|
| Name | Soft-delete program |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs/22222222-2222-4222-8222-222222222222` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Program deleted successfully",
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "code": "BSC-CSE",
    "name": "BSc in Computer Science and Engineering",
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "degreeType": "BSC",
    "totalCredits": 160,
    "durationYears": 4,
    "minCreditsPerSemester": 9,
    "maxCreditsPerSemester": 15,
    "feePerCredit": "3500.00",
    "registrationFee": "5000.00",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    }
  }
}
```

### GET /programs/:id/curriculum

| | |
|---|---|
| Name | Get curriculum |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs/22222222-2222-4222-8222-222222222222/curriculum` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Curriculum retrieved successfully",
  "data": {
    "programId": "22222222-2222-4222-8222-222222222222",
    "programCode": "BSC-CSE",
    "totalCreditsRequired": 160,
    "overallCredits": "6.0",
    "coreCredits": "6.0",
    "coreMeetsProgramTotal": false,
    "semesters": [
      {
        "recommendedSemester": 1,
        "totalCredits": "3.0",
        "courses": [
          {
            "id": "33333333-3333-4333-8333-333333333301",
            "code": "CSE-1101",
            "title": "Introduction to Programming",
            "credits": "3.0",
            "type": "CORE",
            "level": 1,
            "curriculumType": "CORE"
          }
        ]
      }
    ]
  }
}
```

### POST /programs/:id/courses

| | |
|---|---|
| Name | Attach course to curriculum |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs/22222222-2222-4222-8222-222222222222/courses` |
| Access | ADMIN |
| Success | **201** |
| Notes | Curriculum type: CORE | ELECTIVE | LAB | THESIS. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "courseId": "33333333-3333-4333-8333-333333333301",
  "type": "CORE",
  "recommendedSemester": 1
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Course added to curriculum",
  "data": {
    "type": "CORE",
    "recommendedSemester": 1,
    "course": {
      "id": "33333333-3333-4333-8333-333333333301",
      "code": "CSE-1101",
      "title": "Introduction to Programming",
      "credits": "3.0",
      "type": "CORE",
      "level": 1
    }
  }
}
```

### PATCH /programs/:id/courses/:courseId

| | |
|---|---|
| Name | Update curriculum row |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs/22222222-2222-4222-8222-222222222222/courses/33333333-3333-4333-8333-333333333301` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "type": "CORE",
  "recommendedSemester": 1
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Curriculum entry updated successfully",
  "data": {
    "type": "CORE",
    "recommendedSemester": 1,
    "course": {
      "id": "33333333-3333-4333-8333-333333333301",
      "code": "CSE-1101",
      "title": "Introduction to Programming",
      "credits": "3.0",
      "type": "CORE",
      "level": 1
    }
  }
}
```

### DELETE /programs/:id/courses/:courseId

| | |
|---|---|
| Name | Detach course from curriculum |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/programs/22222222-2222-4222-8222-222222222222/courses/33333333-3333-4333-8333-333333333301` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Course removed from curriculum",
  "data": null
}
```


## 8. Courses

### POST /courses

| | |
|---|---|
| Name | Create course |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses` |
| Access | ADMIN |
| Success | **201** |
| Notes | Code `XXX-0000`. Credits 0.5–6.0 in 0.5 steps. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "code": "CSE-1102",
  "title": "Discrete Mathematics",
  "credits": "3.0",
  "departmentId": "11111111-1111-4111-8111-111111111111",
  "type": "CORE",
  "level": 1,
  "description": "Logic and proofs"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Course created successfully",
  "data": {
    "id": "33333333-3333-4333-8333-333333333301",
    "code": "CSE-1102",
    "title": "Discrete Mathematics",
    "description": "Programming fundamentals",
    "credits": "3.0",
    "type": "CORE",
    "level": 1,
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    }
  }
}
```

### GET /courses

| | |
|---|---|
| Name | List courses |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses` |
| Access | Auth |
| Success | **200** |
| Query | `search, departmentId, type, level, minCredits, maxCredits, page, limit` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Courses retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPage": 1
  },
  "data": [
    {
      "id": "33333333-3333-4333-8333-333333333301",
      "code": "CSE-1101",
      "title": "Introduction to Programming",
      "description": "Programming fundamentals",
      "credits": "3.0",
      "type": "CORE",
      "level": 1,
      "departmentId": "11111111-1111-4111-8111-111111111111",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "department": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "CSE",
        "name": "Computer Science and Engineering"
      }
    },
    {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "description": "Lists, trees, graphs",
      "credits": "3.0",
      "type": "CORE",
      "level": 2,
      "departmentId": "11111111-1111-4111-8111-111111111111",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "department": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "CSE",
        "name": "Computer Science and Engineering"
      }
    }
  ]
}
```

### GET /courses/:courseId

| | |
|---|---|
| Name | Get course (includes prerequisite tree) |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses/33333333-3333-4333-8333-333333333302` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Course retrieved successfully",
  "data": {
    "id": "33333333-3333-4333-8333-333333333302",
    "code": "CSE-2101",
    "title": "Data Structures",
    "description": "Lists, trees, graphs",
    "credits": "3.0",
    "type": "CORE",
    "level": 2,
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    },
    "prerequisites": [
      {
        "id": "33333333-3333-4333-8333-333333333301",
        "code": "CSE-1101",
        "title": "Introduction to Programming",
        "credits": "3.0",
        "type": "CORE",
        "level": 1,
        "departmentId": "11111111-1111-4111-8111-111111111111",
        "minGradePoint": "2.00",
        "prerequisites": []
      }
    ]
  }
}
```

### PATCH /courses/:courseId

| | |
|---|---|
| Name | Update course |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses/33333333-3333-4333-8333-333333333302` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "title": "Data Structures and Algorithms"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Course updated successfully",
  "data": {
    "id": "33333333-3333-4333-8333-333333333302",
    "code": "CSE-2101",
    "title": "Data Structures and Algorithms",
    "description": "Lists, trees, graphs",
    "credits": "3.0",
    "type": "CORE",
    "level": 2,
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    }
  }
}
```

### DELETE /courses/:courseId

| | |
|---|---|
| Name | Soft-delete course |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses/33333333-3333-4333-8333-333333333302` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Course deleted successfully",
  "data": {
    "id": "33333333-3333-4333-8333-333333333302",
    "code": "CSE-2101",
    "title": "Data Structures",
    "description": "Lists, trees, graphs",
    "credits": "3.0",
    "type": "CORE",
    "level": 2,
    "departmentId": "11111111-1111-4111-8111-111111111111",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "department": {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "CSE",
      "name": "Computer Science and Engineering"
    }
  }
}
```


## 9. Prerequisites

### POST /courses/:courseId/prerequisites

| | |
|---|---|
| Name | Add prerequisite |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses/33333333-3333-4333-8333-333333333302/prerequisites` |
| Access | ADMIN |
| Success | **201** |
| Notes | Cycle is rejected. Duplicate edge → 409. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "prerequisiteId": "33333333-3333-4333-8333-333333333301",
  "minGradePoint": "2.00"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Prerequisite added successfully",
  "data": {
    "minGradePoint": "2.00",
    "course": {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0",
      "type": "CORE",
      "level": 2,
      "departmentId": "11111111-1111-4111-8111-111111111111"
    },
    "prerequisite": {
      "id": "33333333-3333-4333-8333-333333333301",
      "code": "CSE-1101",
      "title": "Introduction to Programming",
      "credits": "3.0",
      "type": "CORE",
      "level": 1,
      "departmentId": "11111111-1111-4111-8111-111111111111"
    }
  }
}
```

### GET /courses/:courseId/prerequisites

| | |
|---|---|
| Name | Get prerequisite tree |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses/33333333-3333-4333-8333-333333333302/prerequisites` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Prerequisites retrieved successfully",
  "data": {
    "course": {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0",
      "type": "CORE",
      "level": 2,
      "departmentId": "11111111-1111-4111-8111-111111111111"
    },
    "prerequisites": [
      {
        "id": "33333333-3333-4333-8333-333333333301",
        "code": "CSE-1101",
        "title": "Introduction to Programming",
        "credits": "3.0",
        "type": "CORE",
        "level": 1,
        "departmentId": "11111111-1111-4111-8111-111111111111",
        "minGradePoint": "2.00",
        "prerequisites": []
      }
    ]
  }
}
```

### GET /courses/:courseId/dependents

| | |
|---|---|
| Name | Get dependent courses |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses/33333333-3333-4333-8333-333333333301/dependents` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dependent courses retrieved successfully",
  "data": [
    {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0",
      "type": "CORE",
      "level": 2,
      "departmentId": "11111111-1111-4111-8111-111111111111",
      "minGradePoint": "2.00"
    }
  ]
}
```

### DELETE /courses/:courseId/prerequisites/:prerequisiteId

| | |
|---|---|
| Name | Remove prerequisite |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/courses/33333333-3333-4333-8333-333333333302/prerequisites/33333333-3333-4333-8333-333333333301` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Prerequisite removed successfully",
  "data": null
}
```


## 10. Semesters

### POST /semesters

| | |
|---|---|
| Name | Create semester |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters` |
| Access | ADMIN |
| Success | **201** |
| Notes | term: SPRING | SUMMER | FALL. Dates must be in legal order. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "term": "FALL",
  "year": 2027,
  "registrationStart": "2027-08-01T00:00:00.000Z",
  "registrationEnd": "2027-08-20T00:00:00.000Z",
  "dropDeadline": "2027-09-10T00:00:00.000Z",
  "classStartDate": "2027-08-21T00:00:00.000Z",
  "classEndDate": "2027-12-15T00:00:00.000Z"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Semester created successfully",
  "data": {
    "id": "44444444-4444-4444-8444-444444444441",
    "term": "FALL",
    "year": 2027,
    "name": "Fall 2027",
    "status": "UPCOMING",
    "registrationStart": "2026-08-01T00:00:00.000Z",
    "registrationEnd": "2026-08-20T00:00:00.000Z",
    "dropDeadline": "2026-09-10T00:00:00.000Z",
    "classStartDate": "2026-08-21T00:00:00.000Z",
    "classEndDate": "2026-12-15T00:00:00.000Z",
    "resultPublishedAt": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### GET /semesters

| | |
|---|---|
| Name | List semesters |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters` |
| Access | Auth |
| Success | **200** |
| Query | `status, year, page, limit` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Semesters retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "44444444-4444-4444-8444-444444444441",
      "term": "FALL",
      "year": 2026,
      "name": "Fall 2026",
      "status": "REGISTRATION",
      "registrationStart": "2026-08-01T00:00:00.000Z",
      "registrationEnd": "2026-08-20T00:00:00.000Z",
      "dropDeadline": "2026-09-10T00:00:00.000Z",
      "classStartDate": "2026-08-21T00:00:00.000Z",
      "classEndDate": "2026-12-15T00:00:00.000Z",
      "resultPublishedAt": null,
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  ]
}
```

### GET /semesters/current

| | |
|---|---|
| Name | Current semester |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters/current` |
| Access | Auth |
| Success | **200** |
| Notes | REGISTRATION if open, else ONGOING. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Current semester retrieved successfully",
  "data": {
    "id": "44444444-4444-4444-8444-444444444441",
    "term": "FALL",
    "year": 2026,
    "name": "Fall 2026",
    "status": "REGISTRATION",
    "registrationStart": "2026-08-01T00:00:00.000Z",
    "registrationEnd": "2026-08-20T00:00:00.000Z",
    "dropDeadline": "2026-09-10T00:00:00.000Z",
    "classStartDate": "2026-08-21T00:00:00.000Z",
    "classEndDate": "2026-12-15T00:00:00.000Z",
    "resultPublishedAt": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### GET /semesters/:id

| | |
|---|---|
| Name | Get semester |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters/44444444-4444-4444-8444-444444444441` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Semester retrieved successfully",
  "data": {
    "id": "44444444-4444-4444-8444-444444444441",
    "term": "FALL",
    "year": 2026,
    "name": "Fall 2026",
    "status": "REGISTRATION",
    "registrationStart": "2026-08-01T00:00:00.000Z",
    "registrationEnd": "2026-08-20T00:00:00.000Z",
    "dropDeadline": "2026-09-10T00:00:00.000Z",
    "classStartDate": "2026-08-21T00:00:00.000Z",
    "classEndDate": "2026-12-15T00:00:00.000Z",
    "resultPublishedAt": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### PATCH /semesters/:id

| | |
|---|---|
| Name | Update semester dates |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters/44444444-4444-4444-8444-444444444441` |
| Access | ADMIN |
| Success | **200** |
| Notes | Only while UPCOMING or REGISTRATION. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "dropDeadline": "2026-09-15T00:00:00.000Z"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Semester updated successfully",
  "data": {
    "id": "44444444-4444-4444-8444-444444444441",
    "term": "FALL",
    "year": 2026,
    "name": "Fall 2026",
    "status": "REGISTRATION",
    "registrationStart": "2026-08-01T00:00:00.000Z",
    "registrationEnd": "2026-08-20T00:00:00.000Z",
    "dropDeadline": "2026-09-15T00:00:00.000Z",
    "classStartDate": "2026-08-21T00:00:00.000Z",
    "classEndDate": "2026-12-15T00:00:00.000Z",
    "resultPublishedAt": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### PATCH /semesters/:id/status

| | |
|---|---|
| Name | Change semester status |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters/44444444-4444-4444-8444-444444444441/status` |
| Access | ADMIN |
| Success | **200** |
| Notes | Legal transitions only. Status: UPCOMING | REGISTRATION | ONGOING | GRADING | COMPLETED | CANCELLED. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "status": "ONGOING"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Semester status updated successfully",
  "data": {
    "id": "44444444-4444-4444-8444-444444444441",
    "term": "FALL",
    "year": 2026,
    "name": "Fall 2026",
    "status": "ONGOING",
    "registrationStart": "2026-08-01T00:00:00.000Z",
    "registrationEnd": "2026-08-20T00:00:00.000Z",
    "dropDeadline": "2026-09-10T00:00:00.000Z",
    "classStartDate": "2026-08-21T00:00:00.000Z",
    "classEndDate": "2026-12-15T00:00:00.000Z",
    "resultPublishedAt": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### DELETE /semesters/:id

| | |
|---|---|
| Name | Soft-delete semester |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters/44444444-4444-4444-8444-444444444441` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Semester deleted successfully",
  "data": {
    "id": "44444444-4444-4444-8444-444444444441",
    "term": "FALL",
    "year": 2026,
    "name": "Fall 2026",
    "status": "REGISTRATION",
    "registrationStart": "2026-08-01T00:00:00.000Z",
    "registrationEnd": "2026-08-20T00:00:00.000Z",
    "dropDeadline": "2026-09-10T00:00:00.000Z",
    "classStartDate": "2026-08-21T00:00:00.000Z",
    "classEndDate": "2026-12-15T00:00:00.000Z",
    "resultPublishedAt": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### GET /semesters/:id/results/readiness

| | |
|---|---|
| Name | Result publish readiness |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters/44444444-4444-4444-8444-444444444441/results/readiness` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Result readiness retrieved successfully",
  "data": {
    "ready": false,
    "totalOfferings": 4,
    "gradedOfferings": 3,
    "totalEnrollments": 40,
    "gradedEnrollments": 38,
    "blockers": [
      {
        "offeringId": "55555555-5555-4555-8555-555555555551",
        "course": "CSE-2101",
        "section": "A",
        "reason": "UNGRADED",
        "count": 2
      }
    ]
  }
}
```

### POST /semesters/:id/publish-results

| | |
|---|---|
| Name | Publish semester results |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/semesters/44444444-4444-4444-8444-444444444441/publish-results` |
| Access | ADMIN |
| Success | **200** |
| Notes | Semester must be GRADING and readiness.ready true. Writes SemesterResult. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Semester results published successfully",
  "data": {
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "name": "Fall 2026",
    "students": 20,
    "enrollments": 40,
    "publishedAt": "2026-09-06T09:00:00.000Z",
    "elapsedMs": 812
  }
}
```


## 11. Offerings

### POST /offerings

| | |
|---|---|
| Name | Create offering |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings` |
| Access | ADMIN |
| Success | **201** |
| Notes | section A–Z. Status starts DRAFT. dayOfWeek: SUNDAY … SATURDAY. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "courseId": "33333333-3333-4333-8333-333333333302",
  "semesterId": "44444444-4444-4444-8444-444444444441",
  "section": "B",
  "capacity": 40,
  "room": "R-102",
  "instructorId": "77777777-7777-4777-8777-777777777771",
  "schedules": [
    {
      "dayOfWeek": "MONDAY",
      "startTime": "11:00",
      "endTime": "12:30",
      "room": "R-102"
    }
  ]
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Offering created successfully",
  "data": {
    "id": "55555555-5555-4555-8555-555555555551",
    "courseId": "33333333-3333-4333-8333-333333333302",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "instructorId": "77777777-7777-4777-8777-777777777771",
    "section": "B",
    "capacity": 40,
    "enrolledCount": 0,
    "seatsRemaining": 40,
    "status": "DRAFT",
    "room": "R-102",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "course": {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0"
    },
    "instructor": {
      "id": "77777777-7777-4777-8777-777777777771",
      "employeeId": "EMP-0001",
      "designation": "PROFESSOR",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "name": "Mahmud Hasan"
    }
  }
}
```

### GET /offerings

| | |
|---|---|
| Name | List offerings |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings` |
| Access | Auth |
| Success | **200** |
| Query | `semesterId, courseId, instructorId, departmentId, status, hasSeats=true, search` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Offerings retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "55555555-5555-4555-8555-555555555551",
      "courseId": "33333333-3333-4333-8333-333333333302",
      "semesterId": "44444444-4444-4444-8444-444444444441",
      "instructorId": "77777777-7777-4777-8777-777777777771",
      "section": "A",
      "capacity": 40,
      "enrolledCount": 12,
      "seatsRemaining": 28,
      "status": "OPEN",
      "room": "R-101",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "course": {
        "id": "33333333-3333-4333-8333-333333333302",
        "code": "CSE-2101",
        "title": "Data Structures",
        "credits": "3.0"
      },
      "instructor": {
        "id": "77777777-7777-4777-8777-777777777771",
        "employeeId": "EMP-0001",
        "designation": "PROFESSOR",
        "firstName": "Mahmud",
        "lastName": "Hasan",
        "name": "Mahmud Hasan"
      }
    }
  ]
}
```

### GET /offerings/my-teaching

| | |
|---|---|
| Name | My teaching load |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/my-teaching` |
| Access | INSTRUCTOR |
| Success | **200** |
| Query | `semesterId?` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Teaching offerings retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "55555555-5555-4555-8555-555555555551",
      "courseId": "33333333-3333-4333-8333-333333333302",
      "semesterId": "44444444-4444-4444-8444-444444444441",
      "instructorId": "77777777-7777-4777-8777-777777777771",
      "section": "A",
      "capacity": 40,
      "enrolledCount": 12,
      "seatsRemaining": 28,
      "status": "OPEN",
      "room": "R-101",
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "course": {
        "id": "33333333-3333-4333-8333-333333333302",
        "code": "CSE-2101",
        "title": "Data Structures",
        "credits": "3.0"
      },
      "instructor": {
        "id": "77777777-7777-4777-8777-777777777771",
        "employeeId": "EMP-0001",
        "designation": "PROFESSOR",
        "firstName": "Mahmud",
        "lastName": "Hasan",
        "name": "Mahmud Hasan"
      }
    }
  ]
}
```

### GET /offerings/:id

| | |
|---|---|
| Name | Get offering + schedule |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551` |
| Access | Auth |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Offering retrieved successfully",
  "data": {
    "id": "55555555-5555-4555-8555-555555555551",
    "courseId": "33333333-3333-4333-8333-333333333302",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "instructorId": "77777777-7777-4777-8777-777777777771",
    "section": "A",
    "capacity": 40,
    "enrolledCount": 12,
    "seatsRemaining": 28,
    "status": "OPEN",
    "room": "R-101",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "course": {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0"
    },
    "instructor": {
      "id": "77777777-7777-4777-8777-777777777771",
      "employeeId": "EMP-0001",
      "designation": "PROFESSOR",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "name": "Mahmud Hasan"
    },
    "semester": {
      "id": "44444444-4444-4444-8444-444444444441",
      "name": "Fall 2026",
      "status": "REGISTRATION"
    },
    "schedules": [
      {
        "id": "55555555-5555-4555-8555-555555555559",
        "dayOfWeek": "SUNDAY",
        "startTime": "09:00",
        "endTime": "10:30",
        "room": "R-101"
      }
    ]
  }
}
```

### PATCH /offerings/:id

| | |
|---|---|
| Name | Update offering |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "capacity": 45,
  "room": "R-105"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Offering updated successfully",
  "data": {
    "id": "55555555-5555-4555-8555-555555555551",
    "courseId": "33333333-3333-4333-8333-333333333302",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "instructorId": "77777777-7777-4777-8777-777777777771",
    "section": "A",
    "capacity": 45,
    "enrolledCount": 12,
    "seatsRemaining": 33,
    "status": "OPEN",
    "room": "R-105",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "course": {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0"
    },
    "instructor": {
      "id": "77777777-7777-4777-8777-777777777771",
      "employeeId": "EMP-0001",
      "designation": "PROFESSOR",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "name": "Mahmud Hasan"
    }
  }
}
```

### PATCH /offerings/:id/instructor

| | |
|---|---|
| Name | Assign instructor |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/instructor` |
| Access | ADMIN |
| Success | **200** |
| Notes | `instructorId` may be `null` to unassign. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "instructorId": "77777777-7777-4777-8777-777777777771"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Instructor assigned successfully",
  "data": {
    "id": "55555555-5555-4555-8555-555555555551",
    "courseId": "33333333-3333-4333-8333-333333333302",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "instructorId": "77777777-7777-4777-8777-777777777771",
    "section": "A",
    "capacity": 40,
    "enrolledCount": 12,
    "seatsRemaining": 28,
    "status": "OPEN",
    "room": "R-101",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "course": {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0"
    },
    "instructor": {
      "id": "77777777-7777-4777-8777-777777777771",
      "employeeId": "EMP-0001",
      "designation": "PROFESSOR",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "name": "Mahmud Hasan"
    }
  }
}
```

### PATCH /offerings/:id/status

| | |
|---|---|
| Name | Change offering status |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/status` |
| Access | ADMIN |
| Success | **200** |
| Notes | DRAFT→OPEN/CANCELLED; OPEN→CLOSED/CANCELLED; CLOSED→COMPLETED/CANCELLED. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "status": "OPEN"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Offering status updated successfully",
  "data": {
    "id": "55555555-5555-4555-8555-555555555551",
    "courseId": "33333333-3333-4333-8333-333333333302",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "instructorId": "77777777-7777-4777-8777-777777777771",
    "section": "A",
    "capacity": 40,
    "enrolledCount": 12,
    "seatsRemaining": 28,
    "status": "OPEN",
    "room": "R-101",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "course": {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0"
    },
    "instructor": {
      "id": "77777777-7777-4777-8777-777777777771",
      "employeeId": "EMP-0001",
      "designation": "PROFESSOR",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "name": "Mahmud Hasan"
    }
  }
}
```

### POST /offerings/:id/schedules

| | |
|---|---|
| Name | Add schedule slot |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/schedules` |
| Access | ADMIN |
| Success | **201** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "dayOfWeek": "TUESDAY",
  "startTime": "09:00",
  "endTime": "10:30",
  "room": "R-101"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Schedule slot added successfully",
  "data": {
    "id": "55555555-5555-4555-8555-555555555558",
    "dayOfWeek": "TUESDAY",
    "startTime": "09:00",
    "endTime": "10:30",
    "room": "R-101"
  }
}
```

### DELETE /offerings/:id/schedules/:scheduleId

| | |
|---|---|
| Name | Remove schedule slot |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/schedules/55555555-5555-4555-8555-555555555559` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Schedule slot removed successfully",
  "data": {
    "id": "55555555-5555-4555-8555-555555555559"
  }
}
```

### DELETE /offerings/:id

| | |
|---|---|
| Name | Cancel / soft-delete offering |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Offering cancelled successfully",
  "data": {
    "id": "55555555-5555-4555-8555-555555555551",
    "courseId": "33333333-3333-4333-8333-333333333302",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "instructorId": "77777777-7777-4777-8777-777777777771",
    "section": "A",
    "capacity": 40,
    "enrolledCount": 12,
    "seatsRemaining": 28,
    "status": "CANCELLED",
    "room": "R-101",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z",
    "course": {
      "id": "33333333-3333-4333-8333-333333333302",
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0"
    },
    "instructor": {
      "id": "77777777-7777-4777-8777-777777777771",
      "employeeId": "EMP-0001",
      "designation": "PROFESSOR",
      "firstName": "Mahmud",
      "lastName": "Hasan",
      "name": "Mahmud Hasan"
    }
  }
}
```


## 12. Offering roster, attendance, exams, grades

### GET /offerings/:id/students

| | |
|---|---|
| Name | Offering roster |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/students` |
| Access | INSTRUCTOR (own offering) or ADMIN |
| Success | **200** |
| Query | `includeDropped=true?, page, limit` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Offering roster retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": {
    "offering": {
      "id": "55555555-5555-4555-8555-555555555551",
      "section": "A",
      "course": {
        "id": "33333333-3333-4333-8333-333333333302",
        "code": "CSE-2101",
        "title": "Data Structures",
        "credits": "3.0"
      }
    },
    "students": [
      {
        "enrollmentId": "99999999-9999-4999-8999-999999999991",
        "status": "ENROLLED",
        "enrolledAt": "2026-09-06T09:00:00.000Z",
        "studentId": "2026-BSC-CSE-0001",
        "firstName": "Aisha",
        "lastName": "Karim"
      }
    ]
  }
}
```

### POST /offerings/:id/attendance

| | |
|---|---|
| Name | Mark attendance |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/attendance` |
| Access | INSTRUCTOR (own) or ADMIN |
| Success | **200** |
| Notes | status: PRESENT | ABSENT | LATE | EXCUSED. Duplicate enrollmentId in payload → 422. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "date": "2026-09-06",
  "records": [
    {
      "enrollmentId": "99999999-9999-4999-8999-999999999991",
      "status": "PRESENT",
      "remarks": "On time"
    }
  ]
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance recorded successfully",
  "data": {
    "date": "2026-09-06",
    "marked": 1,
    "present": 1,
    "late": 0,
    "absent": 0,
    "excused": 0,
    "droppedBelowThreshold": 0
  }
}
```

### GET /offerings/:id/attendance

| | |
|---|---|
| Name | Get attendance session |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/attendance` |
| Access | INSTRUCTOR (own) or ADMIN |
| Success | **200** |
| Query | `date=2026-09-06 (required, YYYY-MM-DD)` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance session retrieved successfully",
  "data": {
    "date": "2026-09-06",
    "records": [
      {
        "id": "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        "enrollmentId": "99999999-9999-4999-8999-999999999991",
        "status": "PRESENT",
        "remarks": "On time",
        "studentId": "2026-BSC-CSE-0001",
        "firstName": "Aisha",
        "lastName": "Karim"
      }
    ]
  }
}
```

### GET /offerings/:id/attendance/summary

| | |
|---|---|
| Name | Attendance summary |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/attendance/summary` |
| Access | INSTRUCTOR (own) or ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance summary retrieved successfully",
  "data": [
    {
      "enrollmentId": "99999999-9999-4999-8999-999999999991",
      "studentId": "2026-BSC-CSE-0001",
      "firstName": "Aisha",
      "lastName": "Karim",
      "sessionsHeld": 10,
      "attended": 9,
      "counted": 10,
      "rate": 0.9,
      "examEligible": true,
      "missedDates": [
        "2026-09-01"
      ]
    }
  ]
}
```

### DELETE /offerings/:id/attendance

| | |
|---|---|
| Name | Delete attendance session |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/attendance` |
| Access | ADMIN |
| Success | **200** |
| Query | `date=2026-09-06` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance session deleted successfully",
  "data": {
    "date": "2026-09-06",
    "removed": 12
  }
}
```

### POST /offerings/:id/exams

| | |
|---|---|
| Name | Create exam |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/exams` |
| Access | INSTRUCTOR (own) or ADMIN |
| Success | **201** |
| Notes | type: QUIZ | ASSIGNMENT | PRESENTATION | MIDTERM | FINAL. Weights across exams cannot exceed 100. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "type": "MIDTERM",
  "title": "Midterm 1",
  "totalMarks": "50",
  "weight": "30",
  "examDate": "2026-10-01"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Exam created successfully",
  "data": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "offeringId": "55555555-5555-4555-8555-555555555551",
    "type": "MIDTERM",
    "title": "Midterm 1",
    "totalMarks": "50.00",
    "weight": "30.00",
    "examDate": "2026-10-01T00:00:00.000Z",
    "isPublished": false,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### GET /offerings/:id/exams

| | |
|---|---|
| Name | List exams for offering |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/exams` |
| Access | Auth (students see published only) |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exams retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": {
    "weightRemaining": "70.00",
    "exams": [
      {
        "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        "offeringId": "55555555-5555-4555-8555-555555555551",
        "type": "MIDTERM",
        "title": "Midterm 1",
        "totalMarks": "50.00",
        "weight": "30.00",
        "examDate": "2026-10-01T00:00:00.000Z",
        "isPublished": false,
        "createdAt": "2026-09-06T09:00:00.000Z",
        "updatedAt": "2026-09-06T09:00:00.000Z"
      }
    ]
  }
}
```

### GET /offerings/:id/grades

| | |
|---|---|
| Name | Grade preview |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/grades` |
| Access | INSTRUCTOR (own) or ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Grade preview retrieved successfully",
  "data": {
    "offering": {
      "id": "55555555-5555-4555-8555-555555555551",
      "section": "A",
      "course": {
        "code": "CSE-2101",
        "title": "Data Structures"
      },
      "semester": {
        "id": "44444444-4444-4444-8444-444444444441",
        "name": "Fall 2026",
        "status": "GRADING"
      }
    },
    "students": [
      {
        "enrollmentId": "99999999-9999-4999-8999-999999999991",
        "studentId": "2026-BSC-CSE-0001",
        "firstName": "Aisha",
        "lastName": "Karim",
        "totalMarks": "82.00",
        "examEligible": true,
        "missingMarks": false,
        "currentLetterGrade": null,
        "currentGradePoint": null,
        "computedLetterGrade": "A",
        "computedGradePoint": "4.00"
      }
    ]
  }
}
```

### POST /offerings/:id/grades

| | |
|---|---|
| Name | Submit final grades |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/offerings/55555555-5555-4555-8555-555555555551/grades` |
| Access | INSTRUCTOR (own) or ADMIN |
| Success | **200** |
| Notes | Semester must be GRADING. letterGrade: A_PLUS | A | A_MINUS | B_PLUS | B | B_MINUS | C_PLUS | C | D | F | I | W. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "grades": [
    {
      "enrollmentId": "99999999-9999-4999-8999-999999999991",
      "letterGrade": "A",
      "remarks": "Excellent"
    }
  ]
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Final grades submitted successfully",
  "data": {
    "graded": 1
  }
}
```


## 13. Enrollments

### POST /enrollments

| | |
|---|---|
| Name | Self-register |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/enrollments` |
| Access | STUDENT |
| Success | **201** |
| Notes | 400 window/prereq/clash/credit cap; 402 unpaid invoice; 409 section full. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "offeringId": "55555555-5555-4555-8555-555555555551"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registered for CSE-2101",
  "data": {
    "id": "99999999-9999-4999-8999-999999999991",
    "status": "ENROLLED",
    "course": {
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0"
    },
    "section": "A",
    "schedule": [
      {
        "dayOfWeek": "SUNDAY",
        "startTime": "09:00",
        "endTime": "10:30"
      }
    ],
    "semesterCredits": {
      "current": 12,
      "limit": 15
    }
  }
}
```

### POST /enrollments/admin

| | |
|---|---|
| Name | Admin register student |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/enrollments/admin` |
| Access | ADMIN |
| Success | **201** |
| Notes | `studentId` is the profile UUID. skipChecks: PREREQUISITE | CREDIT_LIMIT | SCHEDULE_CONFLICT | FINANCIAL_HOLD. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "studentId": "88888888-8888-4888-8888-888888888881",
  "offeringId": "55555555-5555-4555-8555-555555555551",
  "skipChecks": [
    "PREREQUISITE"
  ]
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Registered for CSE-2101",
  "data": {
    "id": "99999999-9999-4999-8999-999999999991",
    "status": "ENROLLED",
    "course": {
      "code": "CSE-2101",
      "title": "Data Structures",
      "credits": "3.0"
    },
    "section": "A",
    "schedule": [
      {
        "dayOfWeek": "SUNDAY",
        "startTime": "09:00",
        "endTime": "10:30"
      }
    ],
    "semesterCredits": {
      "current": 12,
      "limit": 15
    }
  }
}
```

### GET /enrollments/my-courses

| | |
|---|---|
| Name | My courses |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/enrollments/my-courses` |
| Access | STUDENT |
| Success | **200** |
| Query | `semesterId?, status?` |
| Notes | Enrollment status: ENROLLED | DROPPED | COMPLETED | FAILED. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Enrollments retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "99999999-9999-4999-8999-999999999991",
      "studentId": "88888888-8888-4888-8888-888888888881",
      "offeringId": "55555555-5555-4555-8555-555555555551",
      "status": "ENROLLED",
      "enrolledAt": "2026-09-06T09:00:00.000Z",
      "droppedAt": null,
      "offering": {
        "section": "A",
        "semesterId": "44444444-4444-4444-8444-444444444441",
        "course": {
          "id": "33333333-3333-4333-8333-333333333302",
          "code": "CSE-2101",
          "title": "Data Structures",
          "credits": "3.0"
        },
        "semester": {
          "id": "44444444-4444-4444-8444-444444444441",
          "name": "Fall 2026",
          "status": "REGISTRATION"
        }
      }
    }
  ]
}
```

### GET /enrollments/available-courses

| | |
|---|---|
| Name | Available courses |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/enrollments/available-courses` |
| Access | STUDENT |
| Success | **200** |
| Query | `eligibleOnly=true?` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Available courses retrieved successfully",
  "data": {
    "semester": {
      "id": "44444444-4444-4444-8444-444444444441",
      "name": "Fall 2026",
      "status": "REGISTRATION"
    },
    "data": [
      {
        "offeringId": "55555555-5555-4555-8555-555555555551",
        "section": "A",
        "seatsRemaining": 28,
        "course": {
          "id": "33333333-3333-4333-8333-333333333302",
          "code": "CSE-2101",
          "title": "Data Structures",
          "credits": "3.0"
        },
        "schedule": [
          {
            "dayOfWeek": "SUNDAY",
            "startTime": "09:00",
            "endTime": "10:30"
          }
        ],
        "eligible": true,
        "blockedBy": []
      },
      {
        "offeringId": "55555555-5555-4555-8555-555555555552",
        "section": "A",
        "seatsRemaining": 10,
        "course": {
          "id": "33333333-3333-4333-8333-333333333302",
          "code": "CSE-3301",
          "title": "Algorithms",
          "credits": "3.0"
        },
        "schedule": [
          {
            "dayOfWeek": "MONDAY",
            "startTime": "09:00",
            "endTime": "10:30"
          }
        ],
        "eligible": false,
        "blockedBy": [
          {
            "reason": "PREREQUISITE",
            "detail": "CSE-2101 not completed"
          }
        ]
      }
    ]
  }
}
```

### GET /enrollments

| | |
|---|---|
| Name | Admin list enrollments |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/enrollments` |
| Access | ADMIN |
| Success | **200** |
| Query | `studentId, offeringId, semesterId, status, page, limit` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Enrollments retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "99999999-9999-4999-8999-999999999991",
      "studentId": "88888888-8888-4888-8888-888888888881",
      "offeringId": "55555555-5555-4555-8555-555555555551",
      "status": "ENROLLED",
      "enrolledAt": "2026-09-06T09:00:00.000Z",
      "droppedAt": null,
      "offering": {
        "section": "A",
        "semesterId": "44444444-4444-4444-8444-444444444441",
        "course": {
          "id": "33333333-3333-4333-8333-333333333302",
          "code": "CSE-2101",
          "title": "Data Structures",
          "credits": "3.0"
        },
        "semester": {
          "id": "44444444-4444-4444-8444-444444444441",
          "name": "Fall 2026",
          "status": "REGISTRATION"
        }
      },
      "student": {
        "id": "88888888-8888-4888-8888-888888888881",
        "studentId": "2026-BSC-CSE-0001",
        "firstName": "Aisha",
        "lastName": "Karim",
        "email": "student01@bidyapith.edu"
      }
    }
  ]
}
```

### DELETE /enrollments/:id

| | |
|---|---|
| Name | Drop course |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/enrollments/99999999-9999-4999-8999-999999999991` |
| Access | STUDENT (own enrollment) |
| Success | **200** |
| Notes | Must be before dropDeadline. After deadline → 409. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Course dropped successfully",
  "data": {
    "id": "99999999-9999-4999-8999-999999999991",
    "status": "DROPPED",
    "droppedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### PATCH /enrollments/:id/grade

| | |
|---|---|
| Name | Patch one letter grade |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/enrollments/99999999-9999-4999-8999-999999999991/grade` |
| Access | INSTRUCTOR (owns offering) or ADMIN |
| Success | **200** |
| Notes | Semester must be GRADING. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "letterGrade": "A_MINUS"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Grade updated successfully",
  "data": {
    "id": "99999999-9999-4999-8999-999999999991",
    "letterGrade": "A_MINUS",
    "gradePoint": "3.70",
    "gradedAt": "2026-09-06T09:00:00.000Z"
  }
}
```


## 14. Exams (by exam id)

### PATCH /exams/:id

| | |
|---|---|
| Name | Update exam |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/exams/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` |
| Access | INSTRUCTOR (owns exam offering) |
| Success | **200** |
| Notes | Cannot change totalMarks/weight after results exist (409). |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "title": "Midterm 1 (updated)",
  "examDate": "2026-10-05"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exam updated successfully",
  "data": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "offeringId": "55555555-5555-4555-8555-555555555551",
    "type": "MIDTERM",
    "title": "Midterm 1 (updated)",
    "totalMarks": "50.00",
    "weight": "30.00",
    "examDate": "2026-10-01T00:00:00.000Z",
    "isPublished": false,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### DELETE /exams/:id

| | |
|---|---|
| Name | Delete exam |
| Method | `DELETE` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/exams/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` |
| Access | INSTRUCTOR (owns exam offering) |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exam deleted successfully",
  "data": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "offeringId": "55555555-5555-4555-8555-555555555551",
    "type": "MIDTERM",
    "title": "Midterm 1",
    "totalMarks": "50.00",
    "weight": "30.00",
    "examDate": "2026-10-01T00:00:00.000Z",
    "isPublished": false,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### PATCH /exams/:id/publish

| | |
|---|---|
| Name | Publish / unpublish exam |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/exams/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/publish` |
| Access | INSTRUCTOR (owns exam offering) |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "isPublished": true
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exam published successfully",
  "data": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "offeringId": "55555555-5555-4555-8555-555555555551",
    "type": "MIDTERM",
    "title": "Midterm 1",
    "totalMarks": "50.00",
    "weight": "30.00",
    "examDate": "2026-10-01T00:00:00.000Z",
    "isPublished": true,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### POST /exams/:id/results

| | |
|---|---|
| Name | Enter exam marks |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/exams/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/results` |
| Access | INSTRUCTOR (owns exam offering) |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "results": [
    {
      "enrollmentId": "99999999-9999-4999-8999-999999999991",
      "marksObtained": "42",
      "remarks": "Good"
    }
  ]
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exam results saved successfully",
  "data": {
    "created": 1,
    "updated": 0,
    "classAverage": "42.00",
    "highestMark": "42.00",
    "resultCount": 1
  }
}
```

### GET /exams/:id/results

| | |
|---|---|
| Name | List exam results |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/exams/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/results` |
| Access | INSTRUCTOR (own) or ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Exam results retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      "enrollmentId": "99999999-9999-4999-8999-999999999991",
      "marksObtained": "42.00",
      "remarks": "Good",
      "examEligible": true,
      "studentId": "2026-BSC-CSE-0001",
      "firstName": "Aisha",
      "lastName": "Karim"
    }
  ]
}
```


## 15. Invoices

### GET /invoices/my

| | |
|---|---|
| Name | My invoices |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/invoices/my` |
| Access | STUDENT |
| Success | **200** |
| Query | `status?, semesterId?` |
| Notes | status: UNPAID | PARTIAL | PAID | WAIVED | CANCELLED. type: TUITION | REGISTRATION | EXAM_FEE | LATE_FEE | LAB_FEE. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Invoices retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      "invoiceNumber": "INV-2026-0001",
      "studentId": "88888888-8888-4888-8888-888888888881",
      "semesterId": "44444444-4444-4444-8444-444444444441",
      "type": "TUITION",
      "status": "UNPAID",
      "totalAmount": "10500.00",
      "paidAmount": "0.00",
      "outstanding": "10500.00",
      "currency": "BDT",
      "dueDate": "2026-09-30T00:00:00.000Z",
      "paidAt": null,
      "notes": null,
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  ]
}
```

### GET /invoices/summary

| | |
|---|---|
| Name | Invoice summary |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/invoices/summary` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Invoice summary retrieved successfully",
  "data": {
    "collected": "250000.00",
    "outstanding": "48000.00",
    "overdue": "10500.00"
  }
}
```

### GET /invoices

| | |
|---|---|
| Name | Admin list invoices |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/invoices` |
| Access | ADMIN |
| Success | **200** |
| Query | `status, semesterId, studentId, type, search` |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Invoices retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      "invoiceNumber": "INV-2026-0001",
      "studentId": "88888888-8888-4888-8888-888888888881",
      "semesterId": "44444444-4444-4444-8444-444444444441",
      "type": "TUITION",
      "status": "UNPAID",
      "totalAmount": "10500.00",
      "paidAmount": "0.00",
      "outstanding": "10500.00",
      "currency": "BDT",
      "dueDate": "2026-09-30T00:00:00.000Z",
      "paidAt": null,
      "notes": null,
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "student": {
        "studentId": "2026-BSC-CSE-0001",
        "user": {
          "firstName": "Aisha",
          "lastName": "Karim",
          "email": "student01@bidyapith.edu"
        }
      },
      "semester": {
        "name": "Fall 2026"
      }
    }
  ]
}
```

### POST /invoices/generate

| | |
|---|---|
| Name | Generate registration invoices |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/invoices/generate` |
| Access | ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "semesterId": "44444444-4444-4444-8444-444444444441"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Registration invoices generated",
  "data": {
    "created": 18,
    "skipped": 2,
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "semester": "Fall 2026"
  }
}
```

### POST /invoices

| | |
|---|---|
| Name | Create manual invoice |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/invoices` |
| Access | ADMIN |
| Success | **201** |
| Notes | Manual types only: EXAM_FEE | LATE_FEE | LAB_FEE. dueDate must be in the future. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "studentId": "88888888-8888-4888-8888-888888888881",
  "semesterId": "44444444-4444-4444-8444-444444444441",
  "type": "LAB_FEE",
  "totalAmount": "500",
  "dueDate": "2026-10-01",
  "notes": "Lab materials"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Invoice issued successfully",
  "data": {
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    "invoiceNumber": "INV-2026-0001",
    "studentId": "88888888-8888-4888-8888-888888888881",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "type": "LAB_FEE",
    "status": "UNPAID",
    "totalAmount": "500.00",
    "paidAmount": "0.00",
    "outstanding": "500.00",
    "currency": "BDT",
    "dueDate": "2026-09-30T00:00:00.000Z",
    "paidAt": null,
    "notes": "Lab materials",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### GET /invoices/:id

| | |
|---|---|
| Name | Get invoice |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/invoices/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1` |
| Access | STUDENT (own) or ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Invoice retrieved successfully",
  "data": {
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    "invoiceNumber": "INV-2026-0001",
    "studentId": "88888888-8888-4888-8888-888888888881",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "type": "TUITION",
    "status": "UNPAID",
    "totalAmount": "10500.00",
    "paidAmount": "0.00",
    "outstanding": "10500.00",
    "currency": "BDT",
    "dueDate": "2026-09-30T00:00:00.000Z",
    "paidAt": null,
    "notes": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### PATCH /invoices/:id/waive

| | |
|---|---|
| Name | Waive invoice |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/invoices/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/waive` |
| Access | ADMIN |
| Success | **200** |
| Notes | `reason` min 10 characters. Only UNPAID or PARTIAL. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "reason": "Scholarship waiver for Fall 2026"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Invoice waived successfully",
  "data": {
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    "invoiceNumber": "INV-2026-0001",
    "studentId": "88888888-8888-4888-8888-888888888881",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "type": "TUITION",
    "status": "WAIVED",
    "totalAmount": "10500.00",
    "paidAmount": "0.00",
    "outstanding": "10500.00",
    "currency": "BDT",
    "dueDate": "2026-09-30T00:00:00.000Z",
    "paidAt": null,
    "notes": "Scholarship waiver for Fall 2026",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### PATCH /invoices/:id/cancel

| | |
|---|---|
| Name | Cancel invoice |
| Method | `PATCH` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/invoices/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/cancel` |
| Access | ADMIN |
| Success | **200** |
| Notes | Unpaid only. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Invoice cancelled successfully",
  "data": {
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    "invoiceNumber": "INV-2026-0001",
    "studentId": "88888888-8888-4888-8888-888888888881",
    "semesterId": "44444444-4444-4444-8444-444444444441",
    "type": "TUITION",
    "status": "CANCELLED",
    "totalAmount": "10500.00",
    "paidAmount": "0.00",
    "outstanding": "10500.00",
    "currency": "BDT",
    "dueDate": "2026-09-30T00:00:00.000Z",
    "paidAt": null,
    "notes": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```


## 16. Payments

### POST /payments/initiate

| | |
|---|---|
| Name | Initiate checkout |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/payments/initiate` |
| Access | STUDENT |
| Success | **200** |
| Notes | Amount is taken from the invoice, never from the client. SSLCommerz is a stub (502 / not implemented). |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "invoiceId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Checkout session created",
  "data": {
    "transactionRef": "PAY-1757149200000-a1b2c3d4",
    "redirectUrl": "https://checkout.stripe.com/c/pay/cs_test_example",
    "amount": "10500.00",
    "currency": "BDT"
  }
}
```

### GET /payments/verify/:transactionRef

| | |
|---|---|
| Name | Verify payment by transactionRef |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/payments/verify/PAY-1757149200000-a1b2c3d4` |
| Access | STUDENT |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payment status retrieved successfully",
  "data": {
    "payment": {
      "id": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      "invoiceId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      "transactionRef": "PAY-1757149200000-a1b2c3d4",
      "gateway": "STRIPE",
      "status": "INITIATED",
      "amount": "10500.00",
      "currency": "BDT",
      "gatewayTransactionId": null,
      "gatewaySessionId": "cs_test_example",
      "failureReason": null,
      "initiatedAt": "2026-09-06T09:00:00.000Z",
      "paidAt": null,
      "refundedAt": null,
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    },
    "invoice": {
      "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      "invoiceNumber": "INV-2026-0001",
      "status": "UNPAID",
      "totalAmount": "10500.00",
      "paidAmount": "0.00",
      "currency": "BDT"
    }
  }
}
```

### GET /payments/my-history

| | |
|---|---|
| Name | My payment history |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/payments/my-history` |
| Access | STUDENT |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payments retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      "invoiceId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      "transactionRef": "PAY-1757149200000-a1b2c3d4",
      "gateway": "STRIPE",
      "status": "INITIATED",
      "amount": "10500.00",
      "currency": "BDT",
      "gatewayTransactionId": null,
      "gatewaySessionId": "cs_test_example",
      "failureReason": null,
      "initiatedAt": "2026-09-06T09:00:00.000Z",
      "paidAt": null,
      "refundedAt": null,
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z",
      "invoice": {
        "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        "invoiceNumber": "INV-2026-0001",
        "status": "UNPAID"
      }
    }
  ]
}
```

### GET /payments

| | |
|---|---|
| Name | Admin list payments |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/payments` |
| Access | ADMIN |
| Success | **200** |
| Query | `status, gateway, invoiceId` |
| Notes | Payment status: INITIATED | SUCCESS | FAILED | CANCELLED | REFUNDED. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payments retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPage": 1
  },
  "data": [
    {
      "id": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      "invoiceId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      "transactionRef": "PAY-1757149200000-a1b2c3d4",
      "gateway": "STRIPE",
      "status": "INITIATED",
      "amount": "10500.00",
      "currency": "BDT",
      "gatewayTransactionId": null,
      "gatewaySessionId": "cs_test_example",
      "failureReason": null,
      "initiatedAt": "2026-09-06T09:00:00.000Z",
      "paidAt": null,
      "refundedAt": null,
      "createdAt": "2026-09-06T09:00:00.000Z",
      "updatedAt": "2026-09-06T09:00:00.000Z"
    }
  ]
}
```

### GET /payments/:id

| | |
|---|---|
| Name | Get payment |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/payments/cccccccc-cccc-4ccc-8ccc-ccccccccccc1` |
| Access | STUDENT (own) or ADMIN |
| Success | **200** |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payment retrieved successfully",
  "data": {
    "id": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    "invoiceId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    "transactionRef": "PAY-1757149200000-a1b2c3d4",
    "gateway": "STRIPE",
    "status": "INITIATED",
    "amount": "10500.00",
    "currency": "BDT",
    "gatewayTransactionId": null,
    "gatewaySessionId": "cs_test_example",
    "failureReason": null,
    "initiatedAt": "2026-09-06T09:00:00.000Z",
    "paidAt": null,
    "refundedAt": null,
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### POST /payments/:id/refund

| | |
|---|---|
| Name | Refund payment |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/payments/cccccccc-cccc-4ccc-8ccc-ccccccccccc1/refund` |
| Access | ADMIN |
| Success | **200** |
| Notes | `reason` min 10 characters. Only SUCCESS payments. |

**Headers**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example-access-token
Content-Type: application/json
```

**Request body**

```json
{
  "reason": "Duplicate payment by student"
}
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payment refunded successfully",
  "data": {
    "id": "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    "invoiceId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    "transactionRef": "PAY-1757149200000-a1b2c3d4",
    "gateway": "STRIPE",
    "status": "REFUNDED",
    "amount": "10500.00",
    "currency": "BDT",
    "gatewayTransactionId": null,
    "gatewaySessionId": "cs_test_example",
    "failureReason": null,
    "initiatedAt": "2026-09-06T09:00:00.000Z",
    "paidAt": null,
    "refundedAt": "2026-09-06T09:00:00.000Z",
    "createdAt": "2026-09-06T09:00:00.000Z",
    "updatedAt": "2026-09-06T09:00:00.000Z"
  }
}
```

### GET /payments/expire-stale

| | |
|---|---|
| Name | Expire stale payments (cron) |
| Method | `GET` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/payments/expire-stale` |
| Access | Bearer $CRON_SECRET (not JWT) |
| Success | **200** |

**Headers**

```
Authorization: Bearer <CRON_SECRET>
```

**Request body**

_No body._

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stale payments expired",
  "data": {
    "cancelled": 3
  }
}
```

### POST /payments/webhook

| | |
|---|---|
| Name | Stripe webhook |
| Method | `POST` |
| URL | `https://bidyapith-backend.onrender.com/api/v1/payments/webhook` |
| Access | Public + stripe-signature |
| Success | **200** |
| Notes | Mounted before express.json. Missing/invalid signature → 400. Idempotent via unique gatewayTransactionId. |

**Headers**

```
Content-Type: application/json
stripe-signature: t=...,v1=...
```

**Request body**

```
{ raw Stripe event JSON — do not re-serialize }
```

**Response body**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Webhook received",
  "data": {
    "handled": "replay"
  }
}
```


## 17. Negative cases SQA should hit first

Run these before mutating seed data.

| Case | Request | Expect |
|---|---|---|
| No token | `GET /api/v1/users/me` | **401** |
| Student hits admin | student token + `GET /api/v1/admin/users` | **403** |
| Bad email | `POST /auth/register` `{ "email": "not-an-email" }` | **422** + `errors[].path` |
| Unknown route | `GET /api/v1/does-not-exist` | **404** `Route GET /api/v1/does-not-exist not found` |
| Overdue student enroll | `student02` + `POST /enrollments` | **402** |
| Full section | two students on `oneSeatOfferingId` | one **201**, one **409** |
| Login rate limit | 6 failed logins in 15 min | **429** |

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Authentication required"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "message": "You are not allowed to perform this action"
}
```

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation error",
  "errors": [
    {
      "path": "email",
      "message": "Invalid email format"
    }
  ]
}
```


## 18. What is not an HTTP API

- Audit log and notification rows are written inside services. There is no REST list for them.
- `GET /admin/dashboard-stats` is not exposed.
- SSLCommerz checkout is not implemented.
- Unit tests (`npm test`) cover GPA, money, attendance rate, prereq cycles, and clashes — not HTTP.
