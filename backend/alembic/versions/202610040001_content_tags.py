"""add site-scoped bilingual CMS tag catalogue

Revision ID: 202610040001
Revises: 202610030003
Create Date: 2026-10-04
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "202610040001"
down_revision: str | None = "202610030003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _slug(value: str) -> str:
    raw = str(value or "").strip().lower()
    result = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    if result:
        return result[:120]
    return f"tag-{hashlib.sha1(str(value).strip().encode('utf-8')).hexdigest()[:16]}"


def _items(raw: object) -> list[str]:
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]
    if isinstance(raw, str):
        return [item.strip() for item in raw.split(",") if item.strip()]
    return []


def upgrade() -> None:
    op.create_table(
        "content_tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("name_zh", sa.String(120), nullable=False),
        sa.Column("name_en", sa.String(120), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("site_id", "slug", name="uq_content_tags_site_slug"),
    )
    op.create_index("ix_content_tags_site_id", "content_tags", ["site_id"])

    # Preserve the existing free-text vocabulary so the new management page is
    # useful immediately. This is intentionally an additive import: no Page
    # row is changed and no existing label is removed.
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT site_id, tags, translations FROM pages WHERE site_id IS NOT NULL AND deleted_at IS NULL")).fetchall()
    seen: set[tuple[int, str]] = set()
    table = sa.table(
        "content_tags",
        sa.column("site_id", sa.Integer()),
        sa.column("slug", sa.String()),
        sa.column("name_zh", sa.String()),
        sa.column("name_en", sa.String()),
        sa.column("status", sa.String()),
        sa.column("sort_order", sa.Integer()),
    )
    for site_id, raw_tags, raw_translations in rows:
        try:
            translations = json.loads(raw_translations) if isinstance(raw_translations, str) else (raw_translations or {})
        except (TypeError, ValueError):
            translations = {}
        zh_items = _items(raw_tags)
        zh_translated = _items((translations.get("zh") or {}).get("tags")) if isinstance(translations, dict) else []
        en_items = _items((translations.get("en") or {}).get("tags")) if isinstance(translations, dict) else []
        labels = zh_items or zh_translated or en_items
        for index, name_zh in enumerate(labels):
            name_en = en_items[index] if index < len(en_items) else (zh_translated[index] if index < len(zh_translated) else "")
            key = (int(site_id), name_zh.casefold())
            if key in seen:
                continue
            seen.add(key)
            slug = _slug(name_en or name_zh)
            # A repeated English translation can collide for two Chinese labels;
            # keep each site key unique without touching the displayed names.
            suffix = 2
            base = slug
            while bind.execute(
                sa.text("SELECT 1 FROM content_tags WHERE site_id = :site_id AND slug = :slug"),
                {"site_id": site_id, "slug": slug},
            ).first() is not None:
                slug = f"{base[: max(1, 120 - len(str(suffix)) - 1)]}-{suffix}"
                suffix += 1
            bind.execute(
                table.insert().values(
                    site_id=site_id,
                    slug=slug,
                    name_zh=name_zh[:120],
                    name_en=name_en[:120],
                    status="active",
                    sort_order=0,
                )
            )


def downgrade() -> None:
    op.drop_index("ix_content_tags_site_id", table_name="content_tags")
    op.drop_table("content_tags")
