#!/usr/bin/env bash
# Hit the production-critical path against a running API.
# Usage: bash scripts/verify-deployment.sh http://localhost:5001
#
# Local default PORT is 5001 (.env.example). If you set PORT=5000, pass that origin.

set -u

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/verify-deployment.sh <base-url>"
  echo "Example: bash scripts/verify-deployment.sh http://localhost:5001"
  exit 2
fi

BASE="${1%/}"
ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@bidyapith.edu}"
ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-Admin1234}"
STUDENT_EMAIL="${SEED_STUDENT_EMAIL:-student01@bidyapith.edu}"
STUDENT_PASSWORD="${SEED_STUDENT_PASSWORD:-Student1234}"

PASS=0
FAIL=0

ok() {
  PASS=$((PASS + 1))
  echo "PASS  $1"
}

bad() {
  FAIL=$((FAIL + 1))
  echo "FAIL  $1"
  if [[ -n "${2:-}" ]]; then
    echo "      $2"
  fi
}

echo "Verifying ${BASE}"
echo

# 1. Health
health_code="$(curl -sS -o /tmp/bidya-health.json -w '%{http_code}' "${BASE}/health" || true)"
if [[ "${health_code}" == "200" ]]; then
  ok "1. GET /health responds"
else
  bad "1. GET /health responds" "HTTP ${health_code}"
fi

# 2. Admin login
login_code="$(curl -sS -o /tmp/bidya-admin-login.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  "${BASE}/api/v1/auth/login" || true)"
ADMIN_TOKEN=""
if [[ "${login_code}" == "200" ]]; then
  ADMIN_TOKEN="$(python3 -c 'import json; print(json.load(open("/tmp/bidya-admin-login.json")).get("data",{}).get("accessToken",""))')"
fi
if [[ -n "${ADMIN_TOKEN}" ]]; then
  ok "2. Admin login returns a token"
else
  bad "2. Admin login returns a token" "HTTP ${login_code}"
fi

# 3. Authenticated request
me_code="$(curl -sS -o /tmp/bidya-me.json -w '%{http_code}' \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BASE}/api/v1/users/me" || true)"
if [[ "${me_code}" == "200" ]]; then
  ok "3. Authenticated GET /api/v1/users/me succeeds"
else
  bad "3. Authenticated GET /api/v1/users/me succeeds" "HTTP ${me_code}"
fi

# 4. Missing token
unauth_code="$(curl -sS -o /tmp/bidya-unauth.json -w '%{http_code}' \
  "${BASE}/api/v1/users/me" || true)"
if [[ "${unauth_code}" == "401" ]]; then
  ok "4. Same request without a token returns 401"
else
  bad "4. Same request without a token returns 401" "HTTP ${unauth_code}"
fi

# 5. Student vs admin route
student_login_code="$(curl -sS -o /tmp/bidya-student-login.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${STUDENT_EMAIL}\",\"password\":\"${STUDENT_PASSWORD}\"}" \
  "${BASE}/api/v1/auth/login" || true)"
STUDENT_TOKEN=""
if [[ "${student_login_code}" == "200" ]]; then
  STUDENT_TOKEN="$(python3 -c 'import json; print(json.load(open("/tmp/bidya-student-login.json")).get("data",{}).get("accessToken",""))')"
fi
forbid_code="$(curl -sS -o /tmp/bidya-forbid.json -w '%{http_code}' \
  -H "Authorization: Bearer ${STUDENT_TOKEN}" \
  "${BASE}/api/v1/admin/users" || true)"
if [[ "${forbid_code}" == "403" ]]; then
  ok "5. Student token against an admin route returns 403"
else
  bad "5. Student token against an admin route returns 403" "HTTP ${forbid_code}"
fi

# 6. Structured validation envelope (register, not login — login is rate-limited)
val_code="$(curl -sS -o /tmp/bidya-validation.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email"}' \
  "${BASE}/api/v1/auth/register" || true)"
val_ok="$(python3 - <<'PY'
import json
try:
    body = json.load(open("/tmp/bidya-validation.json"))
except Exception:
    print("no")
    raise SystemExit
ok = (
    body.get("success") is False
    and body.get("statusCode") == 422
    and isinstance(body.get("errors"), list)
    and len(body.get("errors")) > 0
    and "path" in body["errors"][0]
    and "message" in body["errors"][0]
)
print("yes" if ok else "no")
PY
)"
if [[ "${val_code}" == "422" && "${val_ok}" == "yes" ]]; then
  ok "6. Validation error returns the structured error envelope"
else
  bad "6. Validation error returns the structured error envelope" "HTTP ${val_code} envelope=${val_ok}"
fi

# 7. Current semester is in registration with a live window
sem_code="$(curl -sS -o /tmp/bidya-semester.json -w '%{http_code}' \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "${BASE}/api/v1/semesters/current" || true)"
sem_ok="$(python3 - <<'PY'
import json
try:
    body = json.load(open("/tmp/bidya-semester.json"))
except Exception:
    print("no")
    raise SystemExit
data = body.get("data") or {}
status = data.get("status")
open_flag = data.get("registrationOpen")
print("yes" if status == "REGISTRATION" and open_flag is True else "no")
print(f"status={status} registrationOpen={open_flag}", file=__import__('sys').stderr)
PY
)"
if [[ "${sem_code}" == "200" && "${sem_ok}" == "yes" ]]; then
  ok "7. GET /semesters/current is REGISTRATION and the window contains today"
else
  bad "7. GET /semesters/current is REGISTRATION and the window contains today" "HTTP ${sem_code}"
fi

echo
if [[ "${FAIL}" -eq 0 ]]; then
  echo "All ${PASS} checks passed."
  exit 0
fi

echo "${FAIL} failed, ${PASS} passed."
exit 1
