# Bidyapith

University Management System API for institutions that need enrollment, grading, and billing behind one contract. Built for Tech Nibas to sell to universities in Bangladesh.

## Live links

| | |
|---|---|
| API | `_TODO: production origin, e.g. https://api.bidyapith.edu_` |
| Postman | [docs/postman-collection.json](docs/postman-collection.json) |
| Demo video | `_TODO: recording URL_` |

Health lives at `GET {origin}/health`. All other routes are under `{origin}/api/v1`.

## Demo credentials

After `npm run db:seed`. Override the admin password with `SEED_ADMIN_PASSWORD`.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bidyapith.edu` | `Admin1234` |
| Student | `student01@bidyapith.edu` | `Student1234` |
| Instructor | `instructor01@bidyapith.edu` | `Teach1234` |

`student02@bidyapith.edu` has an overdue invoice (enrollment returns 402). `student03@bidyapith.edu` is below 75% attendance (`examEligible: false`).

## Architecture

Request flow: **route → middleware → controller → service → prisma**. Controllers never import Prisma; services never touch `req` / `res`.

HTTP modules: auth, user, student, instructor, department, program, course, prerequisite, semester, offering, enrollment, attendance, exam, result, invoice, payment. Audit log and notification are written from those modules, not exposed as REST.

```
src/
  config/        env, redis, stripe, mailer
  middlewares/   auth, authorize, ownership, validate, errors
  modules/       one folder per domain module
  routes/        /api/v1 registry
  shared/        prisma, cache, paginate, ApiError
  utils/         GPA, schedule conflict, ids (pure)
  jobs/          expire stale payments
  templates/     transactional HTML
prisma/          schema, migrations, seed
tests/unit/      GPA, money, attendance, prereqs, clashes
```

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20, TypeScript strict |
| HTTP | Express 5 |
| Validation | Zod 4 |
| Database | PostgreSQL (Neon), Prisma 7, `pg` pool |
| Auth | JWT access + rotating refresh cookie, native bcrypt (12) |
| Payments | Stripe (SSLCommerz adapter stub) |
| Cache | Redis via `cached()`, optional |
| Mail | Nodemailer |
| Uploads | Multer + Cloudinary |
| Lint / test | Biome, node:test |

## Key engineering decisions

- Seat capacity is a conditional `UPDATE … WHERE enrolled_count < capacity`, not read-then-write. See [docs/DECISIONS.md](docs/DECISIONS.md#1-seat-capacity-under-concurrency).
- Enrollment locks the student row and stays `ReadCommitted`; only the seat update is cross-student. See [docs/DECISIONS.md](docs/DECISIONS.md#2-row-lock-for-per-student-checks-guarded-update-for-cross-student).
- Transcripts read materialized `SemesterResult` rows written at publish. See [docs/DECISIONS.md](docs/DECISIONS.md#3-materialized-semesterresult).
- Payment webhooks are idempotent because `gatewayTransactionId` is unique. See [docs/DECISIONS.md](docs/DECISIONS.md#4-webhook-idempotency-via-unique-gatewaytransactionid).
- Academic rows are soft-deleted; CGPA uses the best attempt while the transcript lists every one. See [docs/DECISIONS.md](docs/DECISIONS.md#5-soft-deletes-everywhere) and [retake arithmetic](docs/DECISIONS.md#6-retake-arithmetic).

## Local setup

Requires Node 20, a PostgreSQL database (`DATABASE_URL`, `DIRECT_URL` for migrations), and the Cloudinary / Stripe placeholders in `.env.example` filled in (the process will not boot without them). Redis is optional.

```bash
git clone <this-repo>
cd bidyapith-backend
cp .env.example .env
# edit .env: DATABASE_URL, DIRECT_URL, JWT secrets (≥32 chars),
# Cloudinary, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run db:seed   # must succeed a second time
npm run dev
```

API: `http://localhost:5001` (override with `PORT`). Check `GET /health`, then log in at `POST /api/v1/auth/login`.

Before submitting, from another terminal:

```bash
bash scripts/verify-deployment.sh http://localhost:5001
```

## Deploy on Vercel

The API is a single Express function (`src/app.ts` default export). Local `npm run dev` still uses `src/server.ts` (`listen` + in-process jobs).

1. **Database.** Use Neon’s **pooled** connection for `DATABASE_URL` and the **direct** connection for `DIRECT_URL`. Put the Vercel function in the same region as the Neon project (Project → Settings → Functions).
2. **Migrate once** against production (from your laptop, with production URLs in `.env`):

```bash
npx prisma migrate deploy
npm run db:seed   # optional demo data
```

3. **Import the GitHub repo** at [vercel.com/new](https://vercel.com/new). Framework: Express. Root: this repository. The Vercel build is `npx prisma generate` only (TypeScript is compiled by the Express builder, not `tsc`).
4. **Environment variables** (Production + Preview). Set these *before* the first deploy — boot throws if any required value is missing.

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL (migrations) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥ 32 characters each |
| `CLIENT_URL` | Frontend origin (CORS + cookies). Refresh cookie is `SameSite=strict`, so the UI must share this site or you will need a different cookie policy. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Required by config |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Required |
| `PAYMENT_SUCCESS_URL` / `PAYMENT_CANCEL_URL` | Frontend payment return URLs |
| `SMTP_*` | Optional; emails are skipped if `SMTP_HOST` is empty |
| `REDIS_URL` | Optional |
| `CRON_SECRET` | Vercel injects this for Cron. Copy it from the project if you need to call the job yourself. |

Leave `PG_POOL_MAX` unset on Vercel (the process caps the pool at 1 so isolates do not exhaust Neon).

5. Deploy. Health: `GET https://<project>.vercel.app/health`.
6. Stripe webhook endpoint: `https://<project>.vercel.app/api/v1/payments/webhook` (raw body, signature header).
7. Confirm:

```bash
bash scripts/verify-deployment.sh https://<project>.vercel.app
```

`setInterval` does not run on Vercel. Stale `INITIATED` payments are cancelled by the Cron job in `vercel.json` (`GET /api/v1/payments/expire-stale`, daily so it works on Hobby). On Pro you can change the schedule to `0 * * * *`.

## API overview

All routes under `/api/v1`. Full table: [docs/API.md](docs/API.md). Import [docs/postman-collection.json](docs/postman-collection.json) for bodies, saved examples, and the Failure cases folder.

| Group | Routes | Access |
|---|---|---|
| Auth | 9 | Public login/register; auth for logout / change-password |
| Users | 4 self + 6 admin | Self vs `ADMIN` |
| Students / instructors | 5 + 5 | Role + ownership |
| Catalog (dept, program, course, prereq) | 5 + 9 + 5 + 4 | Reads authenticated; writes `ADMIN` |
| Semesters / offerings | 7 + 10 | Status gates writes |
| Enrollment | 7 | Student self-register; admin override |
| Attendance / exams / results | 5 + 8 + 7 | Instructor owns the offering |
| Invoices / payments | 8 + 7 | Amount never from the client; webhook is public raw body |

## Testing

```bash
npm test              # unit tests (GPA, money, attendance rate, prereqs, clashes)
npx tsc --noEmit
npm run lint
```

Concurrent last-seat (after seed; paste `oneSeatOfferingId` from seed stdout). Use two students who are not already in that section (`student08` and `student09`):

```bash
TOKEN_A=$(curl -sS -H 'Content-Type: application/json' \
  -d '{"email":"student08@bidyapith.edu","password":"Student1234"}' \
  http://localhost:5001/api/v1/auth/login | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["accessToken"])')
TOKEN_B=$(curl -sS -H 'Content-Type: application/json' \
  -d '{"email":"student09@bidyapith.edu","password":"Student1234"}' \
  http://localhost:5001/api/v1/auth/login | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["accessToken"])')

OFFERING=<oneSeatOfferingId from seed>

curl -sS -o /tmp/seat-a.json -w 'A %{http_code}\n' -H "Authorization: Bearer ${TOKEN_A}" \
  -H 'Content-Type: application/json' -d "{\"offeringId\":\"${OFFERING}\"}" \
  http://localhost:5001/api/v1/enrollments &
curl -sS -o /tmp/seat-b.json -w 'B %{http_code}\n' -H "Authorization: Bearer ${TOKEN_B}" \
  -H 'Content-Type: application/json' -d "{\"offeringId\":\"${OFFERING}\"}" \
  http://localhost:5001/api/v1/enrollments &
wait
```

One request should return 201, the other 409 `This section is full`. Re-seed before repeating.
