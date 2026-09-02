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

## Deploy on Render

This API is a long-running Node process (`src/server.ts` listens on `0.0.0.0` and `PORT`). Render is the host. Render **clones your Git repo as source**; the running service lives on Render.

Use a **Starter** (or higher) web service so the instance stays up. Free instances sleep; the in-process stale-payment job and the first request after idle will suffer.

### 1. Database

Keep Neon (or any Postgres). Use the **pooled** URL for `DATABASE_URL` and the **direct** URL for `DIRECT_URL`. Put the Render service in the **same region** as the database (Neon `us-east-2` → Render **Ohio**).

From your laptop, with production URLs in `.env`:

```bash
npx prisma migrate deploy
npm run db:seed   # optional demo data
```

`preDeployCommand` in `render.yaml` also runs `prisma migrate deploy` on every deploy.

### 2. Create the web service

1. Open [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**.
2. Connect the Git repository that contains this project. Root directory: repository root.
3. Settings:

| Field | Value |
|---|---|
| Runtime | Node |
| Instance region | Ohio (match Neon `us-east-2`) |
| Branch | `main` |
| Build command | `npm ci --include=dev && npm run build` |
| Pre-deploy command | `npx prisma migrate deploy` |
| Start command | `node dist/server.js` |
| Health check path | `/health` |

Or apply [render.yaml](render.yaml) with **New** → **Blueprint**.

Do **not** set `PORT` yourself. Render injects it; the app already reads `config.PORT`.

### 3. Environment variables (this is why the last deploy crashed)

Render never reads your laptop `.env`. If those keys are missing, `node dist/server.js` throws `expected string, received undefined`.

**Fastest (official Render UI):** Environment → **Add from .env** → paste your local `.env` → **Save, rebuild, and deploy**.

Do not use Secret Files for this. Secret Files are extra files on disk; they are not the same as Environment Variables. `DATABASE_URL` must appear under **Environment Variables**.

**Or** add these keys one by one under **Environment** (copy values from local `.env`):

`DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL`, `NODE_ENV=production`, plus Cloudinary / SMTP / Redis if you use them.

Do **not** set `PORT`. After saving, deploy again. Saving env vars does not restart an already-failed deploy by itself.

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `NODE_VERSION` | yes | `20` |
| `DATABASE_URL` | yes | Neon pooled URL (`sslmode=require`) |
| `DIRECT_URL` | yes | Neon direct URL (migrations) |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 characters |
| `JWT_REFRESH_SECRET` | yes | ≥ 32 characters, different from access |
| `CLIENT_URL` | yes | Frontend origin (CORS + cookies) |
| `CLOUDINARY_CLOUD_NAME` | for avatars | |
| `CLOUDINARY_API_KEY` | for avatars | |
| `CLOUDINARY_API_SECRET` | for avatars | |
| `STRIPE_SECRET_KEY` | for payments | |
| `STRIPE_WEBHOOK_SECRET` | for payments | From Stripe after you add the webhook URL |
| `PAYMENT_SUCCESS_URL` | yes | e.g. `https://your-frontend/payment/success` |
| `PAYMENT_CANCEL_URL` | yes | e.g. `https://your-frontend/payment/cancel` |
| `PAYMENT_GATEWAY` | no | default `STRIPE` |
| `DEFAULT_CURRENCY` | no | default `BDT` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no | Emails skipped if `SMTP_HOST` is empty |
| `REDIS_URL` | no | Cache degrades if empty |
| `GOOGLE_CLIENT_ID` | no | Google sign-in |
| `PG_POOL_MAX` | no | `10` is fine on a single Render process |
| `CRON_SECRET` | if you add a Cron Job | Bearer token for `GET /api/v1/payments/expire-stale` |

### 4. Deploy and verify

**Manual Deploy** → **Deploy latest commit**. Wait until the log shows `All is OK` and health checks pass.

```bash
bash scripts/verify-deployment.sh https://<your-service>.onrender.com
```

- Health: `GET https://<your-service>.onrender.com/health`
- Stripe webhook: `https://<your-service>.onrender.com/api/v1/payments/webhook`
- Stale payments: the web process runs `setInterval` while it is awake. On a sleeping Free instance, add a Render **Cron Job** (`GET /api/v1/payments/expire-stale` with `Authorization: Bearer $CRON_SECRET`) every hour.

### 5. After the URL exists

Update Stripe webhook, `CLIENT_URL`, and payment success/cancel URLs to the real Render and frontend origins, then restart the service.

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
