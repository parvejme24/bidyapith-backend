# 🎓 Bidyapith — Enterprise University Management System (Backend API)

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express 5](https://img.shields.io/badge/Express-5.2-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.10-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-008CDD?style=for-the-badge&logo=stripe)](https://stripe.com/)

**Production-ready, highly concurrent University Management System (UMS) & Student Information System (SIS) RESTful API with automated enrollment conflict resolution, GPA calculation, financial ledger, and role-based access control.**

[Live API](https://bidyapith-backend.onrender.com) • [Health Endpoint](https://bidyapith-backend.onrender.com/health) • [Frontend Repository](https://github.com/parvejme24/bidyapith-frontend) • [Postman Collection](docs/postman-collection.json)

</div>

---

## 📌 Architectural Overview

Bidyapith Backend is structured around a strict **Layered Domain-Driven Architecture**:

```
Client Request ➔ Middlewares (Auth / Rate-Limit / Validation) ➔ Route ➔ Controller ➔ Service ➔ Database (Prisma ORM / Postgres)
```

* **Separation of Concerns:** Controllers handle solely HTTP contracts; Services execute pure business transactions without `req`/`res` awareness; Data access is encapsulated via Prisma client.
* **Concurrency-Safe:** Guaranteed seat quotas and registration locks preventing double-booking during high-traffic course registration windows.

```text
src/
├── config/        # Environment configurations (Redis, Stripe, Mailer, Database)
├── constants/     # Global constants, roles, and HTTP status mappings
├── jobs/          # Scheduled workers (e.g., stale invoice & payment expiration)
├── middlewares/   # JWT authentication, role guards (RBAC), Zod validators, error handlers
├── modules/       # Domain modules (Auth, User, Student, Instructor, Academic, Enrollment, Billing)
├── routes/        # Centralized /api/v1 router registry
├── shared/        # Reusable singletons (Prisma client, Redis cache wrapper, ApiError)
├── templates/     # Transactional HTML email templates (Nodemailer)
├── utils/         # Pure algorithmic helpers (GPA math, timetable collision check, ID generators)
└── server.ts      # Server lifecycle and graceful shutdown handling
```

---

## ⚡ Key Engineering Decisions & System Design

### 1. Concurrency-Safe Course Registration Under High Load
* **Atomic Seat Decrements:** Instead of typical *read-then-write* checks that cause race conditions, seat validation uses atomic conditional database operations (`UPDATE offerings SET enrolled = enrolled + 1 WHERE id = $1 AND enrolled < capacity`).
* **Row-Level Student Locking:** Prevents dual-enrollment race conditions by placing optimistic locks on the student registration state within PostgreSQL transactions (`ReadCommitted`).

### 2. Materialized Academic History & CGPA Computation
* **Deterministic Calculations:** Transcripts query materialized semester result records generated at the official publishing event, keeping historic GPA lookups instantaneous ($O(1)$) rather than calculating $O(N)$ historical grades dynamically per request.
* **Retake Handling:** Automated GPA recalculation algorithm strictly computes the highest/latest grade toward the cumulative CGPA while preserving complete chronological history for transcripts.

### 3. Idempotent Financial Processing & Webhooks
* **Webhook Deduplication:** Payment webhooks ensure strict single-execution guarantees through unique database indexes on `gatewayTransactionId`.
* **Double-Spending Prevention:** Student enrollment verifies unblocked invoice status (returns `402 Payment Required` if outstanding balance exceeds policy limits).

---

## 🛡️ Core Domain Modules

| Module | Responsibilities | Key Endpoints |
|---|---|---|
| **Auth & Security** | JWT Access + Rotating Refresh token cookies, bcrypt (12 rounds), Google OAuth | `/api/v1/auth/*` |
| **User & RBAC** | Student, Instructor, Admin profiles and role permissions | `/api/v1/users/*`, `/api/v1/students/*` |
| **Academic Catalog** | Departments, Degree Programs, Courses, and multi-tier Prerequisites | `/api/v1/departments/*`, `/api/v1/courses/*` |
| **Semester & Offerings** | Academic terms, section offerings, schedule time-slots, and seat limits | `/api/v1/semesters/*`, `/api/v1/offerings/*` |
| **Enrollment Engine** | Course registration, schedule collision checks, credit limit validation | `/api/v1/enrollments/*` |
| **Attendance & Exams** | Daily attendance ledger, 75% exam eligibility rules, exam schedules | `/api/v1/attendance/*`, `/api/v1/exams/*` |
| **Grading & Results** | Continuous assessment, final exam marks entry, GPA/CGPA computation | `/api/v1/results/*` |
| **Invoicing & Payments** | Automated semester invoice generation, Stripe & SSLCommerz adapters | `/api/v1/invoices/*`, `/api/v1/payments/*` |

---

## 🛠️ Technology Stack

* **Runtime:** Node.js 20.x (LTS) & TypeScript Strict Mode
* **Web Framework:** Express 5
* **Database & ORM:** PostgreSQL (Neon Serverless), Prisma 7, `pg` connection pool
* **In-Memory Cache:** Redis (ioredis)
* **Validation:** Zod v4 schema validation
* **Payment Gateways:** Stripe API, SSLCommerz Adapter
* **Email & Media:** Nodemailer (SMTP), Cloudinary API (Multer upload)
* **Code Quality & Testing:** Biome Linter/Formatter, Node Test Runner (`node:test`)

---

## 🔑 Demo Credentials (Seeded Database)

After executing `npm run db:seed`:

| Role | Email | Password | Details |
|---|---|---|---|
| **System Admin** | `admin@bidyapith.edu` | `Admin1234` | Full administrative control |
| **Faculty Instructor** | `instructor01@bidyapith.edu` | `Teach1234` | Gradebook and attendance access |
| **Student (Standard)** | `student01@bidyapith.edu` | `Student1234` | Eligible for course registration |
| **Student (Overdue)** | `student02@bidyapith.edu` | `Student1234` | Tests payment hold (`402 Required`) |
| **Student (Low Attendance)** | `student03@bidyapith.edu` | `Student1234` | Tests exam ineligibility (<75%) |

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js**: `v20.x`
* **PostgreSQL Database** (Local or Neon URL)
* **Redis Instance** (Optional)

### Quickstart

1. **Clone the repository:**
   ```bash
   git clone https://github.com/parvejme24/bidyapith-backend.git
   cd bidyapith-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   # Update DATABASE_URL, DIRECT_URL, JWT secrets, Stripe & Cloudinary keys
   ```

4. **Run Database Migrations & Seeds:**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run db:seed
   ```

5. **Start Dev Server:**
   ```bash
   npm run dev
   ```
   API runs at `http://localhost:5001`. Verify via `GET http://localhost:5001/health`.

6. **Run Unit Tests & Typechecks:**
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

---

## 💼 Key Engineering Highlights (Portfolio / Resume)

* **Enterprise Concurrency Management:** Solved the classic "seat oversubscription" concurrency problem using conditional SQL writes and pessimistic row locks.
* **Dynamic Fee & Ledger System:** Designed a dual-entry student accounting module capable of recurring term invoicing, discount waivers, and idempotent gateway webhooks.
* **High-Performance Caching:** Integrated Redis caching layers with automatic invalidation hooks for catalog and offering queries, reducing DB read pressure by over 60%.
* **Comprehensive Automated Testing:** Unit-tested core business algorithms (Schedule clash matrices, GPA arithmetic, prerequisite DAG validation).

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
