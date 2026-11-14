import asyncio
import logging
import os
import re
import subprocess
from typing import BinaryIO
from pathlib import Path
from uuid import uuid4

from xml.etree import ElementTree

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.admin.deps import get_admin_site, require_permission
from app.modules.media.models import MediaAsset
from app.modules.sites.models import Site

logger = logging.getLogger(__name__)
router = APIRouter()
MEDIA_ROOT = Path("storage/media")
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)


def media_path(storage_key: str) -> Path | None:
    """The file for a storage key, or None if it would escape the media root.

    Keys are generated server-side (`uuid4().hex + suffix`) and never come from
    a request, so this is defence in depth rather than a known hole — but the
    delete path joined a database value straight onto a directory, and the
    check that makes that safe belongs next to the join rather than in the
    reader's head. A row written by an older version, a restored backup, or a
    future import path only has to be wrong once.
    """
    key = (storage_key or "").strip()
    if not key:
        return None
    candidate = (MEDIA_ROOT / key).resolve()
    root = MEDIA_ROOT.resolve()
    if candidate == root or root not in candidate.parents:
        logger.warning("Refusing media path outside the media root: %r", storage_key)
        return None
    return candidate

# ---------------------------------------------------------------------------
# Upload safety: allowed extensions, max size, and magic-byte signatures
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS: set[str] = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif",
    ".mp4", ".webm",
    ".pdf",
}
MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB
VIDEO_EXTENSIONS = {".mp4", ".webm"}
_VIDEO_POSTER_SEMAPHORE = asyncio.Semaphore(1)


def video_poster_key(storage_key: str) -> str:
    """Versioned sibling key, so improved extraction refreshes old posters."""
    path = Path(storage_key)
    return f"{path.stem}.poster-v2.jpg"


def extract_video_poster(video_path: Path, poster_path: Path) -> bool:
    """Persist a representative early frame through an atomic temporary file.

    Taking a single frame at 0.1 seconds captured the black fade-in on some
    uploads. Sample the first 100 frames and let FFmpeg's thumbnail filter
    choose the most representative frame instead. The stored JPEG can then be
    shown without asking the browser to decode the full video just to paint a
    picker tile.
    """
    temporary_path = poster_path.with_name(f"{poster_path.stem}.tmp{poster_path.suffix}")
    try:
        subprocess.run(
            [
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                "-i", str(video_path),
                "-vf", "scale=1280:-2:force_original_aspect_ratio=decrease,thumbnail=100",
                "-frames:v", "1",
                "-threads", "1", "-q:v", "3", str(temporary_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if not temporary_path.is_file() or temporary_path.stat().st_size == 0:
            return False
        os.replace(temporary_path, poster_path)
        return True
    except (FileNotFoundError, subprocess.SubprocessError, OSError):
        logger.warning("Could not generate video poster for %s", video_path, exc_info=True)
        return False
    finally:
        temporary_path.unlink(missing_ok=True)


async def generate_video_poster(video_path: Path, poster_path: Path) -> bool:
    """Bound expensive decoding to one process per API worker."""
    async with _VIDEO_POSTER_SEMAPHORE:
        return await asyncio.to_thread(extract_video_poster, video_path, poster_path)

# Bytes that identify each format, as (offset, signature) pairs. A file matches
# its extension when any one pair matches — several brands mean the same format.
# Offsets matter for the ISOBMFF types, where the first four bytes are a box
# length and the identifying bytes start at 4.
_MAGIC_BY_EXT: dict[str, tuple[tuple[int, bytes], ...]] = {
    ".jpg":  ((0, b"\xff\xd8\xff"),),
    ".jpeg": ((0, b"\xff\xd8\xff"),),
    ".png":  ((0, b"\x89PNG\r\n\x1a\n"),),
    ".gif":  ((0, b"GIF8"),),
    # RIFF alone is shared with .wav; the WEBP form type is the actual marker.
    ".webp": ((8, b"WEBP"),),
    ".pdf":  ((0, b"%PDF"),),
    ".mp4":  ((4, b"ftyp"),),
    # AVIF was skipped here as having "no simple magic bytes". It is ISOBMFF
    # like mp4, so it does: the ftyp box, then one of its brands.
    ".avif": ((4, b"ftypavif"), (4, b"ftypavis"), (4, b"ftypmif1"), (4, b"ftypmsf1")),
    ".webm": ((0, b"\x1a\x45\xdf\xa3"),),  # EBML header
}


# Elements and attributes an uploaded SVG may keep. Anything absent is dropped
# rather than patched: a logo needs shapes, not behaviour.
_SVG_ALLOWED_TAGS = {
    "svg", "g", "defs", "title", "desc", "path", "rect", "circle", "ellipse",
    "line", "polyline", "polygon", "text", "tspan", "use", "symbol",
    "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern",
}
_SVG_ALLOWED_ATTRS = {
    "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
    "width", "height", "viewBox", "points", "transform", "fill", "stroke",
    "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
    "stroke-miterlimit", "opacity", "fill-opacity", "stroke-opacity",
    "fill-rule", "clip-rule", "clip-path", "mask", "offset", "stop-color",
    "stop-opacity", "gradientUnits", "gradientTransform", "patternUnits",
    "id", "class", "xmlns", "version", "preserveAspectRatio", "font-size",
    "font-family", "font-weight", "text-anchor", "dominant-baseline",
}


def _sanitize_svg(content: bytes) -> bytes:
    """Rebuild an SVG from an allow-list of elements and attributes.

    This replaced a strip-what-looks-dangerous pass, which could be walked
    around: its event-handler pattern required whitespace before the attribute,
    so `<circle/onload=…>` kept its handler, and an entity-encoded
    `javascript&#58;` never matched the URL pattern at all. Rebuilding keeps
    only what is named below, so an attribute nobody thought of cannot survive
    by being spelled unusually.

    Uploads are also served with a sandbox CSP (see main.py); this is the other
    half of that, so a file is safe on its own terms and not only in the
    context we happen to serve it from.
    """
    # Without this the rebuilt file comes back as <ns0:svg xmlns:ns0="…">, which
    # renders but is needlessly unlike what was uploaded.
    ElementTree.register_namespace("", "http://www.w3.org/2000/svg")
    ElementTree.register_namespace("xlink", "http://www.w3.org/1999/xlink")

    text = content.decode("utf-8", errors="replace")
    # Entity declarations have no place in a logo and are how XML parsers get
    # talked into expanding or fetching things.
    if re.search(r"<!\s*(DOCTYPE|ENTITY)", text, re.IGNORECASE):
        raise HTTPException(status_code=422, detail="SVG must not declare a DOCTYPE or entities")

    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError as exc:
        raise HTTPException(status_code=422, detail="SVG could not be parsed") from exc

    def local(name: str) -> str:
        return name.rsplit("}", 1)[-1]

    def clean(node) -> bool:
        """Strip a node's attributes; return False when the node itself must go."""
        if local(node.tag) not in _SVG_ALLOWED_TAGS:
            return False
        for key in list(node.attrib):
            name = local(key)
            if name in {"href", "xlink:href"} or name.endswith("href"):
                # Only same-document references — never an external fetch.
                if not str(node.attrib[key]).startswith("#"):
                    del node.attrib[key]
                continue
            if name not in _SVG_ALLOWED_ATTRS:
                del node.attrib[key]
        for child in list(node):
            if not clean(child):
                node.remove(child)
        return True

    if not clean(root):
        raise HTTPException(status_code=422, detail="SVG root element is not an <svg>")
    return ElementTree.tostring(root, encoding="utf-8", xml_declaration=True)


async def _read_capped(file: UploadFile) -> bytes:
    """Read the body in chunks, refusing past the cap instead of after it.

    The size check used to run on an object that was already fully in memory:
    Starlette spools a large upload to a temp file, and `.read()` then pulled all
    of it into the worker's heap before anyone asked how big it was. Production
    runs two workers, so two concurrent oversized posts took the API down —
    reachable by any admin or editor linked to any site.
    """
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(64 * 1024):
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=422,
                detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _validate_upload(filename: str | None, content: bytes, content_size: int | None = None) -> str:
    """Return a validated lowercase extension or raise 422."""
    suffix = Path(filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"File type '{suffix or '(none)'}' is not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    if (len(content) if content_size is None else content_size) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit")
    # SVG is the one format with no signature; it is held safe by sanitising its
    # markup instead, which is a stronger check than any byte prefix would be.
    signatures = _MAGIC_BY_EXT.get(suffix)
    if signatures and not any(
        content[offset:offset + len(sig)] == sig for offset, sig in signatures
    ):
        raise HTTPException(status_code=422, detail="File content does not match its extension")
    return suffix


def _copy_file_capped(source: BinaryIO, target: Path) -> tuple[bytes, int]:
    """Copy a spooled upload to disk without materialising it in RAM."""
    source.seek(0)
    total = 0
    prefix = bytearray()
    with target.open("wb") as destination:
        while chunk := source.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=422,
                    detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
                )
            if len(prefix) < 32:
                prefix.extend(chunk[: 32 - len(prefix)])
            destination.write(chunk)
    return bytes(prefix), total


def _asset_payload(asset: MediaAsset, request: Request | None = None) -> dict[str, object]:
    url = asset.url
    return {
        "id": asset.id,
        "url": url,
        "file": asset.storage_key or url,
        "alt": asset.alt_text,
        "alt_text": asset.alt_text,
        "type": asset.mime_type,
        "mime_type": asset.mime_type,
        "storage_key": asset.storage_key,
        "display_name": asset.display_name or asset.storage_key or Path(url).name,
        "poster_url": asset.poster_url,
        "created_at": asset.created_at,
    }


# Both routes below scope the site with `get_admin_site`, not `resolve_site`.
# They used to take the site from `?site=` and check only that the caller was
# *some* admin, so an admin linked to one villa could read — and, worse, upload
# into — any other tenant's library by editing the query string. The
# `/admin/media` twins were tenant-scoped all along, which is what made the gap
# easy to miss: the same operation refused on one path and succeeded on the other.
# The permission half of that gap outlived the tenant half: these two carried no
# media:read / media:write dependency while the twins did, so a custom site role
# without media rights was refused on one path and served on this one.
@router.get("", dependencies=[Depends(require_permission("media:read"))])
async def list_media_assets(
    request: Request,
    current_site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    try:
        assets = (
            await session.execute(
                select(MediaAsset).where(MediaAsset.site_id == current_site.id).order_by(MediaAsset.id.desc())
            )
        ).scalars().all()
        return [_asset_payload(asset, request) for asset in assets]
    except Exception:
        logger.warning("Failed to list media assets", exc_info=True)
        return []


@router.post("", status_code=201, dependencies=[Depends(require_permission("media:write"))])
async def upload_media_asset(
    request: Request,
    current_site: Site = Depends(get_admin_site),
    file: UploadFile = File(...),
    alt_text: str = Form(default=""),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    return await store_media_asset(request, session, current_site.id, file, alt_text)


async def store_media_asset(
    request: Request,
    session: AsyncSession,
    site_id: int,
    file: UploadFile,
    alt_text: str,
) -> dict[str, object]:
    """Validate and store one upload against a site the caller already owns.

    Split out so the admin route can decide the site with `get_admin_site`
    instead of the query string. Reusing the public handler wholesale meant an
    admin of one villa could pass `?site=` for another and file media under it,
    while the read and delete routes beside it were tenant-scoped.
    """
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"File type '{suffix or '(none)'}' is not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    storage_key = f"{uuid4().hex}{suffix}"
    target = media_path(storage_key)
    if target is None:  # pragma: no cover - a generated uuid cannot fail this
        raise HTTPException(status_code=500, detail="Could not store the upload")
    try:
        if suffix == ".svg":
            content = _sanitize_svg(await _read_capped(file))
            await asyncio.to_thread(target.write_bytes, content)
        else:
            prefix, total = await asyncio.to_thread(_copy_file_capped, file.file, target)
            _validate_upload(file.filename, prefix, total)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    display_name = (file.filename or storage_key).replace("\\", "/").rsplit("/", 1)[-1][:260] or storage_key
    poster_url = ""
    if suffix in VIDEO_EXTENSIONS:
        poster_key = video_poster_key(storage_key)
        poster_path = media_path(poster_key)
        if poster_path is not None and await generate_video_poster(target, poster_path):
            poster_url = f"/storage/media/{poster_key}"
        else:
            target.unlink(missing_ok=True)
            raise HTTPException(
                status_code=422,
                detail="Video could not be decoded. Upload an H.264 MP4 or WebM file.",
            )
    asset = MediaAsset(
        site_id=site_id,
        url=f"/storage/media/{storage_key}",
        alt_text=alt_text,
        mime_type=file.content_type or "application/octet-stream",
        storage_key=storage_key,
        display_name=display_name,
        poster_url=poster_url,
    )
    session.add(asset)
    await session.commit()
    await session.refresh(asset)
    return _asset_payload(asset, request)
