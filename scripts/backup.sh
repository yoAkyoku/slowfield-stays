#!/usr/bin/env bash
#
# Back up the database and the uploaded media, and PROVE the backup is readable
# before counting it.
#
# There were no backups at all. Everything the client owns lives in two places:
# the Postgres volume (pages, stays, bookings, inquiries, the newsletter list)
# and the media volume (every photograph anyone has uploaded). A dropped volume,
# a bad migration, or `docker compose down -v` typed once ends both, and the
# site is content — there is no re-deriving it from source.
#
# A backup nobody restores is a rumour, so this does not just write files:
#   * the database dump is in pg_dump's custom format and is re-read with
#     `pg_restore --list`, which fails on a truncated or empty dump;
#   * the media archive is listed back with `tar -tzf`;
#   * a run that cannot verify BOTH exits non-zero and deletes nothing.
#
# Retention deletes only what is older than KEEP_DAYS, and refuses to run at all
# if that would leave no backups behind — the failure mode of a rotation script
# is deleting the good copies after writing a bad one.
#
# Usage:   bash scripts/backup.sh [destination-dir]
# Default: ./backups   (override with BACKUP_DIR, or the first argument)
# Cron:    see DEPLOY.md — this is meant to run unattended, daily.
#
# THIS HOST ONLY. A copy that lives on the same disk as the thing it backs up is
# not a backup of that disk. Ship the directory off-box (rsync/rclone/S3) as a
# second step; DEPLOY.md says so too.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

DEST="${1:-${BACKUP_DIR:-$ROOT/backups}}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE="docker compose -f docker-compose.prod.yml"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$1" >&2; exit 1; }

mkdir -p "$DEST"
# The dump carries subscriber addresses, password hashes and the encrypted SMTP
# credentials. It has no business being world-readable.
chmod 700 "$DEST"

DB_FILE="$DEST/db-$STAMP.dump"
MEDIA_FILE="$DEST/media-$STAMP.tar.gz"

# ---------------------------------------------------------------------------
# 1. Database
# ---------------------------------------------------------------------------
say "Dumping the database"
$COMPOSE ps db >/dev/null 2>&1 || fail "the db service is not up — start the stack first"

# --format=custom, not plain SQL: it compresses, and pg_restore can read it
# selectively and refuses to read a truncated one, which is what makes the
# verification below meaningful.
$COMPOSE exec -T db pg_dump \
  --username=staycation \
  --dbname=slowfield \
  --format=custom \
  --no-owner \
  > "$DB_FILE" || fail "pg_dump failed — no backup was written"

chmod 600 "$DB_FILE"

say "Verifying the dump can be read back"
OBJECTS="$(pg_restore --list "$DB_FILE" 2>/dev/null | grep -c '^[0-9]' || true)"
if [ -z "$OBJECTS" ] || [ "$OBJECTS" -lt 10 ]; then
  # Fall back to the container's pg_restore when the host has no postgres tools.
  OBJECTS="$($COMPOSE exec -T db pg_restore --list /dev/stdin < "$DB_FILE" 2>/dev/null | grep -c '^[0-9]' || true)"
fi
[ -n "$OBJECTS" ] && [ "$OBJECTS" -ge 10 ] \
  || fail "the dump lists $OBJECTS objects — it is truncated or empty. Keeping it for inspection: $DB_FILE"
printf '  ok  %s objects in the dump (%s)\n' "$OBJECTS" "$(du -h "$DB_FILE" | cut -f1)"

# ---------------------------------------------------------------------------
# 2. Uploaded media
# ---------------------------------------------------------------------------
say "Archiving uploaded media"
# Read straight out of the named volume with a throwaway container, so this does
# not depend on where the backend happens to mount it.
docker run --rm \
  -v "$($COMPOSE config --format json 2>/dev/null | grep -o '"[a-z_-]*_media"' | head -1 | tr -d '"' || echo slowfield_media)":/media:ro \
  alpine:3 tar -czf - -C /media . > "$MEDIA_FILE" 2>/dev/null \
  || $COMPOSE exec -T backend tar -czf - -C /app/storage/media . > "$MEDIA_FILE" \
  || fail "could not archive the media volume"

chmod 600 "$MEDIA_FILE"
FILES="$(tar -tzf "$MEDIA_FILE" 2>/dev/null | wc -l || echo 0)"
[ "$FILES" -ge 1 ] || fail "the media archive lists $FILES entries — keeping it for inspection: $MEDIA_FILE"
printf '  ok  %s entries archived (%s)\n' "$FILES" "$(du -h "$MEDIA_FILE" | cut -f1)"

# ---------------------------------------------------------------------------
# 3. Retention — only after both verifications passed
# ---------------------------------------------------------------------------
say "Pruning backups older than $KEEP_DAYS days"
SURVIVORS="$(find "$DEST" -maxdepth 1 -name 'db-*.dump' -mtime "-$KEEP_DAYS" | wc -l)"
if [ "$SURVIVORS" -lt 1 ]; then
  printf '  skipped: pruning would leave no database backup at all\n'
else
  find "$DEST" -maxdepth 1 \( -name 'db-*.dump' -o -name 'media-*.tar.gz' \) \
    -mtime "+$KEEP_DAYS" -print -delete | sed 's/^/  removed /'
  printf '  %s database backup(s) within the retention window\n' "$SURVIVORS"
fi

say "Done"
printf '  %s\n  %s\n' "$DB_FILE" "$MEDIA_FILE"
printf '\n  Copy these off this host. A backup on the same disk as the original\n'
printf '  does not survive the failure it exists for.\n'
