# 🎓 Bidyapith — University Management System (Backend API)

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express 5](https://img.shields.io/badge/Express-5.2-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.10-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![CI Workflow](https://github.com/parvejme24/bidyapith-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/parvejme24/bidyapith-backend/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](LICENSE)

**A high-performance, concurrency-safe University Management System (UMS) and Student Information System (SIS) RESTful API engine.**

[Live API Deployment](https://bidyapith-backend.onrender.com) • [API Health Check](https://bidyapith-backend.onrender.com/health) • [Frontend Web App](https://bidyapith-frontend.vercel.app) • [Postman Collection](docs/postman-collection.json)

</div>

---

## 📖 Introduction

**Bidyapith Backend** is a scalable, enterprise-grade RESTful API built to power modern higher-education administration. It coordinates complex institutional workflows across student enrollment, curriculum governance, continuous grading, attendance ledgers, and financial invoicing.

Engineered with **Express 5**, **TypeScript**, and **Prisma ORM on PostgreSQL**, the system guarantees transactional consistency, concurrency control during high-traffic course registration periods, and sub-millisecond cached reads with **Redis**.

---

## 📝 Description

Higher education platforms handle bursty, mission-critical traffic patterns during course registration and exam grade releases. Bidyapith Backend provides a resilient server architecture designed with strict domain boundary separation:

1. **Transactional Integrity:** Solves concurrency race conditions on section quotas using atomic conditional database operations and row-level locking.
2. **Deterministic Academic Computation:** Computes weighted GPA/CGPA progressions and tracks prerequisite dependency DAGs.
3. **Financial Accounting Ledger:** Automated term invoice generation, payment hold enforcements, and idempotent webhook handlers for **Stripe** and **SSLCommerz**.
4. **Security & Role-Based Access Control (RBAC):** Strict JWT token rotation, bcrypt password hashing, and role guards protecting administrative, faculty, and student surfaces.

---

## 🌐 Live Links & Repositories

| Resource | URL |
|---|---|
| **Live API Production** | [https://bidyapith-backend.onrender.com](https://bidyapith-backend.onrender.com) |
| **API Health Status** | [https://bidyapith-backend.onrender.com/health](https://bidyapith-backend.onrender.com/health) |
| **Backend GitHub Repository** | [https://github.com/parvejme24/bidyapith-backend.git](https://github.com/parvejme24/bidyapith-backend.git) |
| **Frontend Production (Primary)** | [https://bidyapith-frontend.vercel.app/](https://bidyapith-frontend.vercel.app/) |
| **Frontend Production (Mirror)** | [https://momentum-frontend-pi.vercel.app/](https://momentum-frontend-pi.vercel.app/) |
| **Frontend GitHub Repository** | [https://github.com/parvejme24/bidyapith-frontend.git](https://github.com/parvejme24/bidyapith-frontend.git) |
| **Related Repository (Momentum)** | [https://github.com/parvejme24/momentum-frontend.git](https://github.com/parvejme24/momentum-frontend.git) |

---

## 🛠️ Tech Stack

| Category | Technology | Version | Purpose / Use Case |
|---|---|---|---|
| **Runtime Environment** | [Node.js](https://nodejs.org/) | `20.x (LTS)` | High-performance asynchronous JavaScript runtime |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `5.9.3` | Strict static typing, interfaces, and compile-time validation |
| **HTTP Framework** | [Express](https://expressjs.com/) | `5.2.1` | RESTful routing, middleware pipeline, and controller architecture |
| **Database** | [PostgreSQL (Neon Serverless)](https://neon.tech/) | `16.x` | Relational transactional database with ACID guarantees |
| **ORM & Query Builder** | [Prisma ORM](https://www.prisma.io/) | `7.10.0` | Type-safe database queries, schema migrations, and connection pooling |
| **Caching & In-Memory Store** | [Redis (ioredis)](https://redis.io/) | `6.0.0` | Fast catalog caching and session acceleration |
| **Request Validation** | [Zod](https://zod.dev/) | `4.5.4` | Strict runtime schema parsing and error serialization |
| **Authentication & Hashing** | [JSON Web Tokens (JWT)](https://jwt.io/) & [bcrypt](https://www.npmjs.com/package/bcrypt) | `9.0.3` / `6.0.0` | Access/Refresh token rotation, password hashing (12 rounds) |
| **Payment Gateways** | [Stripe](https://stripe.com/) & [SSLCommerz](https://sslcommerz.com/) | `22.6.1` | Multi-gateway billing, invoices, and idempotent webhooks |
| **Media & File Storage** | [Cloudinary](https://cloudinary.com/) + [Multer](https://github.com/expressjs/multer) | `2.11.0` | Profile avatars, syllabus documents, and transcript uploads |
| **Transactional Email** | [Nodemailer](https://nodemailer.com/) | `9.1.1` | HTML email dispatching for admissions and password recovery |
| **Security & Middleware** | [Helmet](https://helmetjs.github.io/) & [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) | `8.3.0` / `8.7.0` | HTTP header hardening, DDoS mitigation, and rate limiting |
| **Linter & Formatter** | [Biome](https://biomejs.dev/) | `2.5.11` | Ultra-fast TypeScript linting and static code analysis |
| **Test Runner** | [Node Test Runner (`node:test`)](https://nodejs.org/api/test.html) | Native | Automated unit tests for GPA arithmetic and schedule collision |

---

## 🔄 CI/CD & GitHub Actions Automation

The repository features automated Continuous Integration via GitHub Actions to maintain strict code reliability on every pull request and push:

```
Git Push ➔ Checkout ➔ Node 20.x Setup ➔ Prisma Client Generation ➔ TypeScript Typecheck ➔ Biome Lint ➔ Automated Unit Tests
```

* **Workflow File:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
* **Automated Pipeline Stages:**
  1. **Prisma Schema Compilation:** `npx prisma generate` to validate DB bindings.
  2. **Type Safety Verification:** `npx tsc --noEmit` ensuring zero compilation errors.
  3. **Biome Linter & Style Analysis:** `npm run lint` for code standard enforcement.
  4. **Automated Unit Tests:** `npm test` verifying GPA arithmetic, schedule collision matrices, and prerequisite DAG validators.
* **Production Deployment:** Auto-deployed to **Render** with pre-deploy database migrations (`npx prisma migrate deploy`).

---

## 🌟 Key Features & Domain Modules

### 🛡️ Architecture Pattern
Request flow follows a clean **Layered Domain-Driven Design**:
`Route ➔ Middleware ➔ Controller ➔ Service ➔ Database (Prisma ORM)`

### 📦 Core Modules

| Module | Purpose & Capabilities | Key Endpoints |
|---|---|---|
| **Auth & Security** | JWT access/refresh token rotation, bcrypt hashing, Google OAuth | `/api/v1/auth/*` |
| **User & RBAC** | Multi-role user governance (Student, Instructor, Admin) | `/api/v1/users/*`, `/api/v1/students/*` |
| **Academic Catalog** | Departments, Degree Programs, Courses, and multi-tier Prerequisites | `/api/v1/departments/*`, `/api/v1/courses/*` |
| **Semester & Offerings** | Academic term scheduling, section quotas, timetable slots | `/api/v1/semesters/*`, `/api/v1/offerings/*` |
| **Enrollment Engine** | Concurrency-safe course registration and schedule collision detection | `/api/v1/enrollments/*` |
| **Attendance & Exams** | Attendance tracking, 75% exam eligibility enforcement, exam schedules | `/api/v1/attendance/*`, `/api/v1/exams/*` |
| **Grading & Results** | Continuous assessment, weighted final exams, materialized GPA/CGPA | `/api/v1/results/*` |
| **Invoicing & Billing** | Automated tuition fee generation, Stripe & SSLCommerz checkout | `/api/v1/invoices/*`, `/api/v1/payments/*` |

---

## ⚡ Concurrency & System Design Highlights

1. **Race-Condition-Free Course Registration:**
   Avoids vulnerable *read-then-write* race conditions during seat registration by utilizing atomic conditional queries:
   ```sql
   UPDATE "Offerings" SET "enrolledCount" = "enrolledCount" + 1 
   WHERE "id" = $1 AND "enrolledCount" < "capacity";
   ```
2. **Materialized Academic Transcripts:**
   Historic semester GPA records are materialized at official publication time, turning historical grade audits into instantaneous $O(1)$ lookups.
3. **Idempotent Financial Webhook Processing:**
   Payment webhooks enforce unique database indexes on `gatewayTransactionId` to eliminate duplicate payment credits.

---

## 📂 Project Structure

```text
bidyapith-backend/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI pipeline
├── prisma/
│   ├── schema.prisma          # Relational PostgreSQL models & indexes
│   ├── migrations/            # Version-controlled DB migrations
│   └── seed.ts                # Realistic institutional demo seed data
├── src/
│   ├── config/                # Environment, Redis, Stripe, and Nodemailer configs
│   ├── constants/             # Enums, roles, and HTTP status mappings
│   ├── jobs/                  # Background worker tasks (e.g., stale invoice expirations)
│   ├── middlewares/           # JWT auth, role validation, Zod request validators, global errors
│   ├── modules/               # Domain-driven feature modules (Auth, Course, Enrollment, etc.)
│   ├── routes/                # Centralized /api/v1 route registry
│   ├── shared/                # Prisma singleton, Redis cache helper, ApiError class
│   ├── templates/             # Transactional HTML email templates
│   ├── utils/                 # Pure algorithms (GPA calculator, timetable collision detector)
│   ├── app.ts                 # Express application configuration & middlewares
│   └── server.ts              # HTTP server bootstrapper and graceful shutdown listeners
├── tests/
│   └── unit/                  # Automated unit test suites
└── docs/                      # Postman collections, architectural decisions, and API specs
```

---

## 📸 API Preview & Demo Credentials

<div align="center">

| Postman API Collection | System Health Status |
|:---:|:---:|
| ![Postman Collection Preview](https://raw.githubusercontent.com/parvejme24/bidyapith-backend/main/docs/postman-preview.png) | ![Health Check Preview](https://raw.githubusercontent.com/parvejme24/bidyapith-backend/main/docs/health-preview.png) |

</div>

### Seeded Demo Accounts (After `npm run db:seed`)

| Role | Email | Password | Account State |
|---|---|---|---|
| **System Admin** | `admin@bidyapith.edu` | `Admin1234` | Full access across all modules |
| **Faculty Instructor (Standard)** | `instructor01@bidyapith.edu` | `Teach1234` | Gradebook, attendance & syllabus |
| **Faculty Instructor (Portal)** | `faculty@bidyapith.edu.bd` | `Instructor1234` | Multi-batch roster, attendance & grade entry |
| **Student (Standard)** | `student01@bidyapith.edu` | `Student1234` | Fully eligible for enrollment |
| **Student (Overdue)** | `student02@bidyapith.edu` | `Student1234` | Unpaid invoice hold (`402 Required`) |
| **Student (Low Attendance)** | `student03@bidyapith.edu` | `Student1234` | Attendance < 75% (`examEligible: false`) |

---

## 🚀 Local Installation & Setup

### Prerequisites
* **Node.js**: `v20.x` or higher
* **PostgreSQL Database** (Neon or local instance)
* **Redis Instance** (Optional; gracefully degrades to memory)

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
   # Populate DATABASE_URL, DIRECT_URL, JWT secrets, Stripe & Cloudinary credentials
   ```

4. **Run Database Migrations and Demo Seed:**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run db:seed
   npm run db:seed:faculty  # Seeds faculty@bidyapith.edu.bd roster & batch attendance
   ```

5. **Start Dev Server:**
   ```bash
   npm run dev
   ```
   API runs at `http://localhost:5001`. Verify at `GET http://localhost:5001/health`.

6. **Run Unit Tests & Quality Verification:**
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

---

## 🎯 Conclusion

**Bidyapith Backend API** provides a robust, scalable, and concurrency-resilient foundational architecture for higher-education administration. Built following strict layered architecture principles, comprehensive type-checking, and CI/CD validation, it is fully production-ready and battle-tested for enterprise deployments.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
