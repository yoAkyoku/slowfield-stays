#!/bin/sh
set -eu

# Release-managed media replacements. The live media directory is a named
# volume, so files present only in the image never reach an existing volume.
# Copy these explicit assets before the app starts; ordinary CMS uploads remain
# untouched because their UUID names do not appear in seed_media.
if [ -d /app/seed_media ]; then
  for source in /app/seed_media/*; do
    [ -f "$source" ] || continue
    cp "$source" "/app/storage/media/$(basename "$source")"
  done
fi

alembic upgrade head
# Existing rows are repaired after the API begins starting. A damaged legacy
# video must not hold every deployment unhealthy while FFmpeg reaches timeout.
python -m app.modules.media.backfill_posters &
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
