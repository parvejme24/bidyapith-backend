# API reference

Base path: `/api/v1`. Health is `GET /health` on the origin, not under `/api/v1`.

Success: `{ success, statusCode, message, data, meta? }`. Error: `{ success: false, statusCode, message, errors?: [{ path, message }] }`.

Access: `Public` · `Auth` (any logged-in user) · `STUDENT` / `INSTRUCTOR` / `ADMIN` · `Own` means role plus `ownership` middleware.

## Auth (9)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Create a student account |
| POST | `/auth/login` | Public | Email/password; sets refresh cookie |
| POST | `/auth/google` | Public | Google ID-token login |
| POST | `/auth/refresh-token` | Cookie | Rotate access + refresh |
| POST | `/auth/logout` | Auth | Revoke refresh family |
| POST | `/auth/change-password` | Auth | Replace password; revoke other sessions |
| POST | `/auth/forgot-password` | Public | Send reset mail |
| POST | `/auth/reset-password` | Public | Consume reset token |
| POST | `/auth/verify-email` | Public | Consume email-verify token |

## Users (10)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/users/me` | Auth | Current user profile |
| PATCH | `/users/me` | Auth | Name / phone |
| POST | `/users/me/avatar` | Auth | Upload avatar |
| DELETE | `/users/me/avatar` | Auth | Remove avatar |
| POST | `/admin/users` | ADMIN | Create instructor or admin staff |
| GET | `/admin/users` | ADMIN | Paginated user search |
| GET | `/admin/users/:id` | ADMIN | User by id |
| PATCH | `/admin/users/:id/role` | ADMIN | Change role |
| PATCH | `/admin/users/:id/status` | ADMIN | Activate / block |
| DELETE | `/admin/users/:id` | ADMIN | Soft-delete user |

## Students (10)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/students/me` | STUDENT | Own academic profile |
| PATCH | `/students/me` | STUDENT | Guardian / address |
| GET | `/students` | ADMIN, INSTRUCTOR | Paginated students |
| GET | `/students/:id` | ADMIN, INSTRUCTOR | Student by id |
| PATCH | `/students/:id` | ADMIN | Admin profile update |
| GET | `/students/me/attendance` | STUDENT | Own attendance + eligibility |
| GET | `/students/me/exam-results` | STUDENT | Own exam marks |
| GET | `/students/me/results` | STUDENT | Published semester GPAs |
| GET | `/students/me/transcript` | STUDENT | Full transcript (materialized) |
| GET | `/students/:id/transcript` | ADMIN | Transcript by student id |

## Instructors (5)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/instructors/me` | INSTRUCTOR | Own staff profile |
| PATCH | `/instructors/me` | INSTRUCTOR | Specialization / contact |
| GET | `/instructors` | Auth | Paginated instructors |
| GET | `/instructors/:id` | Auth | Instructor by id |
| PATCH | `/instructors/:id` | ADMIN | Admin staff update |

## Departments (5)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/departments` | ADMIN | Create department |
| GET | `/departments` | Auth | List departments |
| GET | `/departments/:id` | Auth | Department by id |
| PATCH | `/departments/:id` | ADMIN | Update department |
| DELETE | `/departments/:id` | ADMIN | Soft-delete department |

## Programs (9)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/programs` | ADMIN | Create program |
| GET | `/programs` | Auth | List programs |
| GET | `/programs/:id` | Auth | Program by id |
| PATCH | `/programs/:id` | ADMIN | Update program |
| DELETE | `/programs/:id` | ADMIN | Soft-delete program |
| GET | `/programs/:id/curriculum` | Auth | Courses on the program |
| POST | `/programs/:id/courses` | ADMIN | Attach a course |
| PATCH | `/programs/:id/courses/:courseId` | ADMIN | Curriculum row |
| DELETE | `/programs/:id/courses/:courseId` | ADMIN | Detach a course |

## Courses (5)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/courses` | ADMIN | Create course |
| GET | `/courses` | Auth | List courses |
| GET | `/courses/:id` | Auth | Course by id |
| PATCH | `/courses/:id` | ADMIN | Update course |
| DELETE | `/courses/:id` | ADMIN | Soft-delete course |

## Prerequisites (4)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/courses/:id/prerequisites` | ADMIN | Add prerequisite (cycle-checked) |
| GET | `/courses/:id/prerequisites` | Auth | Prerequisite tree |
| GET | `/courses/:id/dependents` | Auth | Courses that require this one |
| DELETE | `/courses/:id/prerequisites/:prerequisiteId` | ADMIN | Remove edge |

## Semesters (9)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/semesters` | ADMIN | Create semester |
| GET | `/semesters` | Auth | List semesters |
| GET | `/semesters/current` | Auth | REGISTRATION, else ONGOING |
| GET | `/semesters/:id` | Auth | Semester by id |
| PATCH | `/semesters/:id` | ADMIN | Edit dates while UPCOMING/REGISTRATION |
| PATCH | `/semesters/:id/status` | ADMIN | Legal status transition |
| DELETE | `/semesters/:id` | ADMIN | Soft-delete semester |
| GET | `/semesters/:id/results/readiness` | ADMIN | Publish checklist |
| POST | `/semesters/:id/publish-results` | ADMIN | Materialize GPA / CGPA |

## Offerings (19)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/offerings` | ADMIN | Open a section |
| GET | `/offerings` | Auth | List offerings |
| GET | `/offerings/my-teaching` | INSTRUCTOR | Sections this instructor teaches |
| GET | `/offerings/:id` | Auth | Offering + schedule |
| PATCH | `/offerings/:id` | ADMIN | Capacity / room |
| PATCH | `/offerings/:id/instructor` | ADMIN | Assign instructor |
| PATCH | `/offerings/:id/status` | ADMIN | OPEN / CLOSED / … |
| POST | `/offerings/:id/schedules` | ADMIN | Add weekly slot |
| DELETE | `/offerings/:id/schedules/:scheduleId` | ADMIN | Remove slot |
| DELETE | `/offerings/:id` | ADMIN | Soft-delete offering |
| GET | `/offerings/:id/students` | INSTRUCTOR, ADMIN | Roster (`Own` offering) |
| GET | `/offerings/:id/attendance` | INSTRUCTOR, ADMIN | Session by date |
| POST | `/offerings/:id/attendance` | INSTRUCTOR, ADMIN | Mark session |
| GET | `/offerings/:id/attendance/summary` | INSTRUCTOR, ADMIN | Rates + eligibility |
| DELETE | `/offerings/:id/attendance` | ADMIN | Delete a session |
| POST | `/offerings/:id/exams` | INSTRUCTOR, ADMIN | Create exam |
| GET | `/offerings/:id/exams` | Auth | Exams for the section |
| GET | `/offerings/:id/grades` | INSTRUCTOR, ADMIN | Preview computed grades |
| POST | `/offerings/:id/grades` | INSTRUCTOR, ADMIN | Submit letter grades |

## Enrollments (7)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/enrollments` | STUDENT | Self-register (8 checks, last-seat safe) |
| POST | `/enrollments/admin` | ADMIN | Register a student; optional skipped checks |
| GET | `/enrollments/my-courses` | STUDENT | Own enrollments |
| GET | `/enrollments/available-courses` | STUDENT | Open sections + eligibility flags |
| GET | `/enrollments` | ADMIN | All enrollments |
| DELETE | `/enrollments/:id` | STUDENT, Own | Drop before deadline |
| PATCH | `/enrollments/:id/grade` | INSTRUCTOR, ADMIN | Patch one grade |

## Exams (5)

| Method | Path | Access | Description |
|---|---|---|---|
| PATCH | `/exams/:id` | INSTRUCTOR, Own | Update exam |
| DELETE | `/exams/:id` | INSTRUCTOR, Own | Soft-delete exam |
| PATCH | `/exams/:id/publish` | INSTRUCTOR, Own | Publish exam |
| POST | `/exams/:id/results` | INSTRUCTOR, Own | Enter marks |
| GET | `/exams/:id/results` | INSTRUCTOR, ADMIN | List marks |

## Invoices (8)

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/invoices/my` | STUDENT | Own invoices |
| GET | `/invoices/summary` | ADMIN | Totals by status |
| GET | `/invoices` | ADMIN | Paginated invoices |
| POST | `/invoices/generate` | ADMIN | Bulk semester invoices |
| POST | `/invoices` | ADMIN | Create one invoice |
| GET | `/invoices/:id` | STUDENT, ADMIN, Own | Invoice detail |
| PATCH | `/invoices/:id/waive` | ADMIN | Waive remaining |
| PATCH | `/invoices/:id/cancel` | ADMIN | Cancel unpaid |

## Payments (7)

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/payments/initiate` | STUDENT | Start Stripe session; amount from invoice |
| GET | `/payments/verify/:transactionRef` | STUDENT | Poll our payment row |
| GET | `/payments/my-history` | STUDENT | Own payments |
| GET | `/payments` | ADMIN | All payments |
| GET | `/payments/:id` | STUDENT, ADMIN, Own | Payment detail |
| POST | `/payments/:id/refund` | ADMIN | Refund |
| POST | `/payments/webhook` | Public (raw body) | Stripe webhook; mounted before `express.json` |
