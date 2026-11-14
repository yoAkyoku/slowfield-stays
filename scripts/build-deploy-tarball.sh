#!/usr/bin/env bash
#
# Build the production deploy bundle, and prove it is correct before shipping.
#
# This step existed only as a command someone typed. The last outage came from
# exactly here: a blanket `node_modules` exclusion removed
# .next/standalone/node_modules, the deploy "succeeded", and the site went down
# — because the packaging rule lived in a shell history rather than in a file
# anything could check.
#
# So the rules are here, and the script refuses to produce a bundle that
# violates them. Both directions are verified: things that MUST be absent
# (secrets, caches, local virtualenvs) and things that MUST be present (the
# standalone server and its dependencies, the build id, the migrations).
#
# Usage:  bash scripts/build-deploy-tarball.sh
# Output: deploy.tar.gz in the repository root
#
# It does NOT deploy. Copy the bundle to the server and follow DEPLOY.md.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$ROOT/deploy.tar.gz"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Build the frontend
# ---------------------------------------------------------------------------
# NEXT_PUBLIC_* values are substituted into the bundle at build time — including
# the server bundle — so whatever is in .env.local is what ships. STORAGE_PROXY_ORIGIN
# in particular gets baked into routes-manifest.json as a rewrite to the public
# domain; it is inert today only because Caddy intercepts /storage first.
# Unset the ones that must not be frozen in.
if [ "${SKIP_FRONTEND_BUILD:-0}" = "1" ]; then
  say "Using an existing production frontend build"
else
  say "Building frontend (production)"
  (
    cd frontend
    unset STORAGE_PROXY_ORIGIN
    # NEXT_PUBLIC_* is frozen into browser chunks at build time. Runtime
    # compose values cannot replace it. Use Caddy's same-origin API route,
    # never the source's localhost fallback or a developer's .env.local.
    unset NEXT_PUBLIC_API_URL INTERNAL_API_URL
    unset NEXT_FONT_GOOGLE_MOCKED_RESPONSES
    STORAGE_PROXY_ORIGIN= NEXT_PUBLIC_API_URL=/api/v1 NEXT_PUBLIC_APP_ENV=production npm run build
  )
fi

[ -d frontend/.next/standalone ] || fail "next build produced no standalone output — is output:'standalone' still set in next.config.mjs?"

# ---------------------------------------------------------------------------
# 2. Pack
# ---------------------------------------------------------------------------
# Dockerfile.deploy.dockerignore DOES ship, and the plain .dockerignore must not.
# BuildKit prefers `<dockerfile>.dockerignore`, so shipping the specific one makes
# the build deterministic no matter what a previous deploy left on the server —
# and what it may have left is a `frontend/.dockerignore` that excludes `.next`,
# which is the entire payload, so the build would die at `COPY .next/standalone`.
#
# `.next/standalone/node_modules` is NOT excluded — it is the server's
# dependency tree and the deployment does not install anything. The blanket
# `node_modules` exclusion that caused the outage is deliberately absent; only
# the source trees' own node_modules are dropped.
say "Packing $OUT"
rm -f "$OUT"
tar -czf "$OUT" \
  --exclude='./.git' \
  --exclude='./deploy.tar.gz' \
  --exclude='./frontend/node_modules' \
  --exclude='./frontend/.next/cache' \
  --exclude='./backend/.venv' \
  --exclude='./backend/tests' \
  --exclude='./backend/storage/media' \
  --exclude='./backups' \
  --exclude='*/__pycache__' \
  --exclude='*.pyc' \
  --exclude='*.log' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.dockerignore*' \
  ./frontend/.next ./frontend/public ./frontend/package.json \
  ./frontend/Dockerfile.deploy ./frontend/Dockerfile.deploy.dockerignore \
  ./frontend/next.config.mjs \
  ./backend ./docker-compose.prod.yml ./Caddyfile

# ---------------------------------------------------------------------------
# 3. Verify — both directions
# ---------------------------------------------------------------------------
say "Verifying bundle"
LIST="$(mktemp)"
tar -tzf "$OUT" > "$LIST"
trap 'rm -f "$LIST"' EXIT

# 3a. Nothing secret or machine-local may be in here.
for pattern in '\.env$' '\.env\.' '\.venv/' '__pycache__' '\.pyc$' '\.log$' '^\./\.git/' 'storage/media/' '^\./backups/' '\.dump$'; do
  n="$(grep -cE "$pattern" "$LIST" || true)"
  [ "$n" -eq 0 ] || fail "$n entries match forbidden pattern '$pattern' — inspect: tar -tzf $OUT | grep -E '$pattern'"
  printf '  ok  absent: %s\n' "$pattern"
done

# 3b. The things whose absence took the site down last time.
for required in \
  'frontend/.next/standalone/server.js' \
  'frontend/.next/standalone/node_modules/next/package.json' \
  'frontend/.next/standalone/.next/BUILD_ID' \
  'frontend/.next/static/' \
  'frontend/Dockerfile.deploy' \
  'frontend/Dockerfile.deploy.dockerignore' \
  'backend/requirements.lock' \
  'backend/alembic/versions/' \
  'backend/app/main.py' \
  'docker-compose.prod.yml' \
  'Caddyfile'
do
  grep -qF "$required" "$LIST" || fail "missing from bundle: $required"
  printf '  ok  present: %s\n' "$required"
done

MODS="$(grep -cF 'frontend/.next/standalone/node_modules/' "$LIST" || true)"
[ "$MODS" -gt 100 ] || fail "only $MODS entries under .next/standalone/node_modules — the standalone dependency tree is incomplete (this is the exact shape of the last outage)"
printf '  ok  standalone node_modules: %s entries\n' "$MODS"

# 3c. The migration head in the bundle, so a deploy cannot ship stale schema code.
say "Migrations in this bundle"
grep -oE 'backend/alembic/versions/[0-9]+_[a-z_]+\.py' "$LIST" | sort | tail -3 | sed 's/^/  /'

BUILD_ID="$(tar -xzOf "$OUT" ./frontend/.next/standalone/.next/BUILD_ID 2>/dev/null || tar -xzOf "$OUT" frontend/.next/standalone/.next/BUILD_ID)"
say "Bundle ready"
printf '  %s (%s)\n' "$OUT" "$(du -h "$OUT" | cut -f1)"
printf '  BUILD_ID: %s\n' "$BUILD_ID"
printf '\n  After deploying, confirm the live BUILD_ID changed to this value.\n'
printf '  A deploy that silently no-ops leaves the old one in place.\n'
