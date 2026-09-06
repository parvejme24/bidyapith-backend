# Bidyapith API — reference and testing

Base: `{origin}/api/v1`. Health is `{origin}/health` (not under `/api/v1`).

Local origin: `http://localhost:5001`.  
Live origin: [https://bidyapith-backend.onrender.com](https://bidyapith-backend.onrender.com).

117 HTTP endpoints. Audit logs and notifications are written by other modules; they have no REST surface.

## How to test everything

Use any one of these. They hit the same routes.

### 1. Postman (all requests + saved examples)

1. Import [postman-collection.json](postman-collection.json).
2. Collection variables: `origin` = `http://localhost:5001`, `baseUrl` = `{{origin}}/api/v1`.
3. Run **Auth → Login as admin** first. Collection variables `adminEmail` / `adminPassword` are `devparvejme@gmail.com` / `12345678`. The test script stores `adminToken` and `accessToken`. Then run instructor/student login if you need those roles.
4. After `npm run db:seed`, paste offering IDs from seed stdout into `fullOfferingId`, `prereqOfferingId`, `conflictOfferingId`, `oneSeatOfferingId`, `openOfferingId`.
5. Run the collection (or folder by folder) with **Run collection**.

### 2. Automated smoke script

```bash
npm run db:seed
npm run dev
# other terminal
bash scripts/verify-deployment.sh http://localhost:5001
# live
bash scripts/verify-deployment.sh https://bidyapith-backend.onrender.com
```

Checks health, admin login, `GET /users/me`, 401 without a token, student vs admin 403, validation envelope, current semester.

### 3. curl (below)

Cookie jar is required for refresh/logout.

```bash
export ORIGIN=https://bidyapith-backend.onrender.com
# local: export ORIGIN=http://localhost:5001
export API=$ORIGIN/api/v1
COOKIE=/tmp/bidya-cookies.txt
```

---

## Response contract

```jsonc
// success
{ "success": true, "statusCode": 200, "message": "...",
  "meta": { "page": 1, "limit": 10, "total": 47, "totalPage": 5 },
  "data": {} }

// error
{ "success": false, "statusCode": 422, "message": "Validation error",
  "errors": [{ "path": "email", "message": "Invalid email format" }] }
```

Lists are paginated: `?page=1&limit=10&sortBy=createdAt&sortOrder=desc`. Max `limit` is 100.

Auth header: `Authorization: Bearer <accessToken>`.

Refresh token is an **httpOnly** cookie named `refreshToken` (`SameSite=Strict`, `Secure` in production). Login, Google, refresh, and change-password set it.

Validation errors are **422**. Missing/invalid JWT is **401**. Wrong role is **403**. Soft-deleted or missing row is **404**.

---

## Demo accounts (after `npm run db:seed`)

| Role | Email | Password |
|---|---|---|
| Admin (Postman / live) | `devparvejme@gmail.com` | `12345678` |
| Admin (demo seed) | `admin@bidyapith.edu` | `Admin1234` |
| Instructor | `instructor01@bidyapith.edu` | `Teach1234` |
| Student | `student01@bidyapith.edu` | `Student1234` |

`student02@bidyapith.edu` / `Student1234` has an overdue invoice (enrollment **402**).  
`student03@bidyapith.edu` / `Student1234` is below 75% attendance (`examEligible: false`).

Password rule (register / change / reset): ≥8 characters, at least one letter and one number.  
Phone (optional): `+8801XXXXXXXXX` or `01XXXXXXXXX`.

---

## 0. Bootstrap

```bash
curl -sS "$ORIGIN/health"
# 200  { "success": true, "message": "OK", "data": { "service": "bidyapith-backend" } }

curl -sS "$ORIGIN/"
# 200  Bidyapith API is running
```

Login and keep tokens:

```bash
# Admin
ADMIN=$(curl -sS -c "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"email":"admin@bidyapith.edu","password":"Admin1234"}' \
  "$API/auth/login")
export ADMIN_TOKEN=$(python3 -c "import json,os; print(json.loads(os.environ['ADMIN'])['data']['accessToken'])" 2>/dev/null || python3 -c "import json; print(json.load(open('/dev/stdin'))['data']['accessToken'] )" <<<"$ADMIN")

# Instructor
INSTRUCTOR=$(curl -sS -c "$COOKIE-i" -H 'Content-Type: application/json' \
  -d '{"email":"instructor01@bidyapith.edu","password":"Teach1234"}' \
  "$API/auth/login")
export INSTRUCTOR_TOKEN=$(python3 -c "import json,sys; print(json.load(sys.stdin)['data']['accessToken'])" <<<"$INSTRUCTOR")

# Student
STUDENT=$(curl -sS -c "$COOKIE-s" -H 'Content-Type: application/json' \
  -d '{"email":"student01@bidyapith.edu","password":"Student1234"}' \
  "$API/auth/login")
export STUDENT_TOKEN=$(python3 -c "import json,sys; print(json.load(sys.stdin)['data']['accessToken'])" <<<"$STUDENT")
```

Simpler extract after you print the login JSON: copy `data.accessToken`.

```bash
H_ADMIN="Authorization: Bearer $ADMIN_TOKEN"
H_INST="Authorization: Bearer $INSTRUCTOR_TOKEN"
H_STU="Authorization: Bearer $STUDENT_TOKEN"
JSON='Content-Type: application/json'
```

Negative checks to run first:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$API/users/me"
# 401

curl -sS -o /dev/null -w '%{http_code}\n' -H "$H_STU" "$API/admin/users"
# 403

curl -sS -H "$JSON" -d '{"email":"not-an-email"}' "$API/auth/register"
# 422  errors[].path + errors[].message
```

---

## 1. Auth (9) — Public unless noted

| Method | Path | Access | Body / notes | Expect |
|---|---|---|---|---|
| POST | `/auth/register` | Public | `firstName`, `lastName`, `email`, `password`, `programId` (UUID), `phone?` | 201 |
| POST | `/auth/login` | Public | `email`, `password`. Rate limit **5 / 15 min** per IP+email. Sets cookie | 200 |
| POST | `/auth/google` | Public | `idToken`. Existing accounts only | 200 |
| POST | `/auth/refresh-token` | Cookie | Cookie `refreshToken`. Rotates cookie | 200 |
| POST | `/auth/logout` | Auth | Cookie + Bearer. Clears cookie | 200 |
| POST | `/auth/change-password` | Auth | `currentPassword`, `newPassword`. Rotates cookie | 200 |
| POST | `/auth/forgot-password` | Public | `email`. Rate limit **3 / hour**. Always 200 (no email leak) | 200 |
| POST | `/auth/reset-password` | Public | `token`, `newPassword` | 200 |
| POST | `/auth/verify-email` | Public | `token` | 200 |

```bash
# Register needs a real programId from GET /programs
curl -sS -H "$JSON" -d '{
  "firstName":"Test","lastName":"Student",
  "email":"test.student@example.com","password":"Student1234",
  "phone":"01712345678","programId":"'"$PROGRAM_ID"'"
}' "$API/auth/register"

curl -sS -b "$COOKIE" -c "$COOKIE" "$API/auth/refresh-token"

curl -sS -H "$H_ADMIN" -b "$COOKIE" "$API/auth/logout"

curl -sS -H "$H_ADMIN" -H "$JSON" \
  -d '{"currentPassword":"Admin1234","newPassword":"Admin1234"}' \
  "$API/auth/change-password"

curl -sS -H "$JSON" -d '{"email":"admin@bidyapith.edu"}' "$API/auth/forgot-password"

# Google / reset / verify need real tokens from Google or email
curl -sS -H "$JSON" -d '{"idToken":"<google-id-token>"}' "$API/auth/google"
curl -sS -H "$JSON" -d '{"token":"<reset-token>","newPassword":"Newpass1234"}' "$API/auth/reset-password"
curl -sS -H "$JSON" -d '{"token":"<verify-token>"}' "$API/auth/verify-email"
```

---

## 2. Users — self (4) Auth · admin (6) ADMIN

| Method | Path | Access | Body / query | Expect |
|---|---|---|---|---|
| GET | `/users/me` | Auth | — | 200 |
| PATCH | `/users/me` | Auth | ≥1 of `firstName`, `lastName`, `phone` | 200 |
| POST | `/users/me/avatar` | Auth | multipart field `avatar` (JPEG/PNG/WebP, ≤2 MB). Needs Cloudinary | 200 |
| DELETE | `/users/me/avatar` | Auth | — | 200 |
| POST | `/admin/users` | ADMIN | `firstName`, `lastName`, `email`, `role` (`INSTRUCTOR`\|`ADMIN`). Instructor also needs `departmentId`, `designation`, `joiningDate`. `phone?`, `specialization?` | 201 |
| GET | `/admin/users` | ADMIN | `page`, `limit`, `role`, `status`, `search` | 200 |
| GET | `/admin/users/:id` | ADMIN | user UUID | 200 |
| PATCH | `/admin/users/:id/role` | ADMIN | `{ "role": "INSTRUCTOR" }` | 200 |
| PATCH | `/admin/users/:id/status` | ADMIN | `{ "status": "ACTIVE" \| "BLOCKED" }` | 200 |
| DELETE | `/admin/users/:id` | ADMIN | soft-delete | 200 |

```bash
curl -sS -H "$H_ADMIN" "$API/users/me"
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{"phone":"01712345678"}' "$API/users/me"
curl -sS -H "$H_ADMIN" -F 'avatar=@/path/to/photo.jpg' "$API/users/me/avatar"
curl -sS -X DELETE -H "$H_ADMIN" "$API/users/me/avatar"

curl -sS -H "$H_ADMIN" "$API/admin/users?search=admin&page=1&limit=10"
curl -sS -H "$H_ADMIN" "$API/admin/users/$USER_ID"

curl -sS -H "$H_ADMIN" -H "$JSON" -d '{
  "firstName":"New","lastName":"Teacher","email":"teacher99@bidyapith.edu",
  "role":"INSTRUCTOR","departmentId":"'"$DEPARTMENT_ID"'",
  "designation":"LECTURER","joiningDate":"2026-01-01"
}' "$API/admin/users"
```

`designation`: `LECTURER`, `ASSISTANT_PROFESSOR`, `ASSOCIATE_PROFESSOR`, `PROFESSOR`.  
`status`: `ACTIVE`, `BLOCKED`, `PENDING_VERIFICATION`.

---

## 3. Students (10)

| Method | Path | Access | Body / query | Expect |
|---|---|---|---|---|
| GET | `/students/me` | STUDENT | — | 200 |
| PATCH | `/students/me` | STUDENT | ≥1 of `guardianName`, `guardianPhone`, `address` | 200 |
| GET | `/students` | ADMIN, INSTRUCTOR | `programId`, `batch`, `status`, `search`, pagination | 200 |
| GET | `/students/:id` | ADMIN, INSTRUCTOR | student-profile UUID | 200 |
| PATCH | `/students/:id` | ADMIN | ≥1 of `programId`, `batch`, `status` | 200 |
| GET | `/students/me/attendance` | STUDENT | rates + eligibility | 200 |
| GET | `/students/me/exam-results` | STUDENT | `offeringId?` | 200 |
| GET | `/students/me/results` | STUDENT | `semesterId?` | 200 |
| GET | `/students/me/transcript` | STUDENT | materialized `SemesterResult` | 200 |
| GET | `/students/:id/transcript` | ADMIN | student-profile UUID | 200 |

```bash
curl -sS -H "$H_STU" "$API/students/me"
curl -sS -H "$H_STU" -H "$JSON" -d '{"guardianName":"Rahim","guardianPhone":"01812345678","address":"Dhaka"}' "$API/students/me"
curl -sS -H "$H_ADMIN" "$API/students?page=1&limit=10"
curl -sS -H "$H_STU" "$API/students/me/attendance"
curl -sS -H "$H_STU" "$API/students/me/exam-results"
curl -sS -H "$H_STU" "$API/students/me/results"
curl -sS -H "$H_STU" "$API/students/me/transcript"
```

Student `status`: `ACTIVE`, `PROBATION`, `SUSPENDED`, `GRADUATED`, `WITHDRAWN`.

---

## 4. Instructors (5)

| Method | Path | Access | Body / query | Expect |
|---|---|---|---|---|
| GET | `/instructors/me` | INSTRUCTOR | — | 200 |
| PATCH | `/instructors/me` | INSTRUCTOR | `{ "specialization": "Databases" }` (empty → null) | 200 |
| GET | `/instructors` | Auth | `departmentId`, `designation`, `search`, pagination | 200 |
| GET | `/instructors/:id` | Auth | instructor-profile UUID | 200 |
| PATCH | `/instructors/:id` | ADMIN | ≥1 of `departmentId`, `designation`, `specialization` | 200 |

```bash
curl -sS -H "$H_INST" "$API/instructors/me"
curl -sS -H "$H_ADMIN" "$API/instructors?page=1&limit=10"
```

---

## 5. Departments (5)

| Method | Path | Access | Body | Expect |
|---|---|---|---|---|
| POST | `/departments` | ADMIN | `code` (2–6 letters), `name`, `contactEmail?` | 201 |
| GET | `/departments` | Auth | `search`, pagination | 200 |
| GET | `/departments/:id` | Auth | UUID | 200 |
| PATCH | `/departments/:id` | ADMIN | ≥1 of `code`, `name`, `contactEmail` | 200 |
| DELETE | `/departments/:id` | ADMIN | soft-delete | 200 |

```bash
curl -sS -H "$H_ADMIN" -H "$JSON" \
  -d '{"code":"CSE","name":"Computer Science","contactEmail":"cse@bidyapith.edu"}' \
  "$API/departments"
curl -sS -H "$H_ADMIN" "$API/departments"
```

Save `data.id` as `DEPARTMENT_ID`.

---

## 6. Programs (9)

| Method | Path | Access | Body | Expect |
|---|---|---|---|---|
| POST | `/programs` | ADMIN | `code`, `name`, `departmentId`, `degreeType`, `totalCredits` (30–200), `feePerCredit`, `durationYears?` (1–6), `minCreditsPerSemester?`, `maxCreditsPerSemester?`, `registrationFee?` | 201 |
| GET | `/programs` | Auth | `departmentId`, `degreeType`, pagination | 200 |
| GET | `/programs/:id` | Auth | UUID | 200 |
| PATCH | `/programs/:id` | ADMIN | any create field | 200 |
| DELETE | `/programs/:id` | ADMIN | soft-delete | 200 |
| GET | `/programs/:id/curriculum` | Auth | courses on the program | 200 |
| POST | `/programs/:id/courses` | ADMIN | `courseId`, `type?`, `recommendedSemester?` | 201 |
| PATCH | `/programs/:id/courses/:courseId` | ADMIN | `type?`, `recommendedSemester?` | 200 |
| DELETE | `/programs/:id/courses/:courseId` | ADMIN | detach | 200 |

`degreeType`: `BSC`, `BA`, `BBA`, `MSC`, `MA`, `MBA`.  
Curriculum `type`: `CORE`, `ELECTIVE`, `LAB`, `THESIS`.

```bash
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{
  "code":"BSC-CSE","name":"BSc in CSE","departmentId":"'"$DEPARTMENT_ID"'",
  "degreeType":"BSC","totalCredits":160,"feePerCredit":"3500","durationYears":4
}' "$API/programs"
curl -sS -H "$H_ADMIN" "$API/programs"
curl -sS -H "$H_ADMIN" "$API/programs/$PROGRAM_ID/curriculum"
curl -sS -H "$H_ADMIN" -H "$JSON" \
  -d '{"courseId":"'"$COURSE_ID"'","type":"CORE","recommendedSemester":1}' \
  "$API/programs/$PROGRAM_ID/courses"
```

---

## 7. Courses (5) + prerequisites (4)

| Method | Path | Access | Body | Expect |
|---|---|---|---|---|
| POST | `/courses` | ADMIN | `code` (`XXX-0000`), `title`, `credits` (0.5–6, steps of 0.5), `departmentId`, `description?`, `type?`, `level?` (1–4) | 201 |
| GET | `/courses` | Auth | `search`, `departmentId`, `type`, `level`, `minCredits`, `maxCredits` | 200 |
| GET | `/courses/:id` | Auth | UUID | 200 |
| PATCH | `/courses/:id` | ADMIN | any create field | 200 |
| DELETE | `/courses/:id` | ADMIN | soft-delete | 200 |
| POST | `/courses/:id/prerequisites` | ADMIN | `prerequisiteId`, `minGradePoint?` (0–4). Cycle-checked | 201 |
| GET | `/courses/:id/prerequisites` | Auth | tree | 200 |
| GET | `/courses/:id/dependents` | Auth | reverse edges | 200 |
| DELETE | `/courses/:id/prerequisites/:prerequisiteId` | ADMIN | remove edge | 200 |

```bash
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{
  "code":"CSE-1101","title":"Intro to Programming","credits":"3.0",
  "departmentId":"'"$DEPARTMENT_ID"'","type":"CORE","level":1
}' "$API/courses"

curl -sS -H "$H_ADMIN" -H "$JSON" \
  -d '{"prerequisiteId":"'"$PREREQ_COURSE_ID"'","minGradePoint":"2.00"}' \
  "$API/courses/$COURSE_ID/prerequisites"
curl -sS -H "$H_ADMIN" "$API/courses/$COURSE_ID/prerequisites"
curl -sS -H "$H_ADMIN" "$API/courses/$COURSE_ID/dependents"
```

---

## 8. Semesters (9)

| Method | Path | Access | Body | Expect |
|---|---|---|---|---|
| POST | `/semesters` | ADMIN | `term`, `year`, `registrationStart`, `registrationEnd`, `dropDeadline`, `classStartDate`, `classEndDate` (ISO, in that order) | 201 |
| GET | `/semesters` | Auth | `status`, `year`, pagination | 200 |
| GET | `/semesters/current` | Auth | REGISTRATION if open, else ONGOING | 200 |
| GET | `/semesters/:id` | Auth | UUID | 200 |
| PATCH | `/semesters/:id` | ADMIN | any date fields; only UPCOMING / REGISTRATION | 200 |
| PATCH | `/semesters/:id/status` | ADMIN | `{ "status": "ONGOING" }` legal transitions only | 200 |
| DELETE | `/semesters/:id` | ADMIN | soft-delete | 200 |
| GET | `/semesters/:id/results/readiness` | ADMIN | publish checklist | 200 |
| POST | `/semesters/:id/publish-results` | ADMIN | writes `SemesterResult` | 200 |

`term`: `SPRING`, `SUMMER`, `FALL`.  
`status`: `UPCOMING`, `REGISTRATION`, `ONGOING`, `GRADING`, `COMPLETED`, `CANCELLED`.

```bash
curl -sS -H "$H_ADMIN" "$API/semesters/current"
curl -sS -H "$H_ADMIN" "$API/semesters"
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{
  "term":"FALL","year":2027,
  "registrationStart":"2027-08-01T00:00:00.000Z",
  "registrationEnd":"2027-08-20T00:00:00.000Z",
  "dropDeadline":"2027-09-10T00:00:00.000Z",
  "classStartDate":"2027-08-21T00:00:00.000Z",
  "classEndDate":"2027-12-15T00:00:00.000Z"
}' "$API/semesters"
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{"status":"REGISTRATION"}' "$API/semesters/$SEMESTER_ID/status"
curl -sS -H "$H_ADMIN" "$API/semesters/$SEMESTER_ID/results/readiness"
```

---

## 9. Offerings (19)

| Method | Path | Access | Body / query | Expect |
|---|---|---|---|---|
| POST | `/offerings` | ADMIN | `courseId`, `semesterId`, `section` (A–Z), `capacity?` (1–300), `room?`, `instructorId?`, `schedules?` | 201 |
| GET | `/offerings` | Auth | `semesterId`, `courseId`, `instructorId`, `departmentId`, `status`, `hasSeats=true`, `search` | 200 |
| GET | `/offerings/my-teaching` | INSTRUCTOR | `semesterId?` | 200 |
| GET | `/offerings/:id` | Auth | + schedule | 200 |
| PATCH | `/offerings/:id` | ADMIN | `capacity?`, `room?`, `section?` | 200 |
| PATCH | `/offerings/:id/instructor` | ADMIN | `{ "instructorId": "<uuid>\|null" }` | 200 |
| PATCH | `/offerings/:id/status` | ADMIN | `{ "status": "OPEN" }` | 200 |
| POST | `/offerings/:id/schedules` | ADMIN | `dayOfWeek`, `startTime`, `endTime` (`HH:MM`), `room?` | 201 |
| DELETE | `/offerings/:id/schedules/:scheduleId` | ADMIN | — | 200 |
| DELETE | `/offerings/:id` | ADMIN | soft-delete | 200 |
| GET | `/offerings/:id/students` | INSTRUCTOR†, ADMIN | roster. `includeDropped=true?` | 200 |
| GET | `/offerings/:id/attendance` | INSTRUCTOR†, ADMIN | query `date=YYYY-MM-DD` | 200 |
| POST | `/offerings/:id/attendance` | INSTRUCTOR†, ADMIN | `date`, `records[{enrollmentId,status,remarks?}]` | 200 |
| GET | `/offerings/:id/attendance/summary` | INSTRUCTOR†, ADMIN | rates + eligibility | 200 |
| DELETE | `/offerings/:id/attendance` | ADMIN | query `date=` | 200 |
| POST | `/offerings/:id/exams` | INSTRUCTOR†, ADMIN | `type`, `title`, `totalMarks`, `weight`, `examDate` | 201 |
| GET | `/offerings/:id/exams` | Auth | pagination | 200 |
| GET | `/offerings/:id/grades` | INSTRUCTOR†, ADMIN | preview | 200 |
| POST | `/offerings/:id/grades` | INSTRUCTOR†, ADMIN | `grades[{enrollmentId,letterGrade?,remarks?}]` | 200 |

† Instructor must own the offering (`ownership('offering')`). ADMIN bypasses.

`offering status`: `DRAFT`, `OPEN`, `CLOSED`, `COMPLETED`, `CANCELLED`.  
`dayOfWeek`: `SUNDAY` … `SATURDAY`.  
`attendance status`: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`.  
`exam type`: `QUIZ`, `ASSIGNMENT`, `PRESENTATION`, `MIDTERM`, `FINAL`.  
`letterGrade`: `A_PLUS`, `A`, `A_MINUS`, `B_PLUS`, `B`, `B_MINUS`, `C_PLUS`, `C`, `D`, `F`, `I`, `W`.

```bash
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{
  "courseId":"'"$COURSE_ID"'","semesterId":"'"$SEMESTER_ID"'",
  "section":"A","capacity":40,"room":"R-101","instructorId":"'"$INSTRUCTOR_ID"'",
  "schedules":[{"dayOfWeek":"SUNDAY","startTime":"09:00","endTime":"10:30","room":"R-101"}]
}' "$API/offerings"

curl -sS -H "$H_ADMIN" -H "$JSON" -d '{"status":"OPEN"}' "$API/offerings/$OFFERING_ID/status"
curl -sS -H "$H_INST" "$API/offerings/my-teaching"
curl -sS -H "$H_INST" "$API/offerings/$OFFERING_ID/students"

curl -sS -H "$H_INST" -H "$JSON" -d '{
  "date":"2026-09-06",
  "records":[{"enrollmentId":"'"$ENROLLMENT_ID"'","status":"PRESENT"}]
}' "$API/offerings/$OFFERING_ID/attendance"
curl -sS -H "$H_INST" "$API/offerings/$OFFERING_ID/attendance?date=2026-09-06"
curl -sS -H "$H_INST" "$API/offerings/$OFFERING_ID/attendance/summary"

curl -sS -H "$H_INST" -H "$JSON" -d '{
  "type":"MIDTERM","title":"Midterm 1","totalMarks":"50","weight":"30","examDate":"2026-10-01"
}' "$API/offerings/$OFFERING_ID/exams"

curl -sS -H "$H_INST" "$API/offerings/$OFFERING_ID/grades"
curl -sS -H "$H_INST" -H "$JSON" -d '{
  "grades":[{"enrollmentId":"'"$ENROLLMENT_ID"'","letterGrade":"A"}]
}' "$API/offerings/$OFFERING_ID/grades"
```

---

## 10. Enrollments (7)

| Method | Path | Access | Body | Expect |
|---|---|---|---|---|
| POST | `/enrollments` | STUDENT | `{ "offeringId" }` — 8 checks, last-seat safe | 201 |
| POST | `/enrollments/admin` | ADMIN | `studentId`, `offeringId`, `skipChecks?` string[] | 201 |
| GET | `/enrollments/my-courses` | STUDENT | `semesterId?`, `status?` | 200 |
| GET | `/enrollments/available-courses` | STUDENT | `eligibleOnly=true?` | 200 |
| GET | `/enrollments` | ADMIN | `studentId`, `offeringId`, `semesterId`, `status` | 200 |
| DELETE | `/enrollments/:id` | STUDENT, own | drop before deadline | 200 |
| PATCH | `/enrollments/:id/grade` | INSTRUCTOR†, ADMIN | `{ "letterGrade": "A" }` | 200 |

Enrollment `status`: `ENROLLED`, `DROPPED`, `COMPLETED`, `FAILED`.

Common enrollment errors: **400** (window/prereq/clash/credit cap), **402** (unpaid invoice — `student02`), **409** (full section).

```bash
curl -sS -H "$H_STU" "$API/enrollments/available-courses"
curl -sS -H "$H_STU" -H "$JSON" -d '{"offeringId":"'"$OFFERING_ID"'"}' "$API/enrollments"
curl -sS -H "$H_STU" "$API/enrollments/my-courses"
curl -sS -H "$H_ADMIN" "$API/enrollments?page=1&limit=20"
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{
  "studentId":"'"$STUDENT_PROFILE_ID"'","offeringId":"'"$OFFERING_ID"'"
}' "$API/enrollments/admin"
curl -sS -X DELETE -H "$H_STU" "$API/enrollments/$ENROLLMENT_ID"
```

---

## 11. Exams (5)

Mounted at `/exams/:id`. Instructor must own the exam’s offering.

| Method | Path | Access | Body | Expect |
|---|---|---|---|---|
| PATCH | `/exams/:id` | INSTRUCTOR† | ≥1 of `title`, `examDate`, `totalMarks`, `weight` | 200 |
| DELETE | `/exams/:id` | INSTRUCTOR† | soft-delete | 200 |
| PATCH | `/exams/:id/publish` | INSTRUCTOR† | `{ "isPublished": true }` | 200 |
| POST | `/exams/:id/results` | INSTRUCTOR† | `results[{enrollmentId,marksObtained,remarks?}]` (1–200) | 200 |
| GET | `/exams/:id/results` | INSTRUCTOR†, ADMIN | pagination | 200 |

```bash
curl -sS -H "$H_INST" -H "$JSON" \
  -d '{"results":[{"enrollmentId":"'"$ENROLLMENT_ID"'","marksObtained":"42"}]}' \
  "$API/exams/$EXAM_ID/results"
curl -sS -H "$H_INST" "$API/exams/$EXAM_ID/results"
curl -sS -H "$H_INST" -H "$JSON" -d '{"isPublished":true}' "$API/exams/$EXAM_ID/publish"
```

---

## 12. Invoices (8)

| Method | Path | Access | Body / query | Expect |
|---|---|---|---|---|
| GET | `/invoices/my` | STUDENT | `status?`, `semesterId?` | 200 |
| GET | `/invoices/summary` | ADMIN | totals by status | 200 |
| GET | `/invoices` | ADMIN | `status`, `semesterId`, `studentId`, `type`, `search` | 200 |
| POST | `/invoices/generate` | ADMIN | `{ "semesterId" }` bulk tuition | 200 |
| POST | `/invoices` | ADMIN | `studentId`, `semesterId`, `type` (`EXAM_FEE`\|`LATE_FEE`\|`LAB_FEE`), `totalAmount` (1–1e6), `dueDate`, `notes?` | 201 |
| GET | `/invoices/:id` | STUDENT own, ADMIN | UUID | 200 |
| PATCH | `/invoices/:id/waive` | ADMIN | `{ "reason": "at least 10 chars" }` | 200 |
| PATCH | `/invoices/:id/cancel` | ADMIN | unpaid only | 200 |

Invoice `status`: `UNPAID`, `PARTIAL`, `PAID`, `WAIVED`, `CANCELLED`.  
`type`: `TUITION`, `REGISTRATION`, `EXAM_FEE`, `LATE_FEE`, `LAB_FEE`.

```bash
curl -sS -H "$H_STU" "$API/invoices/my"
curl -sS -H "$H_ADMIN" "$API/invoices/summary"
curl -sS -H "$H_ADMIN" "$API/invoices"
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{"semesterId":"'"$SEMESTER_ID"'"}' "$API/invoices/generate"
curl -sS -H "$H_ADMIN" -H "$JSON" -d '{
  "studentId":"'"$STUDENT_PROFILE_ID"'","semesterId":"'"$SEMESTER_ID"'",
  "type":"LAB_FEE","totalAmount":"500","dueDate":"2026-10-01","notes":"Lab"
}' "$API/invoices"
```

---

## 13. Payments (8)

Live gateway is **Stripe**. `PAYMENT_GATEWAY=SSLCOMMERZ` is a stub (`Not implemented`).

| Method | Path | Access | Body | Expect |
|---|---|---|---|---|
| POST | `/payments/initiate` | STUDENT | `{ "invoiceId" }` — amount from invoice | 200 + checkout URL |
| GET | `/payments/verify/:transactionRef` | STUDENT | poll our row | 200 |
| GET | `/payments/my-history` | STUDENT | pagination | 200 |
| GET | `/payments` | ADMIN | `status`, `gateway`, `invoiceId` | 200 |
| GET | `/payments/:id` | STUDENT own, ADMIN | UUID | 200 |
| POST | `/payments/:id/refund` | ADMIN | `{ "reason": "at least 10 chars" }` | 200 |
| GET | `/payments/expire-stale` | Cron | `Authorization: Bearer $CRON_SECRET` (no JWT) | 200 `{ cancelled }` |
| POST | `/payments/webhook` | Public | **raw** JSON + header `stripe-signature`. Mounted in `app.ts` before `express.json` | 200 |

Payment `status`: `INITIATED`, `SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED`.

```bash
curl -sS -H "$H_STU" -H "$JSON" -d '{"invoiceId":"'"$INVOICE_ID"'"}' "$API/payments/initiate"
curl -sS -H "$H_STU" "$API/payments/verify/$TRANSACTION_REF"
curl -sS -H "$H_STU" "$API/payments/my-history"
curl -sS -H "$H_ADMIN" "$API/payments"
curl -sS -H "Authorization: Bearer $CRON_SECRET" "$API/payments/expire-stale"
```

Stripe webhook (do not send through Postman’s JSON parser if it re-serializes the body):

`POST {origin}/api/v1/payments/webhook`

---

## Recommended test order (after seed)

Seed already has department, program, courses, semester (REGISTRATION), offerings, students, and some enrollments. You can **read** almost everything immediately, then **write** only if you want to mutate.

1. Health + login (admin, instructor, student)
2. 401 / 403 / 422 negatives
3. `GET /users/me`, `/students/me`, `/instructors/me`
4. Lists: departments, programs, courses, semesters/current, offerings
5. Student: available-courses → my-courses → invoices/my
6. Instructor: my-teaching → offering students → attendance GET → exams GET
7. Admin: admin/users, enrollments, invoices/summary, payments
8. Writes (use unique codes / a future semester so you do not clash with seed):
   department → program → course → prerequisite → semester → offering → OPEN → student enroll → attendance → exam → marks → publish exam → grades → invoice generate → payment initiate
9. Admin publish-results when readiness is clean
10. Stripe webhook + refund only with real Stripe test keys

Do **not** change the seeded admin password in a shared environment unless you intend to.

---

## Ownership

| Resource | Who may act |
|---|---|
| Enrollment drop | Student who owns the enrollment |
| Offering roster / attendance / grades / exams | Instructor assigned to that offering; ADMIN always |
| Invoice / payment GET | Student who owns it; ADMIN always |

---

## What is not an HTTP API

- Audit log and notification rows are written inside service transactions.
- SSLCommerz checkout is not implemented.
- `GET /admin/dashboard-stats` is not exposed.

Unit tests (`npm test`) cover GPA, money, attendance rate, prerequisite cycles, and schedule clashes — not HTTP.
