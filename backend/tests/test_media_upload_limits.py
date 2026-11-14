"""The upload cap, and the permission check the two media paths must agree on."""
import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException

from app.modules.media.routes import MAX_UPLOAD_BYTES, _copy_file_capped, _read_capped, router


def test_media_upload_limit_is_one_hundred_megabytes():
    assert MAX_UPLOAD_BYTES == 100 * 1024 * 1024


class _ChunkedUpload:
    """Stands in for Starlette's UploadFile: hands out fixed-size chunks."""

    def __init__(self, total: int, chunk: int = 64 * 1024) -> None:
        self.remaining = total
        self.chunk = chunk
        self.reads = 0

    async def read(self, size: int = -1) -> bytes:
        self.reads += 1
        n = min(self.chunk if size in (-1, 0) else size, self.remaining)
        self.remaining -= n
        return b"\x00" * n


def test_an_upload_at_the_limit_is_accepted():
    src = _ChunkedUpload(MAX_UPLOAD_BYTES)
    content = asyncio.run(_read_capped(src))
    assert len(content) == MAX_UPLOAD_BYTES


def test_an_oversized_upload_is_refused_before_it_is_all_buffered():
    # Four times the cap. The old code read the whole body first and only then
    # measured it, so the worker had already paid the memory cost.
    src = _ChunkedUpload(MAX_UPLOAD_BYTES * 4)
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(_read_capped(src))
    assert excinfo.value.status_code == 422
    # It stopped early: reading it all would have taken 4x this many chunks.
    assert src.remaining > MAX_UPLOAD_BYTES * 2


def test_large_binary_uploads_are_copied_to_disk_in_chunks(tmp_path):
    payload = b"\x00\x00\x00\x18ftyp" + (b"v" * (2 * 1024 * 1024))
    target = tmp_path / "video.mp4"
    prefix, total = _copy_file_capped(BytesIO(payload), target)
    assert prefix.startswith(b"\x00\x00\x00\x18ftyp")
    assert total == len(payload)
    assert target.read_bytes() == payload


def test_the_public_media_paths_carry_the_same_permissions_as_their_admin_twins():
    # get_admin_site proves the caller has *some* role on the site; it does not
    # prove they hold media rights. The /admin/media twins always required them.
    by_method = {tuple(sorted(r.methods))[0]: r for r in router.routes if r.path == ""}
    listing = by_method["GET"]
    upload = by_method["POST"]
    for route, needed in ((listing, "media:read"), (upload, "media:write")):
        # require_permission returns a closure, so the permission it guards is
        # only visible in the captured free variable.
        granted = {
            cell.cell_contents
            for dep in route.dependencies
            for cell in (dep.dependency.__closure__ or ())
            if isinstance(cell.cell_contents, str)
        }
        assert needed in granted, f"{route.methods} on the public media path is missing {needed}"
