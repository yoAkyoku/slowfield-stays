from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Page(Base):
    __tablename__ = "pages"
    __table_args__ = (UniqueConstraint("site_id", "slug", name="uq_pages_site_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    slug: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    summary: Mapped[str] = mapped_column(Text, default="")
    body: Mapped[str] = mapped_column(Text, default="")
    body_blocks: Mapped[list] = mapped_column(JSON, default=list)
    content_type: Mapped[str] = mapped_column(String(40), default="page", index=True)
    # content_type remains the canonical category used in the public URL.
    # categories contains every listing this page belongs to.
    categories: Mapped[list] = mapped_column(JSON, default=list)
    layout: Mapped[str] = mapped_column(String(40), default="page")
    cover_image_url: Mapped[str] = mapped_column(String(500), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    related_stay_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(40), default="draft")
    seo: Mapped[dict] = mapped_column(JSON, default=dict)
    translations: Mapped[dict] = mapped_column(JSON, default=dict)
    published_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class ContentTag(Base):
    """A site-owned bilingual vocabulary for editorial page tags.

    Pages keep their existing JSON tag values for backwards compatibility. This
    catalogue supplies the stable, bilingual choices in the admin while leaving
    old free-text tags readable and searchable. A tag is scoped by site so an
    editor can never manage or see another site's vocabulary.
    """

    __tablename__ = "content_tags"
    __table_args__ = (UniqueConstraint("site_id", "slug", name="uq_content_tags_site_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    name_zh: Mapped[str] = mapped_column(String(120), nullable=False)
    name_en: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    subtitle: Mapped[str] = mapped_column(String(260), default="")
    image_url: Mapped[str] = mapped_column(String(500))
    # Blank, not "Explore": this is a zh-default product, and the English word
    # was pre-filled into the banner form for every Chinese operator who opened
    # it. The homepage hero renders its own localised buttons and never reads
    # this, so a default here bought nothing and cost a mistranslation.
    cta_label: Mapped[str] = mapped_column(String(80), default="")
    cta_href: Mapped[str] = mapped_column(String(260), default="/stays")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(40), default="draft")
    translations: Mapped[dict] = mapped_column(JSON, default=dict)
    starts_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    cta_label: Mapped[str] = mapped_column(String(80), default="")
    cta_href: Mapped[str] = mapped_column(String(260), default="")
    display_mode: Mapped[str] = mapped_column(String(40), default="popup")
    status: Mapped[str] = mapped_column(String(40), default="draft")
    translations: Mapped[dict] = mapped_column(JSON, default=dict)
    starts_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
