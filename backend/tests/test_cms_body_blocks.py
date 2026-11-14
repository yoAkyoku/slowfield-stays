from datetime import UTC, datetime

import pytest
from fastapi import HTTPException

from app.modules.admin.routes import _page_payload, _require_publishable_page
from app.modules.cms.models import Page
from app.modules.cms.schemas import PageRead, SeoMeta


def test_admin_page_payload_includes_body_blocks() -> None:
    page = Page(
        id=1,
        site_id=1,
        slug="kol-video",
        title="KOL video",
        summary="Short video article",
        body="Fallback body",
        body_blocks=[
            {"type": "heading", "level": "h2", "text": "Arrival"},
            {"type": "video_embed", "url": "https://www.youtube.com/shorts/demo", "title": "Shorts"},
        ],
        content_type="journal",
        cover_image_url="",
        sort_order=0,
        tags=["kol"],
        related_stay_ids=[],
        status="draft",
        seo={},
        published_at=datetime.now(UTC),
    )

    payload = _page_payload(page)

    assert payload["body_blocks"] == page.body_blocks


def test_public_page_schema_accepts_body_blocks() -> None:
    page = PageRead(
        id=1,
        slug="embed",
        title="Embed",
        summary="",
        body="Fallback",
        body_blocks=[{"type": "paragraph", "text": "Block text"}],
        content_type="journal",
        cover_image_url="",
        sort_order=0,
        tags=[],
        related_stay_ids=[],
        status="published",
        seo=SeoMeta(),
        published_at=None,
    )

    assert page.body_blocks == [{"type": "paragraph", "text": "Block text"}]


def test_publishable_page_allows_blocks_without_plain_body() -> None:
    page = Page(
        slug="blocks-only",
        title="Blocks only",
        body="",
        body_blocks=[{"type": "paragraph", "text": "Block text"}],
        status="published",
    )

    _require_publishable_page(page)


def test_publishable_page_rejects_empty_body_and_empty_blocks() -> None:
    page = Page(slug="empty", title="Empty", body="", body_blocks=[], status="published")

    with pytest.raises(HTTPException):
        _require_publishable_page(page)
