#!/usr/bin/env bash
# Local test stack: a throwaway database + API, isolated from production.
#
# Why this exists: the pre-deploy test pass has to create, edit and delete
# content, and the checked-in frontend/.env.local points at the production API,
# so testing against it would write to live data. This gives the tests somewhere
# safe to do that. It was first built by hand, and the container was lost
# mid-pass with no way to recreate it; now it is one command.
#
#   bash scripts/local-test-stack.sh up      start db + api and seed
#   bash scripts/local-test-stack.sh reseed  wipe content and seed again
#   bash scripts/local-test-stack.sh down    remove the container
#   bash scripts/local-test-stack.sh status  what is running
#
# Deliberately off the standard ports (55432 / 8010) so it cannot collide with
# a real Postgres on 5432 or a normal backend on 8000.
set -euo pipefail

CONTAINER=slowfield-localtest-db
DB_PORT=55432
API_PORT=8010
DB_NAME=slowfield_test
DB_USER=staycation
DB_PASS=localtest
ADMIN_EMAIL=admin@example.com
ADMIN_PASS=admin123

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"
export SECRET_KEY="localtest-only-not-a-real-key"
export APP_ENV=development
export CORS_ORIGINS="http://localhost:3000"
export ADMIN_BOOTSTRAP_EMAIL="$ADMIN_EMAIL"
export ADMIN_BOOTSTRAP_PASSWORD="$ADMIN_PASS"

start_db() {
  if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "db already running"
  else
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker run -d --name "$CONTAINER" \
      -e POSTGRES_DB="$DB_NAME" -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASS" \
      -p "${DB_PORT}:5432" postgres:16-alpine >/dev/null
    echo "db container started"
  fi
  for _ in $(seq 1 30); do
    if docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      echo "db accepting connections"; return 0
    fi
    sleep 2
  done
  echo "db never became ready" >&2; exit 1
}

# Migrations run every time, before anything asks the database for data.
# Gating them on a health check was wrong twice over: /healthz answers without
# touching the database, so a stale API left over from a previous container
# reported "already up" and the seed then ran against an empty, tableless
# database. Alembic is idempotent, so running it unconditionally costs nothing.
migrate() {
  cd "$ROOT/backend"
  python -m alembic upgrade head >/dev/null
  echo "migrations applied"
}

# pkill does not match Windows' python.exe under Git Bash, so the process is
# found the way Windows knows it.
stop_api() {
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -like '*uvicorn*${API_PORT}*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1 || true
  sleep 2
  echo "api stopped"
}

start_api() {
  if curl -sf --max-time 5 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1; then
    echo "api already up"; return 0
  fi
  cd "$ROOT/backend"
  nohup python -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT" \
    > "$ROOT/backend/local-api.log" 2>&1 &
  for _ in $(seq 1 30); do
    if curl -sf --max-time 5 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1; then
      echo "api up on ${API_PORT}"; return 0
    fi
    sleep 2
  done
  echo "api never came up, see backend/local-api.log" >&2; exit 1
}

seed() {
  cd "$ROOT/backend"
  python scripts/seed_multisite.py \
    --api "http://127.0.0.1:${API_PORT}/api/v1" \
    --email "$ADMIN_EMAIL" --password "$ADMIN_PASS" 2>&1 | tail -5
}

# The seed creates rows; it does not reconcile them. Run against a database that
# already holds them and it dies on the first duplicate slug, having half-written
# whatever came before — so "reseed" has to mean an empty schema, not a rerun.
# It said it wiped content and did not, which is worse than not offering it.
wipe() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -q \
    -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);" \
    -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null
  echo "database dropped and recreated"
}

case "${1:-up}" in
  up)     start_db; migrate; start_api; seed; echo; echo "admin: ${ADMIN_EMAIL} / ${ADMIN_PASS}" ;;
  # The API holds pooled connections to the database being dropped, so it is
  # stopped first and started again after; leaving it up makes DROP DATABASE
  # block until it gives up.
  reseed) start_db; stop_api; wipe; migrate; start_api; seed ;;
  down)   docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; echo "db removed (api, if running, will error until 'up')" ;;
  status)
    docker ps -a --filter "name=${CONTAINER}" --format 'db: {{.Names}} {{.Status}}' || true
    curl -sf --max-time 5 "http://127.0.0.1:${API_PORT}/healthz" >/dev/null 2>&1 \
      && echo "api: up on ${API_PORT}" || echo "api: not responding on ${API_PORT}"
    ;;
  *) echo "usage: $0 {up|reseed|down|status}" >&2; exit 2 ;;
esac
