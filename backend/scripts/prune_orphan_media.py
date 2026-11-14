"""Find — and optionally remove — media files with no database row.

Every image the admin serves lives twice: a row in `media_assets` and a file
under `storage/media`. Deleting through the admin removes both. Deleting a
*site* used to remove only the rows, so the files stayed on disk and, because
/storage/media is a public static mount, stayed readable at their original URLs
with nothing left in the database pointing at them. (That leak is fixed in
delete_site; this script clears what it already left behind.)

Dry run by default — it prints what it would remove and touches nothing:

    docker compose -f docker-compose.prod.yml exec backend \
        python scripts/prune_orphan_media.py

Add --delete once the list looks right:

    docker compose -f docker-compose.prod.yml exec backend \
        python scripts/prune_orphan_media.py --delete

Only files older than --min-age-hours (default 24) are ever considered, so an
upload that is mid-flight — the row is written after the file — is never taken
for an orphan.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.modules.media.models import MediaAsset  # noqa: E402

MEDIA_ROOT = Path("storage/media")


def _human(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f}{unit}" if unit == "B" else f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}GB"


async def _known_keys() -> set[str]:
    """Every filename the database still refers to.

    Both `storage_key` and the tail of `url` are collected: older rows predate
    storage_key and carry the name only in the url, and treating one of those
    as an orphan would delete a live image.
    """
    engine = create_async_engine(settings.database_url)
    try:
        async with AsyncSession(engine) as session:
            assets = (await session.execute(select(MediaAsset))).scalars().all()
    finally:
        await engine.dispose()

    keys: set[str] = set()
    for asset in assets:
        if asset.storage_key:
            keys.add(asset.storage_key)
        if asset.url:
            keys.add(Path(asset.url).name)
    return keys


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--delete", action="store_true", help="actually remove the files")
    parser.add_argument("--min-age-hours", type=float, default=24.0)
    args = parser.parse_args()

    if not MEDIA_ROOT.is_dir():
        print(f"no media directory at {MEDIA_ROOT.resolve()}")
        return 1

    keys = await _known_keys()
    cutoff = time.time() - args.min_age_hours * 3600

    orphans: list[Path] = []
    skipped_recent = 0
    for path in sorted(MEDIA_ROOT.iterdir()):
        if not path.is_file() or path.name in keys:
            continue
        if path.stat().st_mtime > cutoff:
            skipped_recent += 1
            continue
        orphans.append(path)

    total = sum(p.stat().st_size for p in orphans)
    print(f"{len(keys)} files referenced by the database")
    print(f"{len(orphans)} orphaned files, {_human(total)}")
    if skipped_recent:
        print(f"{skipped_recent} skipped as newer than {args.min_age_hours}h")

    for path in orphans:
        print(f"  {path.name}  {_human(path.stat().st_size)}")

    if not orphans:
        return 0
    if not args.delete:
        print("\ndry run — nothing removed. Re-run with --delete to remove these.")
        return 0

    removed = 0
    for path in orphans:
        try:
            path.unlink()
            removed += 1
        except OSError as exc:  # keep going; one bad file is not a reason to stop
            print(f"  could not remove {path.name}: {exc}")
    print(f"\nremoved {removed} of {len(orphans)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
