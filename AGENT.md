# Bidyapith — Backend

University Management System API. Production software sold to universities in Bangladesh, under the Tech Nibas brand. Not a tutorial project — write code you would defend in a review.

## Commands

```bash
npm run dev              # ts-node-dev, port 5000
npm run build            # prisma generate && tsc
npm start                # node dist/server.js
npm run db:migrate       # prisma migrate dev
npm run db:seed
npm run db:studio
npm run lint             # biome check ./src
npx tsc --noEmit         # must pass before any commit
```

## Stack

Node.js 20 · TypeScript strict · Express · PostgreSQL (Neon) · Prisma · Zod · JWT · Nodemailer · Multer + Cloudinary · Stripe/SSLCommerz · Redis (optional).

## Layout

```
src/
  config/       zod-validated env, redis, cloudinary, stripe, mailer
  routes/       index.ts — the module registry
  middlewares/  auth, authorize, ownership, validateRequest, rateLimiter,
                upload, globalErrorHandler, notFound
  modules/      18 modules, each with 6 files (below)
  shared/       infrastructure with no domain knowledge
  utils/        pure domain functions, no I/O
  jobs/         cron
  types/        express.d.ts augments Request with `user`
  constants/
```

Modules: auth, user, student, instructor, department, program, course, prerequisite, semester, offering, enrollment, attendance, exam, result, invoice, payment, audit-log, notification.

Each module has exactly: `<name>.route.ts`, `.controller.ts`, `.service.ts`, `.validation.ts`, `.constant.ts`, `.interface.ts`.

## Architecture rules

Dependencies flow one direction: **route → middleware → controller → service → prisma**.

- Controllers read `req`, call one service function, call `sendResponse`. They never import `prisma`. Over 12 lines means logic leaked upward.
- Services never touch `req` or `res`. Pass what they need as arguments.
- `shared/` knows nothing about universities. If it imports something about courses, it belongs in `utils/`.
- `utils/` is pure — no database, no network. That's why GPA and schedule-conflict logic live there and are unit tested.
- Throw `ApiError(status, message)`. Never `res.status().json()` inside a service.

## Conventions

- No `any`. No `!` to silence the compiler.
- Import enums from `@prisma/client`. Never redeclare `Role`, `UserStatus`, or any other Prisma enum.
- Folders kebab-case (`audit-log/`), files `<module>.<part>.ts`.
- Exports are PascalCase objects: `EnrollmentService`, `AuthRoutes`, `CourseValidation`.
- Interfaces prefixed `I`: `ICourseFilters`.
- Never return a password hash. Use an explicit Prisma `select` that omits it, not `delete user.password`.
- Every list query filters `deletedAt: null`. Soft delete only — no hard deletes.
- Every state change writes an audit log via `createAuditLog(tx, {...})`, inside the same transaction as the change.

## Response contract

```jsonc
// success
{ "success": true, "statusCode": 200, "message": "...",
  "meta": { "page": 1, "limit": 10, "total": 47, "totalPage": 5 },  // lists only
  "data": {} }

// error
{ "success": false, "statusCode": 422, "message": "Validation error",
  "errors": [{ "path": "email", "message": "Invalid email format" }] }
```

All routes versioned under `/api/v1`.

## Middleware order in app.ts

```
helmet → cors → compression
  → payment webhook (express.raw)     // MUST precede express.json
  → express.json → urlencoded → cookieParser
  → rateLimiter
  → /health
  → /api/v1 routes
  → notFound
  → globalErrorHandler                // last, 4 args
```

The webhook sits above `express.json()` because Stripe signature verification needs the raw body.

## Domain rules that are easy to get wrong

- **Three roles only**: STUDENT, INSTRUCTOR, ADMIN. Registrar and finance duties belong to ADMIN.
- **Role is not enough for authorization.** Instructors may only touch attendance, exams and grades for offerings where `offering.instructorId` matches their own profile. Students may only read their own rows. Use the `ownership` middleware on top of `authorize`.
- **Seat capacity uses a guarded atomic update**, never read-then-write:
  ```sql
  UPDATE course_offerings SET enrolled_count = enrolled_count + 1
  WHERE id = $1 AND enrolled_count < capacity
  ```
  Zero rows affected means the section is full — throw 409 and roll back.
- **Enrollment runs 8 checks in one serializable transaction**: registration window, duplicate, prerequisites, credit limit, outstanding dues, schedule conflict, capacity, then create + invoice + audit log.
- **Payments**: the amount always comes from the invoice on the server, never from the request body. Webhooks are idempotent, keyed on the unique `gatewayTransactionId`.
- **Semester status gates most writes.** Registration only during `REGISTRATION`, grading only during `GRADING`.
- **ID generation** (student ID, employee ID, invoice number) computes its sequence inside the caller's transaction. Generating outside means two concurrent requests get the same ID.

## Performance

Full detail in `docs/PERFORMANCE.md`. The rules that apply to every query you write:

- **`select`, never `include`.** `include` pulls every scalar column of the relation. Name the fields the response actually needs.
- **Count and page run in parallel**: `prisma.$transaction([findMany, count])`, not two awaits.
- **No queries inside loops.** Load once, evaluate in memory. The prerequisite check is the classic trap here.
- **Independent queries go through `Promise.all`.**
- **Every list endpoint paginates.** No unbounded `findMany`.
- **Do all reads before opening a transaction.** Serializable transactions hold locks for their whole duration.
- **Hash with native `bcrypt`, not `bcryptjs`.** `bcryptjs` is pure JS and blocks the event loop for ~300ms per hash. Rounds stay at 12.
- **Never cache seat counts, invoice status, or payment state.** Cache the catalog, not live counts or money.
- Search needs trigram GIN indexes and list queries need partial indexes on `deleted_at IS NULL` — both live in a raw SQL migration, not the Prisma schema.

## Database

- Schema is `prisma/schema.prisma`, 18 models. Read it before writing queries; match field names exactly.
- Never edit files in `prisma/migrations/`.
- `DATABASE_URL` is the pooled Neon connection, `DIRECT_URL` is direct. Migrations need the direct one.
- Money is `Decimal(10,2)`, GPA is `Decimal(3,2)`. Never floats.

## Git

Conventional commits, one per logical unit:

```
feat(enrollment): add transaction-safe course registration
fix(payment): make webhook idempotent on gateway transaction id
refactor(shared): extract query builder from course service
docs: add decisions on materialized semester results
```

## When in doubt

If the schema doesn't match what a task assumes, stop and ask rather than working around it or modifying the schema. If a rule here conflicts with a specific instruction in a prompt, the prompt wins — but say so.