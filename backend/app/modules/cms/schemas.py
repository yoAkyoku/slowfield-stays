from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SeoMeta(BaseModel):
    title: str | None = None
    description: str | None = None
    og_image: str | None = None
    canonical: str | None = None


class BannerRead(BaseModel):
    id: int
    title: str
    subtitle: str
    image_url: str
    cta_label: str
    cta_href: str
    sort_order: int
    status: str
    translations: dict = {}

    model_config = ConfigDict(from_attributes=True)


class PageRead(BaseModel):
    id: int
    slug: str | None = None
    title: str
    summary: str
    body: str
    body_blocks: list[dict] = []
    content_type: str = "page"
    categories: list[str] = []
    layout: str = "page"
    cover_image_url: str = ""
    sort_order: int = 0
    tags: list[str] = []
    related_stay_ids: list[int] = []
    status: str
    seo: SeoMeta
    translations: dict = {}
    published_at: datetime | None
    route_category: str | None = None
    public_path: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AnnouncementRead(BaseModel):
    id: int
    title: str
    body: str
    image_url: str
    cta_label: str
    cta_href: str
    display_mode: str
    status: str
    translations: dict = {}

    model_config = ConfigDict(from_attributes=True)

