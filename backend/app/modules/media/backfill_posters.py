"""Generate poster JPEGs for video assets uploaded before poster support."""

import asyncio
from pathlib import Path

from sqlalchemy import select

from app.db.session import SessionLocal
from app.modules.media.models import MediaAsset
from app.modules.media.routes import (
    VIDEO_EXTENSIONS,
    extract_video_poster,
    media_path,
    video_poster_key,
)


async def backfill() -> int:
    updated = 0
    async with SessionLocal() as session:
        assets = (
            await session.execute(
                select(MediaAsset).order_by(MediaAsset.id)
            )
        ).scalars().all()
        for asset in assets:
            storage_key = asset.storage_key or Path(asset.url).name
            if Path(storage_key).suffix.lower() not in VIDEO_EXTENSIONS:
                continue
            source = media_path(storage_key)
            poster_key = video_poster_key(storage_key)
            poster = media_path(poster_key)
            if source is None or poster is None or not source.is_file():
                continue
            if asset.poster_url == f"/storage/media/{poster_key}" and poster.is_file():
                continue
            # Always regenerate while the row is blank. A previous container
            # may have stopped halfway through a JPEG, or it may point to the
            # old 0.1-second black-prone poster. Extraction writes to a versioned
            # temporary sibling and updates the row only after success.
            if await asyncio.to_thread(extract_video_poster, source, poster):
                asset.poster_url = f"/storage/media/{poster_key}"
                updated += 1
        if updated:
            await session.commit()
    print(f"Video poster backfill: {updated} updated")
    return updated


if __name__ == "__main__":
    asyncio.run(backfill())
