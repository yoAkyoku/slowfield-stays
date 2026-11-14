import asyncio
import copy
import csv
from hashlib import sha1
import re
import secrets
from datetime import UTC, datetime, timedelta
from io import StringIO
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, BeforeValidator, Field
from sqlalchemy import Text, delete as sql_delete, func, inspect, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings as app_settings
from app.db.session import get_session
from app.modules.admin.content_categories import category_registry, preserve_registry
from app.modules.email.relay_guard import RelayNotAllowed, check_relay
from app.modules.admin.deps import (
    _GLOBAL_PERMISSIONS,
    _SITE_PERMISSIONS,
    _global_role,
    _is_super_admin,
    _site_role,
    get_admin_site,
    require_permission,
)
from app.modules.auth.models import AdminUser, LoginAudit, PasswordResetToken, Role
from app.modules.auth.routes import get_current_admin
from app.modules.auth.security import hash_password_async
from app.modules.bookings.models import BookingRequest
from app.modules.cms.models import Announcement, Banner, ContentTag, Page
from app.modules.cms.tag_references import rename_tag_references
from app.modules.email.models import EmailSettings, NewsletterCampaign, NewsletterDelivery, NewsletterSubscriber
from app.modules.email.service import (
    count_sent_today,
    get_email_settings,
    process_newsletter_queue,
    retry_failed_newsletter_deliveries,
    strip_clipboard_fragment_markers,
)
from app.modules.inquiries.models import Inquiry
from app.modules.media.models import MediaAsset
from app.modules.media.schemas import MediaAssetRename
from app.modules.media.routes import media_path, store_media_asset
from app.modules.sites.context import DEFAULT_SITE_SLUG, ensure_default_site
from app.modules.sites.models import AdminUserSite, Site
from app.modules.stays.models import Amenity, RoomType, Stay, StayImage
from app.modules.cms.schemas import SeoMeta

router = APIRouter(dependencies=[Depends(get_current_admin)])


# ---------------------------------------------------------------------------
# Permission categories
# ---------------------------------------------------------------------------
# Global permissions are checked against AdminUser.role (the user's
# system-wide role).  Site permissions are checked against the
# AdminUserSite link for the current site.  "*" (super-admin) bypasses
# everything.

class ContentStatusUpdate(BaseModel):
    """For stays, pages, banners."""
    status: str = Field(pattern="^(draft|review|published|archived)$")


class ContentTagStatusUpdate(BaseModel):
    status: str = Field(pattern="^(active|archived)$")


class InquiryStatusUpdate(BaseModel):
    status: str = Field(pattern="^(new|contacted|quoted|closed)$")


class BookingStatusUpdate(BaseModel):
    status: str = Field(pattern="^(new|contacted|quoted|closed)$")


class SubscriberStatusUpdate(BaseModel):
    status: str = Field(pattern="^(subscribed|unsubscribed)$")


class StayAdminUpsert(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    name: str
    destination: str
    region: str
    summary: str
    story: str = ""
    hero_image_url: str
    booking_url: str = ""
    base_price: int = Field(ge=0)
    max_guests: int = Field(ge=1)
    sort_order: int = 0
    status: str = "draft"
    # Validated against the shape that reads it back. It used to be a loose
    # dict while PageRead.seo is a strict SeoMeta, so {"title": 123} saved
    # cleanly and then failed to serialise — which took the whole public
    # listing down with it. Reject at the write, where an editor sees it.
    seo: SeoMeta = Field(default_factory=SeoMeta)
    detail_config: dict[str, Any] = Field(default_factory=dict)
    faq: list[dict[str, Any]] = Field(default_factory=list)
    house_rules: list[str] = Field(default_factory=list)
    location_config: dict[str, Any] = Field(default_factory=dict)
    social_links: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    # Ticked from the site's 服務設施 search list; `amenities` stays free-text copy.
    facilities: list[str] = Field(default_factory=list)
    # Ticked from the site's 慢域體驗 search list.
    experiences: list[str] = Field(default_factory=list)
    related_content_ids: list[int] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    room_types: list[dict[str, Any]] = Field(default_factory=list)
    images: list[dict[str, Any]] = Field(default_factory=list)
    translations: dict[str, Any] = Field(default_factory=dict)


class PageAdminUpsert(BaseModel):
    slug: str | None = None
    title: str
    summary: str = ""
    body: str = ""
    body_blocks: list[dict[str, Any]] = Field(default_factory=list)
    content_type: str = Field(default="page", max_length=40, pattern=r"^[a-z][a-z0-9_-]*$")
    categories: list[str] = Field(default_factory=list)
    layout: str = Field(default="page", pattern=r"^[a-z][a-z0-9_-]*$")
    cover_image_url: str = ""
    sort_order: int = 0
    tags: list[str] = Field(default_factory=list)
    related_stay_ids: list[int] = Field(default_factory=list)
    status: str = "draft"
    # Validated against the shape that reads it back. It used to be a loose
    # dict while PageRead.seo is a strict SeoMeta, so {"title": 123} saved
    # cleanly and then failed to serialise — which took the whole public
    # listing down with it. Reject at the write, where an editor sees it.
    seo: SeoMeta = Field(default_factory=SeoMeta)
    translations: dict[str, Any] = Field(default_factory=dict)


class ContentTagAdminUpsert(BaseModel):
    """Bilingual, site-owned tag vocabulary entry."""

    slug: str | None = Field(default=None, max_length=120)
    name_zh: str = Field(min_length=1, max_length=120)
    name_en: str = Field(default="", max_length=120)
    status: str = Field(default="active", pattern=r"^(active|archived)$")
    sort_order: int = 0


class BannerAdminUpsert(BaseModel):
    title: str
    subtitle: str = ""
    image_url: str
    cta_label: str = ""  # see BannerModel.cta_label: no English default on a zh site
    cta_href: str = "/stays"
    sort_order: int = 0
    status: str = "draft"
    translations: dict[str, Any] = Field(default_factory=dict)


class AdminUserCreate(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=8, max_length=128)
    role: str = "admin"
    # Optional explicit site slug — if omitted, falls back to the caller's
    # currently active site (the SiteSwitcher cookie). When provided, the
    # new user is linked to that site instead.
    site_slug: str | None = None


class AdminUserStatusUpdate(BaseModel):
    status: str = Field(pattern="^(active|archived)$")


class AdminUserRoleUpdate(BaseModel):
    role: str


class RolePermissionsUpdate(BaseModel):
    permissions: list[str] = Field(default_factory=list)


class SiteCreate(BaseModel):
    name: str
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    # Accept empty, a multi-label FQDN, or a single-label hostname (localhost, dev intranet) — the latter
    # eliminates a class of dev-environment 422s when admins type "localhost" into the domain field.
    #
    # None is coerced to "" rather than rejected: a site with no domain stores
    # NULL, `_site_payload` hands that null straight back, and the field then
    # refused to accept its own output — so reading a site and writing it back
    # unchanged failed with "Input should be a valid string" on a field the
    # caller never touched. The admin UI happened to be shielded by a
    # `site.domain || ""` in its payload builder; nothing else was.
    domain: Annotated[str, BeforeValidator(lambda v: "" if v is None else v)] = Field(
        default="",
        pattern=r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$|^$",
    )
    default_locale: str = "zh"
    primary_color: str = "#2f4638"
    accent_color: str = "#b78b58"
    nav_bg: str = ""
    nav_text: str = ""
    footer_bg: str = ""
    footer_text: str = ""
    button_bg: str = ""
    button_text: str = ""
    # The header 立即預約 button and the footer 訂閱 button are separate from the
    # generic button colour: one shared value repainted every ordinary button.
    nav_button_bg: str = ""
    nav_button_text: str = ""
    footer_button_bg: str = ""
    footer_button_text: str = ""
    page_bg: str = ""
    contact_email: str = ""
    contact_line: str = ""
    seo_title: str = ""
    seo_description: str = ""
    parent_site_id: int | None = None
    template_site_id: int | None = None
    is_template: bool = False
    template_version: str = "v1"
    # Only SiteUpdate carried this, so the status chosen on the "new site" form
    # was parsed away by the schema and the site was created active whatever the
    # admin picked — a villa built as a draft was live on the public site from
    # the moment it was created, holding the template's content.
    status: str = Field(default="active", pattern="^(active|draft|archived)$")
    settings: dict[str, Any] = Field(default_factory=dict)


class SiteUpdate(SiteCreate):
    pass


class SiteUserRoleUpdate(BaseModel):
    role: str | None = None


class EmailSettingsUpdate(BaseModel):
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    from_email: str = ""
    from_name: str = "Slowfield Stays"
    use_tls: bool = True
    is_enabled: bool = False
    # 0 = no daily cap (Resend Pro / SES / Workspace). 100 matches Resend free.
    daily_cap: int = Field(default=100, ge=0, le=1_000_000)
    # Comma-separated reply recipients. Empty = replies go to from_email.
    reply_to: str = Field(default="", max_length=500)


class EmailTestRequest(BaseModel):
    to_email: str


class QaStatusUpdate(BaseModel):
    key: str
    done: bool


class QaNoteUpdate(BaseModel):
    note: str = ""
    decision: str = Field(default="pending", pattern="^(pending|ready|conditional|blocked)$")


class NewsletterSubscriberUpsert(BaseModel):
    email: str
    name: str = ""
    groups: list[str] = Field(default_factory=list)
    status: str = "subscribed"


class NewsletterCampaignUpsert(BaseModel):
    subject: str
    body: str = ""
    status: str = Field(default="draft", pattern=r"^(draft|queued|sending|sent|failed)$")
    target_groups: list[str] = Field(default_factory=list)
    # "self" — only this site's subscribers (default)
    # "self+children" — this site + every child site (parent-site only)
    recipient_scope: str = Field(default="self", pattern=r"^(self|self\+children)$")


class NewsletterScheduleRequest(BaseModel):
    # ISO-8601 datetime, optionally with timezone. Naive datetimes are treated
    # as UTC by the route handler.
    scheduled_at: datetime


class AnnouncementAdminUpsert(BaseModel):
    title: str
    body: str = ""
    image_url: str = ""
    cta_label: str = ""
    cta_href: str = ""
    display_mode: str = Field(default="popup", pattern=r"^(popup|banner|toast|inline)$")
    status: str = "draft"
    translations: dict = {}


#: The global role a site-scoped user gets. Deliberately empty.
#:
#: A role lives in one of two slots — AdminUser.role_id decides GLOBAL
#: permissions (sites:*, global_users:*, roles:*) and AdminUserSite.role_id
#: decides SITE ones — and create_admin_user used to put the SAME row in both
#: for a site admin. Harmless while the "admin" row holds only site
#: permissions, and a trap the moment anyone ticks sites:write on it in the
#: roles screen: every site admin in the network would hold it globally,
#: because their global slot is that row. The slots need different rows.
SITE_MEMBER_ROLE = "site_member"

#: Roles that may only ever be a SITE role. Kept here so the guard in
#: update_role_permissions and the assignment in create_admin_user agree.
SITE_ROLE_NAMES = frozenset({"admin", "editor"})


def _role_permissions(role_name: str) -> list[str]:
    """Default permissions for each role.

    Global roles (stored on AdminUser.role_id):
      * super_admin — full access
      * site_member — nothing; the global slot of a site-scoped user
      * (custom roles can carry any mix of global + site permissions)
      * (legacy "owner" maps to super_admin)

    Site roles (stored on AdminUserSite.role_id):
      * admin — full site content + site user management
      * editor — content read/write, no user management
    """
    if role_name == SITE_MEMBER_ROLE:
        return []
    if role_name in ("super_admin", "owner"):
        return ["*"]
    if role_name == "admin":
        return [
            "stays:read", "stays:write", "cms:read", "cms:write",
            "media:read", "media:write", "inquiries:read", "inquiries:write",
            "newsletter:read", "newsletter:write",
            "site_users:read", "site_users:write",
        ]
    if role_name == "editor":
        return [
            "stays:read", "stays:write", "cms:read", "cms:write",
            "media:read", "media:write", "inquiries:read", "newsletter:read",
        ]
    return []


SCRIPT_SETTING_KEYS = ("head_code", "body_code", "ads_code")


def _settings_without_script_keys(settings: dict | None) -> dict:
    """Site settings with the three code-injection keys removed."""
    return {k: v for k, v in dict(settings or {}).items() if k not in SCRIPT_SETTING_KEYS}


async def _ensure_role(session: AsyncSession, role_name: str) -> Role:
    result = await session.execute(select(Role).where(Role.name == role_name))
    role = result.scalar_one_or_none()
    if role is not None:
        return role
    role = Role(name=role_name, permissions=_role_permissions(role_name))
    session.add(role)
    await session.flush()
    return role


def _allowed_permissions() -> list[str]:
    return ["*", *sorted(_GLOBAL_PERMISSIONS), *sorted(_SITE_PERMISSIONS)]


def _csv_safe(value: object) -> object:
    """Prevent CSV formula injection by prefixing dangerous leading characters."""
    if isinstance(value, str) and value and value[0] in ("=", "+", "-", "@"):
        return "'" + value
    return value


def _soft_delete(model: Stay | Page | Banner | NewsletterSubscriber | NewsletterCampaign | AdminUser) -> None:
    model.deleted_at = datetime.now(UTC)


def _restore_soft_deleted(model: Stay | Page | Banner | NewsletterSubscriber | NewsletterCampaign | AdminUser) -> None:
    model.deleted_at = None


def _require_in_bin(obj, label: str) -> None:
    """Guard for permanent deletion: the row has to be in the bin already.

    Every list in this admin soft-deletes, and 已刪除 is a separate view you have
    to switch to. Permanent removal is offered only from there, so deleting twice
     — once to the bin, once out of it — is the whole gesture, and a single
    mis-click can never destroy live content. A row that is not soft-deleted
    answers 404 here exactly as a non-existent one does: this endpoint has
    nothing to say about live rows.
    """
    if obj is None or getattr(obj, "deleted_at", None) is None:
        raise HTTPException(status_code=404, detail=f"{label} is not in the deleted list")


def _visibility_clause(model: type[Stay] | type[Page] | type[Banner] | type[NewsletterSubscriber] | type[NewsletterCampaign] | type[AdminUser], visibility: str):
    if visibility == "deleted":
        return model.deleted_at.is_not(None)
    if visibility == "all":
        return None
    return model.deleted_at.is_(None)


def _validate_visibility(visibility: str) -> str:
    if visibility not in {"active", "deleted", "all"}:
        raise HTTPException(status_code=422, detail="Invalid visibility")
    return visibility


def _banner_payload(banner: Banner) -> dict[str, object]:
    return {
        "id": banner.id,
        "title": banner.title,
        "subtitle": banner.subtitle,
        "image_url": banner.image_url,
        "cta_label": banner.cta_label,
        "cta_href": banner.cta_href,
        "sort_order": banner.sort_order,
        "status": banner.status,
        "translations": banner.translations or {},
        "deleted_at": banner.deleted_at,
    }


def _normalise_page_categories(primary: str, values: object) -> list[str]:
    """Keep the canonical category first and discard invalid duplicates."""
    valid = re.compile(r"^[a-z][a-z0-9_-]*$")
    result = [primary]
    for value in values if isinstance(values, list) else []:
        item = str(value).strip()
        if item != primary and valid.fullmatch(item) and item not in result:
            result.append(item)
    return result


def _content_tag_slug(value: str) -> str:
    """Return a stable, URL-safe key without changing the display labels."""
    raw = str(value or "").strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", raw).strip("-")
    if slug:
        return slug[:120]
    # Chinese-only labels have no useful ASCII transliteration in the runtime.
    # A short digest is deterministic, opaque, and remains safe as a key.
    return f"tag-{sha1(str(value).strip().encode('utf-8')).hexdigest()[:16]}"


def _normalise_content_tag_slug(slug: str | None, name_zh: str, name_en: str = "") -> str:
    candidate = str(slug or "").strip().lower()
    if candidate:
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,119}", candidate):
            raise HTTPException(status_code=422, detail="Tag slug must use lowercase letters, numbers, hyphens, or underscores")
        return candidate
    return _content_tag_slug(name_en or name_zh)


def _tag_payload(tag: ContentTag, usage_count: int = 0) -> dict[str, object]:
    return {
        "id": tag.id,
        "slug": tag.slug,
        "name_zh": tag.name_zh,
        "name_en": tag.name_en,
        "status": tag.status,
        "sort_order": tag.sort_order,
        "usage_count": usage_count,
    }


def _page_tag_values(page: Page) -> set[str]:
    """Collect canonical and translated labels for a non-relational JSON tag."""
    values: set[str] = set()
    for raw in page.tags or []:
        label = str(raw or "").strip().casefold()
        if label:
            values.add(label)
    translations = page.translations or {}
    if isinstance(translations, dict):
        for locale in ("zh", "en"):
            raw = translations.get(locale, {}).get("tags") if isinstance(translations.get(locale), dict) else None
            items = raw if isinstance(raw, list) else str(raw or "").split(",")
            values.update(str(item or "").strip().casefold() for item in items if str(item or "").strip())
    return values


def _page_payload(page: Page) -> dict[str, object]:
    return {
        "id": page.id,
        "slug": page.slug,
        "title": page.title,
        "summary": page.summary,
        "body": page.body,
        "body_blocks": page.body_blocks or [],
        "content_type": page.content_type,
        "categories": page.categories or [page.content_type],
        "layout": page.layout,
        "cover_image_url": page.cover_image_url,
        "sort_order": page.sort_order,
        "tags": page.tags,
        "related_stay_ids": page.related_stay_ids,
        "status": page.status,
        "seo": page.seo,
        "translations": page.translations or {},
        "published_at": page.published_at,
        "deleted_at": page.deleted_at,
    }


def _stay_payload(stay: Stay) -> dict[str, object]:
    return {
        "id": stay.id,
        "slug": stay.slug,
        "name": stay.name,
        "destination": stay.destination,
        "region": stay.region,
        "summary": stay.summary,
        "story": stay.story,
        "hero_image_url": stay.hero_image_url,
        "booking_url": getattr(stay, "booking_url", "") or "",
        "base_price": stay.base_price,
        "max_guests": stay.max_guests,
        "sort_order": getattr(stay, "sort_order", 0) or 0,
        "status": stay.status,
        "deleted_at": stay.deleted_at,
        "seo": stay.seo,
        "detail_config": stay.detail_config,
        "faq": stay.faq,
        "house_rules": stay.house_rules,
        "location_config": stay.location_config,
        "social_links": stay.social_links,
        "tags": stay.tags or [],
        "facilities": stay.facilities or [],
        "experiences": stay.experiences or [],
        "related_content_ids": stay.related_content_ids,
        "translations": stay.translations or {},
        "amenities": [item.name for item in stay.amenities],
        "room_types": [
            {
                "name": room.name,
                "description": room.description,
                "price": room.price,
                "capacity": room.capacity,
            }
            for room in stay.room_types
        ],
        "images": [
            {
                "image_url": image.image_url,
                "alt_text": image.alt_text,
                "sort_order": image.sort_order,
            }
            for image in sorted(stay.images, key=lambda item: item.sort_order)
        ],
    }


def _replace_stay_children(stay: Stay, payload: StayAdminUpsert) -> None:
    stay.amenities = [Amenity(name=name.strip()) for name in payload.amenities if name.strip()]
    stay.room_types = [
        RoomType(
            name=str(room.get("name", "")).strip(),
            description=str(room.get("description", "")).strip(),
            price=int(room.get("price") or 0),
            capacity=int(room.get("capacity") or 1),
        )
        for room in payload.room_types
        if str(room.get("name", "")).strip()
    ]
    stay.images = [
        StayImage(
            image_url=str(image.get("image_url", "")).strip(),
            alt_text=str(image.get("alt_text", "")).strip(),
            sort_order=int(image.get("sort_order") or index),
        )
        for index, image in enumerate(payload.images)
        if str(image.get("image_url", "")).strip()
    ]


def _require_publishable_banner(banner: Banner) -> None:
    if not banner.image_url.strip():
        raise HTTPException(status_code=422, detail="Banner requires an image before publishing")


def _require_publishable_page(page: Page) -> None:
    if not page.body.strip() and not (page.body_blocks or []):
        raise HTTPException(status_code=422, detail="Page requires body content before publishing")


def _require_publishable_stay(stay: Stay) -> None:
    if not stay.hero_image_url.strip():
        raise HTTPException(status_code=422, detail="Stay requires a hero image before publishing")
    if not stay.summary.strip():
        raise HTTPException(status_code=422, detail="Stay requires a summary before publishing")
    if not stay.room_types:
        raise HTTPException(status_code=422, detail="Stay requires at least one room type before publishing")


def _inquiry_payload(inquiry: Inquiry) -> dict[str, object]:
    return {
        "id": inquiry.id,
        "name": inquiry.name,
        "email": inquiry.email,
        "phone": inquiry.phone,
        "line_id": inquiry.line_id,
        "stay_id": inquiry.stay_id,
        "check_in": inquiry.check_in,
        "check_out": inquiry.check_out,
        "guests": inquiry.guests,
        "subject": inquiry.subject,
        "message": inquiry.message,
        "source": inquiry.source,
        "status": inquiry.status,
        "created_at": inquiry.created_at,
        # The admin lists soft-deleted rows under 已刪除 and decides from this
        # field whether to offer 復原 or the status buttons. It was the one
        # payload that left it out (_booking_payload always carried it), so the
        # deleted view rendered the active actions and a deleted enquiry had no
        # way back — the restore route and the button that calls it both existed
        # and were simply unreachable.
        "deleted_at": inquiry.deleted_at,
    }


def _email_settings_payload(settings, sent_today: int = 0) -> dict[str, object]:
    return {
        "smtp_host": settings.smtp_host,
        "smtp_port": settings.smtp_port,
        "smtp_username": settings.smtp_username,
        "has_password": bool(settings.smtp_password),
        "from_email": settings.from_email,
        "from_name": settings.from_name,
        "use_tls": settings.use_tls,
        "is_enabled": settings.is_enabled,
        "daily_cap": settings.daily_cap,
        "sent_today": sent_today,
        "reply_to": getattr(settings, "reply_to", "") or "",
    }


def _booking_payload(booking: BookingRequest) -> dict[str, object]:
    return {
        "id": booking.id,
        "stay_id": booking.stay_id,
        "room_type": booking.room_type,
        "name": booking.name,
        "email": booking.email,
        "phone": booking.phone,
        "line_id": booking.line_id,
        "check_in": booking.check_in,
        "check_out": booking.check_out,
        "guests": booking.guests,
        "message": booking.message,
        "source": booking.source,
        "status": booking.status,
        "admin_note": booking.admin_note,
        "created_at": booking.created_at,
        "deleted_at": booking.deleted_at,
    }


def _campaign_payload(campaign: NewsletterCampaign, deliveries: int = 0, delivery_statuses: dict[str, int] | None = None) -> dict[str, object]:
    statuses = delivery_statuses or {}
    return {
        "id": campaign.id,
        "subject": campaign.subject,
        "body": campaign.body,
        "status": campaign.status,
        "target_groups": campaign.target_groups,
        "created_at": campaign.created_at,
        "queued_at": campaign.queued_at,
        "scheduled_at": campaign.scheduled_at,
        # The send stamps this on the campaign when the queue drains, but it was
        # never serialised — so 發送時間 in the admin list showed "—" for every
        # campaign ever sent, including ones sent months ago.
        "sent_at": campaign.sent_at,
        "deliveries": deliveries,
        "sent_count": statuses.get("sent", 0),
        "pending_count": statuses.get("pending", 0) + statuses.get("sending", 0),
        "failed_count": statuses.get("failed", 0),
        "skipped_count": statuses.get("skipped", 0),
        "deleted_at": campaign.deleted_at,
    }


def _announcement_payload(item: Announcement) -> dict[str, object]:
    return {
        "id": item.id,
        "title": item.title,
        "body": item.body,
        "image_url": item.image_url,
        "cta_label": item.cta_label,
        "cta_href": item.cta_href,
        "display_mode": item.display_mode,
        "status": item.status,
        "translations": item.translations or {},
        "starts_at": item.starts_at,
        "ends_at": item.ends_at,
    }


#: How far back 近期登入 on the dashboard looks.
RECENT_LOGIN_DAYS = 7


async def _dashboard_login_user_ids(session: AsyncSession, site: Site) -> set[int]:
    """Whose logins 近期登入 counts for *site*.

    The admins explicitly linked to the site, plus every super-admin. Super-
    admins hold a global "*" role and are deliberately given no AdminUserSite
    row (see _site_role), so scoping on the link table alone excluded exactly
    the accounts most worth watching — and on a site administered only by
    super-admins, which is the shape of a fresh install, the metric read 0 no
    matter how much the audit table filled up.
    """
    ids = set((await session.execute(
        select(AdminUserSite.admin_user_id).where(AdminUserSite.site_id == site.id)
    )).scalars().all())
    # Matched in Python, not with a JSON containment operator: permissions is a
    # plain JSON column, so `.contains()` compiles to LIKE and Postgres rejects
    # it outright ("operator does not exist: json ~~ text"). The dashboard wraps
    # its queries in a broad except that answers 0 for every metric, so that
    # failure surfaced as a plausible-looking zero rather than an error. The
    # role table is a handful of rows.
    wildcard_role_ids = [
        role.id
        for role in (await session.execute(select(Role))).scalars().all()
        if "*" in (role.permissions or [])
    ]
    if wildcard_role_ids:
        ids.update((await session.execute(
            select(AdminUser.id).where(AdminUser.role_id.in_(wildcard_role_ids))
        )).scalars().all())
    return ids


@router.get("/dashboard")
async def dashboard(
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    try:
        inquiries = (await session.execute(select(Inquiry).where(Inquiry.site_id == site.id))).scalars().all()
        stays = (await session.execute(select(Stay).where(Stay.site_id == site.id))).scalars().all()
        pages = (await session.execute(select(Page).where(Page.site_id == site.id))).scalars().all()
        # See _dashboard_login_user_ids for who this counts and why.
        site_user_ids = await _dashboard_login_user_ids(session, site)
        # "近期" in the label, so bound it. Without a window this counted every
        # successful login since the system was installed, which only ever grows
        # and says nothing about recent activity.
        login_window_start = datetime.now(UTC) - timedelta(days=RECENT_LOGIN_DAYS)
        logins = (await session.execute(
            select(LoginAudit).where(
                LoginAudit.admin_user_id.in_(site_user_ids),
                LoginAudit.created_at >= login_window_start,
            )
        )).scalars().all() if site_user_ids else []
        active_stays = [item for item in stays if item.deleted_at is None]
        active_pages = [item for item in pages if item.deleted_at is None]
        # Deleted enquiries stop counting: a dashboard that keeps counting spam
        # someone removed is the reason they removed it.
        new_inquiries = len([item for item in inquiries if item.status == "new" and item.deleted_at is None])
        in_review = len([item for item in [*active_stays, *active_pages] if item.status == "review"])
        published_stays = len([item for item in active_stays if item.status == "published"])
        recent_logins = len([item for item in logins if item.success])
        review_queue = [
            {
                "title": item.name,
                "status": item.status,
                "kind": "stay",
                "href": f"/admin/stays/{item.id}/edit",
            }
            for item in active_stays
            if item.status == "review"
        ] + [
            {
                "title": item.title,
                "status": item.status,
                "kind": "page",
                "href": f"/admin/cms/pages/{item.id}/edit",
            }
            for item in active_pages
            if item.status == "review"
        ]
    except Exception:
        import logging
        logging.getLogger(__name__).warning("Dashboard metrics query failed", exc_info=True)
        new_inquiries = 0
        in_review = 0
        published_stays = 0
        recent_logins = 0
        review_queue = []

    return {
        "metrics": {
            "new_inquiries": new_inquiries,
            "in_review": in_review,
            "published_stays": published_stays,
            "recent_logins": recent_logins,
        },
        "review_queue": review_queue,
    }


@router.get("/readiness", dependencies=[Depends(require_permission("site_users:read"))])
async def system_readiness(
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    db_ok = True
    db_detail = "Database query succeeded"
    try:
        await session.execute(select(Site.id).limit(1))
    except Exception as exc:
        db_ok = False
        db_detail = "connection failed"
        import logging
        logging.getLogger(__name__).warning("Readiness DB check failed: %%s", exc)

    media_root = Path("storage/media")
    email_settings = None
    if db_ok:
        email_settings = (
            await session.execute(select(EmailSettings).where(EmailSettings.site_id == site.id).limit(1))
        ).scalar_one_or_none()
    smtp_ok = bool(
        email_settings
        and email_settings.is_enabled
        and email_settings.smtp_host
        and email_settings.from_email
        and email_settings.smtp_password
    )
    production = app_settings.app_env == "production"
    secret_ok = (not production) or app_settings.secret_key != "change-me-in-production"
    frontend_ok = (not production) or not app_settings.frontend_url.startswith(("http://localhost", "http://127.0.0.1"))

    return {
        "environment": app_settings.app_env,
        "site": {"id": site.id, "slug": site.slug, "name": site.name},
        "qa_status": site.settings.get("qa_status", {}) if isinstance(site.settings, dict) else {},
        "qa_note": site.settings.get("qa_note", "") if isinstance(site.settings, dict) else "",
        "qa_decision": site.settings.get("qa_decision", "pending") if isinstance(site.settings, dict) else "pending",
        "checks": [
            {
                "key": "database",
                "status": "ready" if db_ok else "blocked",
                "detail": db_detail,
            },
            {
                "key": "media_storage",
                "status": "ready" if media_root.exists() and media_root.is_dir() else "blocked",
                "detail": str(media_root),
            },
            {
                "key": "secret_key",
                "status": "ready" if secret_ok else "blocked",
                "detail": "Change SECRET_KEY before production" if not secret_ok else "Secret key policy is acceptable",
            },
            {
                "key": "frontend_url",
                "status": "ready" if frontend_ok else "blocked",
                "detail": app_settings.frontend_url,
            },
            {
                "key": "smtp",
                "status": "ready" if smtp_ok else "blocked",
                "detail": "SMTP is enabled and complete" if smtp_ok else "SMTP settings are disabled or incomplete",
            },
        ],
    }


@router.put("/readiness/qa", dependencies=[Depends(require_permission("site_users:write"))])
async def update_qa_status(
    payload: QaStatusUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    settings = dict(site.settings or {})
    qa_status = dict(settings.get("qa_status") or {})
    qa_status[payload.key] = payload.done
    settings["qa_status"] = qa_status
    site.settings = settings
    await session.commit()
    return {"key": payload.key, "done": payload.done}


@router.put("/readiness/qa-note", dependencies=[Depends(require_permission("site_users:write"))])
async def update_qa_note(
    payload: QaNoteUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    settings = dict(site.settings or {})
    settings["qa_note"] = payload.note.strip()
    settings["qa_decision"] = payload.decision
    site.settings = settings
    await session.commit()
    return {"note": settings["qa_note"], "decision": settings["qa_decision"]}


@router.get("/email-settings", dependencies=[Depends(require_permission("site_users:read"))])
async def read_email_settings(
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    settings = await get_email_settings(session, site.id)
    await session.commit()
    sent_today = await count_sent_today(session, site.id)
    return _email_settings_payload(settings, sent_today=sent_today)


@router.put("/email-settings", dependencies=[Depends(require_permission("site_users:write"))])
async def update_email_settings(
    payload: EmailSettingsUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    settings = await get_email_settings(session, site.id)
    # Where the relay may be. smtp_host is free text from anyone with
    # site_users:write, and the test button dials it from inside the network —
    # see email/relay_guard.py. Checked on the way in so a host that cannot be
    # dialled cannot be stored either.
    if payload.is_enabled or payload.smtp_host.strip():
        try:
            check_relay(payload.smtp_host, payload.smtp_port)
        except RelayNotAllowed as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    settings.smtp_host = payload.smtp_host.strip()
    settings.smtp_port = payload.smtp_port
    settings.smtp_username = payload.smtp_username.strip()
    if payload.smtp_password:
        from app.core.crypto import encrypt_value
        settings.smtp_password = encrypt_value(payload.smtp_password)
    settings.from_email = payload.from_email.strip()
    settings.from_name = payload.from_name.strip()
    settings.use_tls = payload.use_tls
    settings.is_enabled = payload.is_enabled
    settings.daily_cap = payload.daily_cap
    # Trim each comma-separated address so we don't store stray whitespace.
    settings.reply_to = ", ".join(
        addr.strip() for addr in payload.reply_to.split(",") if addr.strip()
    )
    await session.commit()
    sent_today = await count_sent_today(session, site.id)
    return _email_settings_payload(settings, sent_today=sent_today)


def _smtp_failure_detail(exc: Exception) -> str:
    import smtplib

    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return "SMTP authentication failed — check the username and password."
    if isinstance(exc, (smtplib.SMTPSenderRefused, smtplib.SMTPRecipientsRefused, smtplib.SMTPDataError)):
        return "The mail server rejected the message — check the sender address is authorised."
    return "Could not complete the SMTP exchange — check the host, port and TLS setting."


@router.post("/email-settings/test", dependencies=[Depends(require_permission("site_users:write"))])
async def test_email_settings(
    payload: EmailTestRequest,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    settings = await get_email_settings(session, site.id)
    # Also checked here, not only on save: a row stored before this guard
    # existed would otherwise still be dialled by this button.
    try:
        check_relay(settings.smtp_host, settings.smtp_port)
    except RelayNotAllowed as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    # Tell the admin which stage failed (auth / from-not-authorised /
    # connection) so they can fix their provider config, but not what the
    # server said: host and port come from the admin's own form, so echoing the
    # reply turns this button into a port scanner for the network the app sits
    # in. The log line below keeps the full text for whoever owns the box.
    from app.modules.email.service import send_email_async
    try:
        sent = await send_email_async(
            settings,
            payload.to_email,
            "Slowfield Stays CMS email test",
            "This is a test email from Slowfield Stays CMS.",
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "Email test failed for site %s: %s", site.id, exc, exc_info=True
        )
        raise HTTPException(status_code=502, detail=_smtp_failure_detail(exc)) from exc
    if not sent:
        # send_email_async returns False when settings are missing fields
        # (is_enabled, smtp_host, from_email). Make that explicit too.
        raise HTTPException(
            status_code=422,
            detail="Email is disabled or missing required fields (host / from / enable toggle)",
        )
    # Record the test as a delivery (no campaign) so it counts toward the daily
    # quota / "今日已寄送" — a test send is a real email through the provider.
    session.add(
        NewsletterDelivery(
            site_id=site.id,
            campaign_id=None,
            subscriber_id=None,
            email=payload.to_email,
            status="sent",
            sent_at=datetime.now(UTC),
        )
    )
    await session.commit()
    sent_today = await count_sent_today(session, site.id)
    return {"sent": True, "sent_today": sent_today}


def _site_payload(site: Site, *, can_edit: bool = True, can_view: bool = True) -> dict[str, object]:
    settings = copy.deepcopy(site.settings or {})
    settings["article_categories"] = category_registry(settings, site.parent_site_id is None)
    return {
        "id": site.id,
        "parent_site_id": site.parent_site_id,
        "template_site_id": site.template_site_id,
        "name": site.name,
        "slug": site.slug,
        "domain": site.domain,
        "status": site.status,
        "is_template": site.is_template,
        "template_version": site.template_version,
        "default_locale": site.default_locale,
        "theme_config": site.theme_config,
        "contact_config": site.contact_config,
        "seo_defaults": site.seo_defaults,
        "settings": settings,
        # Authorization hints — read-only mode for child admins viewing parent.
        "_can_view": can_view,
        "_can_edit": can_edit,
    }


async def _seed_site_cms(session: AsyncSession, site: Site) -> None:
    pages = [
        Banner(
            site_id=site.id,
            title=f"{site.name} private stays",
            subtitle="Curated homes, slow retreats, and inquiry-first service.",
            image_url="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80",
            cta_label="Explore stays",
            cta_href="/stays",
            sort_order=0,
            status="draft",
        ),
    ]

    # 默认 CMS 页面模板
    # content_type must be a key of cms.routes.CONTENT_TYPE_TO_CATEGORY — it is
    # what picks the public category route. The slug had been copied into it,
    # which routed most of them to nothing, so a site created without a
    # template shipped pages its own menu 404s on.
    cms_pages = [
        ("brand-intro", "品牌介紹", "brand", "Brand Introduction"),
        ("dining", "餐飲服務", "dining", "Dining Service"),
        ("featured-activities", "精選活動", "activity", "Featured Activities"),
        ("travel-notes", "旅遊禮記", "journal", "Travel Notes"),
        ("private-experience", "慢域體驗", "experience", "Private Experience"),
        ("private-messages", "慢域消息", "news", "Private Messages"),
        ("services", "服務項目", "service", "Services"),
        ("privacy", "隱私政策", "privacy", "Privacy Policy"),
    ]

    for slug, title_zh, content_type, title_en in cms_pages:
        pages.append(
            Page(
                site_id=site.id,
                slug=slug,
                content_type=content_type,
                categories=[content_type],
                title=title_zh,
                summary="",
                body="",
                status="draft",
                translations={
                    "zh": {"title": title_zh},
                    "en": {"title": title_en}
                },
                seo={"title": title_zh, "description": ""},
            )
        )

    session.add_all(pages)


def _clone_site_settings(source: Site, target: Site) -> None:
    """Copy the template's layout and styling onto a new site.

    Cloning covered the content tables and stopped there, so a site created from
    a template arrived with the template's pages and stays but none of its
    homepage blocks, page configuration, fonts or colours — which is everything
    that makes it look like the template. The result was a working but blank
    site, which reads as the template picker having been ignored.

    Identity stays the site's own: name, slug, domain and the parent/template
    links are not touched. deepcopy because these are JSON columns; sharing a
    dict between two rows would let an edit on one silently rewrite the other.
    """
    target.settings = copy.deepcopy(source.settings or {})
    target.theme_config = copy.deepcopy(source.theme_config or {})
    target.contact_config = copy.deepcopy(source.contact_config or {})
    # SEO defaults describe the source site by name and would be actively wrong
    # here, so they are left for the new site to fill in.
    target.default_locale = source.default_locale


def _apply_explicit_site_create_overrides(site: Site, payload: SiteCreate) -> None:
    """Restore values the caller explicitly chose after template cloning.

    Site creation starts with the template so omitted fields inherit sensible
    defaults.  Pydantic's ``model_fields_set`` lets us distinguish those
    omissions from values the form/API actually supplied; only the latter may
    replace the cloned value.
    """
    fields = payload.model_fields_set
    theme_fields = {
        "primary_color": "primaryColor",
        "accent_color": "accentColor",
        "nav_bg": "navBg",
        "nav_text": "navText",
        "footer_bg": "footerBg",
        "footer_text": "footerText",
        "button_bg": "buttonBg",
        "button_text": "buttonText",
        "nav_button_bg": "navButtonBg",
        "nav_button_text": "navButtonText",
        "footer_button_bg": "footerButtonBg",
        "footer_button_text": "footerButtonText",
        "page_bg": "pageBg",
    }
    if any(field in fields for field in theme_fields):
        theme = copy.deepcopy(site.theme_config or {})
        for field, key in theme_fields.items():
            if field in fields:
                theme[key] = getattr(payload, field)
        site.theme_config = theme

    contact = copy.deepcopy(site.contact_config or {})
    if "contact_email" in fields:
        contact["email"] = payload.contact_email
    if "contact_line" in fields:
        contact["line"] = payload.contact_line
    site.contact_config = contact

    if "settings" in fields:
        settings = copy.deepcopy(site.settings or {})
        settings.update(_settings_without_script_keys(payload.settings))
        site.settings = settings
    if "default_locale" in fields:
        site.default_locale = payload.default_locale


async def _clone_site_content(session: AsyncSession, source: Site, target: Site) -> None:
    _clone_site_settings(source, target)
    # Soft-deleted rows are invisible everywhere else; cloning without the
    # filter republished them on the new site as fresh drafts, so content the
    # client had deleted came back as soon as they made a site from the
    # template. Announcement has no deleted_at column, hence only three filters.
    banners = (
        await session.execute(
            select(Banner).where(Banner.site_id == source.id, Banner.deleted_at.is_(None))
        )
    ).scalars().all()
    pages = (
        await session.execute(
            select(Page).where(Page.site_id == source.id, Page.deleted_at.is_(None))
        )
    ).scalars().all()
    content_tags = (
        await session.execute(
            select(ContentTag).where(ContentTag.site_id == source.id)
        )
    ).scalars().all()
    announcements = (await session.execute(select(Announcement).where(Announcement.site_id == source.id))).scalars().all()
    stays = (
        await session.execute(
            select(Stay)
            .where(Stay.site_id == source.id, Stay.deleted_at.is_(None))
            .options(selectinload(Stay.amenities), selectinload(Stay.room_types), selectinload(Stay.images))
        )
    ).scalars().all()
    for banner in banners:
        session.add(
            Banner(
                site_id=target.id,
                title=banner.title,
                subtitle=banner.subtitle,
                image_url=banner.image_url,
                cta_label=banner.cta_label,
                cta_href=banner.cta_href,
                sort_order=banner.sort_order,
                status="draft",
                starts_at=banner.starts_at,
                ends_at=banner.ends_at,
                translations=copy.deepcopy(banner.translations) or {},
            )
        )
    for page in pages:
        session.add(
            Page(
                site_id=target.id,
                slug=page.slug,
                title=page.title,
                summary=page.summary,
                body=page.body,
                body_blocks=copy.deepcopy(page.body_blocks) or [],
                content_type=page.content_type,
                categories=copy.deepcopy(page.categories) or [page.content_type],
                layout=page.layout,
                cover_image_url=page.cover_image_url,
                sort_order=page.sort_order,
                tags=copy.deepcopy(page.tags),
                related_stay_ids=[],
                status="draft",
                seo=copy.deepcopy(page.seo),
                translations=copy.deepcopy(page.translations) or {},
            )
        )
    for tag in content_tags:
        session.add(
            ContentTag(
                site_id=target.id,
                slug=tag.slug,
                name_zh=tag.name_zh,
                name_en=tag.name_en,
                status=tag.status,
                sort_order=tag.sort_order,
            )
        )
    for announcement in announcements:
        session.add(
            Announcement(
                site_id=target.id,
                title=announcement.title,
                body=announcement.body,
                image_url=announcement.image_url,
                cta_label=announcement.cta_label,
                cta_href=announcement.cta_href,
                display_mode=announcement.display_mode,
                status="draft",
                translations=copy.deepcopy(announcement.translations) or {},
                starts_at=announcement.starts_at,
                ends_at=announcement.ends_at,
            )
        )
    for stay in stays:
        cloned = Stay(
            site_id=target.id,
            slug=stay.slug,
            name=stay.name,
            destination=stay.destination,
            region=stay.region,
            summary=stay.summary,
            story=stay.story,
            hero_image_url=stay.hero_image_url,
            booking_url=getattr(stay, "booking_url", "") or "",
            base_price=stay.base_price,
            max_guests=stay.max_guests,
            sort_order=getattr(stay, "sort_order", 0) or 0,
            status="draft",
            seo=copy.deepcopy(stay.seo),
            detail_config=copy.deepcopy(stay.detail_config),
            faq=copy.deepcopy(stay.faq),
            house_rules=copy.deepcopy(stay.house_rules),
            location_config=copy.deepcopy(stay.location_config),
            social_links=copy.deepcopy(stay.social_links),
            tags=copy.deepcopy(stay.tags),
            facilities=list(stay.facilities or []),
            experiences=list(stay.experiences or []),
            related_content_ids=[],
            translations=copy.deepcopy(stay.translations) or {},
        )
        cloned.amenities = [Amenity(name=item.name) for item in stay.amenities]
        cloned.room_types = [
            RoomType(name=item.name, description=item.description, price=item.price, capacity=item.capacity)
            for item in stay.room_types
        ]
        cloned.images = [
            StayImage(image_url=item.image_url, alt_text=item.alt_text, sort_order=item.sort_order)
            for item in stay.images
        ]
        session.add(cloned)


@router.get("/sites")
async def manage_sites(
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    """Every admin's own site list — deliberately not gated on `sites:read`.

    The SiteSwitcher needs this on every screen, so a villa admin without
    `sites:read` must still be able to load it; the scope is enforced in the
    response instead, which is the part that matters. Reading this route's lack
    of a `require_permission` as a gap is a reasonable mistake to make, hence
    this note: `sites:read` widens the answer to *all* sites, it does not
    grant access to the route.
    """
    admin_id: int = inspect(admin).identity[0]
    global_role = await _global_role(admin, session)
    global_perms = global_role.permissions if global_role else []
    # Super-admin or network-admin with sites:read → see all sites
    if "*" in global_perms or "sites:read" in global_perms:
        sites = (await session.execute(select(Site).order_by(Site.id))).scalars().all()
        if not sites:
            sites = [await ensure_default_site(session)]
            await session.commit()
        return [_site_payload(site) for site in sites]
    # Everyone else → only sites they are linked to
    links = (
        await session.execute(
            select(AdminUserSite).options(selectinload(AdminUserSite.site)).where(AdminUserSite.admin_user_id == admin_id)
        )
    ).scalars().all()
    return [_site_payload(link.site) for link in links]


@router.post("/sites", status_code=201, dependencies=[Depends(require_permission("sites:write"))])
async def create_site(
    payload: SiteCreate,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    existing = (
        await session.execute(select(Site).where((Site.slug == payload.slug) | ((Site.domain == payload.domain) & (Site.domain != ""))))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Site slug or domain already exists")
    site = Site(
        parent_site_id=payload.parent_site_id,
        template_site_id=payload.template_site_id or payload.parent_site_id,
        name=payload.name.strip(),
        slug=payload.slug.strip().lower(),
        domain=payload.domain.strip().lower() or None,
        default_locale=payload.default_locale,
        status=payload.status,
        is_template=payload.is_template,
        template_version=payload.template_version.strip() or "v1",
        theme_config={
            "primaryColor": payload.primary_color,
            "accentColor": payload.accent_color,
            "navBg": payload.nav_bg,
            "navText": payload.nav_text,
            "footerBg": payload.footer_bg,
            "footerText": payload.footer_text,
            "buttonBg": payload.button_bg,
            "buttonText": payload.button_text,
            "navButtonBg": payload.nav_button_bg,
            "navButtonText": payload.nav_button_text,
            "footerButtonBg": payload.footer_button_bg,
            "footerButtonText": payload.footer_button_text,
            "pageBg": payload.page_bg,
        },
        contact_config={"email": payload.contact_email, "line": payload.contact_line},
        seo_defaults={
            "title": payload.seo_title.strip() or payload.name.strip(),
            "description": payload.seo_description.strip() or "Curated private stays.",
        },
        # Same three keys as update_site: they become executable code on the
        # site's public pages, which share an origin with /admin. Creating a
        # site needs global sites:write, a much higher bar than editing one, but
        # the guard belongs on both doors rather than on whichever was noticed
        # first.
        settings=_settings_without_script_keys(payload.settings),
    )
    session.add(site)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raw = str(getattr(exc, "orig", exc)).lower()
        if "domain" in raw:
            raise HTTPException(status_code=409, detail="Another site already uses this domain (or both have an empty domain). Please specify a unique domain.") from exc
        raise HTTPException(status_code=409, detail="Site create failed due to a duplicate value.") from exc
    admin_site_role = await _ensure_role(session, "admin")
    session.add(AdminUserSite(admin_user_id=inspect(admin).identity[0], site_id=site.id, role_id=admin_site_role.id))
    source_site = None
    if site.template_site_id:
        source_site = await session.get(Site, site.template_site_id)
    elif site.parent_site_id:
        source_site = await session.get(Site, site.parent_site_id)
    # The template id arrives in the request body and site ids are small
    # sequential integers, so without a check any caller who can create a site
    # could name any other site as its template and read that site's settings,
    # head/body code and keys back out of the 201 response. get_site refuses a
    # site the caller has no role on ("strict isolation"); cloning has to refuse
    # the same ones. A site explicitly marked as a template is fair game — that
    # is what it is for. Being the new site's parent is *not* an exemption:
    # parent_site_id arrives in the same body as template_site_id, so naming a
    # victim as the parent was enough to skip this check entirely. A caller who
    # genuinely owns the parent still has a role on it and passes below.
    if source_site is not None and not source_site.is_template:
        if await _site_role(admin, source_site, session) is None:
            raise HTTPException(status_code=403, detail="Template site access denied")
    if source_site is not None:
        await _clone_site_content(session, source_site, site)
        _apply_explicit_site_create_overrides(site, payload)
    else:
        await _seed_site_cms(session, site)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        message = "Site create failed due to a duplicate record."
        raw = str(getattr(exc, "orig", exc))
        if "pages_slug_key" in raw or "stays_slug_key" in raw:
            message = "Legacy global slug constraint still exists. Run alembic upgrade head before creating child sites."
        raise HTTPException(status_code=409, detail=message) from exc
    await session.refresh(site)
    return _site_payload(site)


@router.get("/sites/{site_id}")
async def get_site(
    site_id: int,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    site = await session.get(Site, site_id)
    # A caller with no access to a site must not be able to tell an id that
    # exists from one that does not: 404 here and 403 below made this route an
    # enumeration oracle for the whole network. Super-admins still get the
    # honest 404, because for them "no such site" is information they are
    # entitled to and a plain 403 would only be confusing.
    if site is None:
        if await _is_super_admin(admin, session):
            raise HTTPException(status_code=404, detail="Site not found")
        raise HTTPException(status_code=403, detail="Site access denied")
    caller_role = await _site_role(admin, site, session)
    if caller_role is None:
        # Strict isolation: a child-site admin asking for the parent site
        # ID directly gets 403 instead of a read-only payload.
        raise HTTPException(status_code=403, detail="Site access denied")
    # Direct site role — edit when their permissions cover site_users:write.
    # Match wildcards the same way require_permission does ("*", "site_users:*").
    perms = caller_role.permissions or []
    can_edit = (
        "*" in perms
        or "site_users:write" in perms
        or "site_users:*" in perms
    )
    return _site_payload(site, can_edit=can_edit, can_view=True)


@router.put("/sites/{site_id}", dependencies=[Depends(require_permission("site_users:write"))])
async def update_site(
    site_id: int,
    payload: SiteUpdate,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    site = await session.get(Site, site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    caller_role = await _site_role(admin, site, session)
    if caller_role is None:
        raise HTTPException(status_code=403, detail="Site access denied")
    # ensure_default_site() looks the default site up by this exact slug and,
    # not finding it, tries to create it - which then collides with the renamed
    # row on the domain unique key. So renaming the root site here turned every
    # request whose host matches no site into a 500, and left the frontend's own
    # "slowfield" fallback pointing at nothing. delete_site already
    # protects the root row; its slug is part of the same invariant.
    if site.slug == DEFAULT_SITE_SLUG and payload.slug.strip().lower() != DEFAULT_SITE_SLUG:
        raise HTTPException(status_code=400, detail="The root site's slug cannot be changed")

    duplicate = (
        await session.execute(
            select(Site).where(
                Site.id != site.id,
                (Site.slug == payload.slug.strip().lower()) | ((Site.domain == payload.domain.strip().lower()) & (Site.domain != "")),
            )
        )
    ).scalar_one_or_none()
    if duplicate:
        raise HTTPException(status_code=409, detail="Site slug or domain already exists")
    site.name = payload.name.strip()
    # Where this site sits in the network, and whether it is live, are the
    # operator's to decide — not the tenant's.
    #
    # Editing a site needs only site_users:write, which the site-scoped admin
    # role holds, and these six fields were taken from the payload like any
    # other. A villa admin could re-parent their site, mark it a template (after
    # which any sites:write holder may clone its content without a role on it,
    # see clone_site), take a slug or domain, or flip a status the operator had
    # deliberately left as draft. None of it reads another tenant's data, so it
    # is an integrity problem rather than a confidentiality one — but it is the
    # shape of the network, and it belongs to whoever owns the network.
    if await _is_super_admin(admin, session):
        site.parent_site_id = payload.parent_site_id
        site.template_site_id = payload.template_site_id or payload.parent_site_id
        site.slug = payload.slug.strip().lower()
        site.domain = payload.domain.strip().lower() or None
        site.status = payload.status
        site.is_template = payload.is_template
    site.template_version = payload.template_version.strip() or site.template_version
    site.default_locale = payload.default_locale
    site.theme_config = {
        "primaryColor": payload.primary_color,
        "accentColor": payload.accent_color,
        "navBg": payload.nav_bg,
        "navText": payload.nav_text,
        "footerBg": payload.footer_bg,
        "footerText": payload.footer_text,
        "buttonBg": payload.button_bg,
        "buttonText": payload.button_text,
        "navButtonBg": payload.nav_button_bg,
        "navButtonText": payload.nav_button_text,
        "footerButtonBg": payload.footer_button_bg,
        "footerButtonText": payload.footer_button_text,
        "pageBg": payload.page_bg,
    }
    site.contact_config = {"email": payload.contact_email, "line": payload.contact_line}
    site.seo_defaults = {
        "title": payload.seo_title.strip() or payload.name.strip(),
        "description": payload.seo_description.strip() or "Curated private stays.",
    }
    # Three settings become executable code on the site's public pages:
    # ``ads_code`` and ``body_code`` are rendered as an inline <script>, and
    # ``head_code`` as raw markup in <head>. Those pages are served from the same
    # origin as /admin, so script there runs with a visiting admin's session and
    # can call /admin/api/proxy, whose CSRF check is same-origin.
    #
    # Editing a site requires only ``site_users:write``, which the site-scoped
    # ``admin`` role holds — so a semi-trusted tenant could paste JS onto their
    # own site and wait for a super-admin to visit. The filter in the frontend is
    # not a boundary and was never meant to be one: ads_code exists to run JS, and
    # banning <>"' only stops it breaking out of the tag (backticks alone are
    # enough to write any payload without those characters).
    #
    # So the boundary is here, on who may set them. A non-super-admin's save
    # carries the stored values forward instead of being rejected — the settings
    # form posts every key on every save, so refusing the request would stop site
    # admins editing anything at all.
    new_settings = preserve_registry(site.settings, payload.settings, site.parent_site_id is None)
    if not await _is_super_admin(admin, session):
        stored = site.settings or {}
        for key in SCRIPT_SETTING_KEYS:
            if key in stored:
                new_settings[key] = stored[key]
            else:
                new_settings.pop(key, None)
    site.settings = new_settings
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raw = str(getattr(exc, "orig", exc)).lower()
        if "domain" in raw:
            raise HTTPException(status_code=409, detail="Another site already uses this domain.") from exc
        raise HTTPException(status_code=409, detail="Site update failed due to a duplicate value.") from exc
    await session.commit()
    return _site_payload(site)


@router.delete("/sites/{site_id}", dependencies=[Depends(require_permission("sites:write"))])
async def delete_site(
    site_id: int,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    site = await session.get(Site, site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    caller_role = await _site_role(admin, site, session)
    if caller_role is None:
        raise HTTPException(status_code=403, detail="Site access denied")
    if site.parent_site_id is None:
        raise HTTPException(status_code=400, detail="Cannot delete the root site")
    # The files behind this site's media, collected before the rows go. Deleting
    # the MediaAsset row only removes the record: /storage/media is mounted as
    # static files and serves by storage_key, so without this the images of a
    # "deleted" site stayed publicly readable at their original URLs forever,
    # and with no row left to find them by, unreachable for any later cleanup.
    # The confirm dialog tells the operator the media is removed; this is what
    # makes that true. Same unlink the single-asset delete does.
    media_keys = [
        key
        for asset in (
            await session.execute(select(MediaAsset).where(MediaAsset.site_id == site_id))
        ).scalars()
        for key in (asset.storage_key or Path(asset.url).name, Path(asset.poster_url).name if asset.poster_url else "")
        if key
    ]

    # Delete related records
    for model in [AdminUserSite, Stay, Page, ContentTag, Banner, Announcement, MediaAsset, Inquiry, BookingRequest, EmailSettings, NewsletterDelivery, NewsletterCampaign, NewsletterSubscriber]:
        rows = await session.execute(select(model).where(model.site_id == site_id))
        for row in rows.scalars():
            await session.delete(row)
    await session.delete(site)
    await session.commit()

    # After the commit: a failed unlink must not roll back the deletion, and a
    # file that is already gone is not an error.
    for key in media_keys:
        if not key:
            continue
        target = media_path(key)
        if target is not None:
            await asyncio.to_thread(target.unlink, True)

    return {"ok": "true"}


@router.get("/sites/{site_id}/users", dependencies=[Depends(require_permission("site_users:read"))])
async def manage_site_users(
    site_id: int,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    site = await session.get(Site, site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    # Verify requesting user has access to this specific site
    caller_role = await _site_role(admin, site, session)
    if caller_role is None:
        raise HTTPException(status_code=403, detail="Site access denied")
    links = (
        await session.execute(
            select(AdminUserSite)
            .options(selectinload(AdminUserSite.role))
            .where(AdminUserSite.site_id == site.id)
        )
    ).scalars().all()
    role_by_user = {link.admin_user_id: link.role for link in links}

    # Super-admin / network-admin → show all users (for the "add user" picker)
    # Site admin/editor → show only users linked to this site
    # A deleted account is out of both branches: it cannot sign in, so offering
    # it in the "add user" picker would hand a site a role nobody can use.
    if await _has_global_user_scope(admin, session):
        users = (
            await session.execute(
                select(AdminUser).options(selectinload(AdminUser.role))
                .where(AdminUser.deleted_at.is_(None)).order_by(AdminUser.id)
            )
        ).scalars().all()
    else:
        # Only users linked to this site
        linked_ids = set(role_by_user.keys())
        linked_ids.add(inspect(admin).identity[0])
        users = (
            await session.execute(
                select(AdminUser).options(selectinload(AdminUser.role))
                .where(AdminUser.id.in_(linked_ids), AdminUser.deleted_at.is_(None)).order_by(AdminUser.id)
            )
        ).scalars().all()

    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "global_role": user.role.name if user.role else "admin",
            "site_role": role_by_user[user.id].name if user.id in role_by_user else "",
            "permissions": role_by_user[user.id].permissions if user.id in role_by_user else [],
            "status": "active" if user.is_active else "archived",
        }
        for user in users
    ]


@router.patch("/sites/{site_id}/users/{user_id}", dependencies=[Depends(require_permission("site_users:write"))])
async def update_site_user_role(
    site_id: int,
    user_id: int,
    payload: SiteUserRoleUpdate,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    site = await session.get(Site, site_id)
    user = await session.get(AdminUser, user_id)
    if site is None or user is None:
        raise HTTPException(status_code=404, detail="Site or admin user not found")
    # A deleted account is not one you can grant a site role to. 404 rather
    # than 400 here: this route is reachable by any site admin, and the picker
    # it serves does not list deleted accounts at all, so as far as this caller
    # is concerned the row is not there.
    if user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Site or admin user not found")
    # Verify requesting user has access to this specific site
    caller_role = await _site_role(admin, site, session)
    if caller_role is None:
        raise HTTPException(status_code=403, detail="Site access denied")
    result = await session.execute(
        select(AdminUserSite).where(AdminUserSite.site_id == site_id, AdminUserSite.admin_user_id == user_id)
    )
    link = result.scalar_one_or_none()
    # Removing your own access is refused below. Demoting yourself reaches the
    # same place through a different door: only a site admin can call this at
    # all (site_users:write), so the only self-change available is admin →
    # editor, which drops that very permission and leaves nobody able to undo
    # it. A super-admin is exempt because their access comes from the global
    # "*" role, not from this link row, so changing it costs them nothing.
    is_self = user_id == inspect(admin).identity[0]
    if is_self and not await _is_super_admin(admin, session):
        raise HTTPException(
            status_code=422,
            detail="You cannot change your own site role — ask another site admin.",
        )
    if not payload.role:
        if is_self:
            raise HTTPException(status_code=422, detail="You cannot remove your own access")
        if link:
            await session.delete(link)
            await session.commit()
        return {"id": user.id, "site_id": site.id, "site_role": ""}

    _ALLOWED_SITE_ROLES = {"admin", "editor"}
    if payload.role not in _ALLOWED_SITE_ROLES:
        raise HTTPException(
            status_code=422,
            detail=f"Only site roles are allowed: {', '.join(sorted(_ALLOWED_SITE_ROLES))}",
        )
    role = await _ensure_role(session, payload.role)
    if link:
        link.role_id = role.id
    else:
        session.add(AdminUserSite(admin_user_id=user.id, site_id=site.id, role_id=role.id))
    await session.commit()
    return {"id": user.id, "site_id": site.id, "site_role": role.name}


@router.get("/stays", dependencies=[Depends(require_permission("stays:read"))])
async def manage_stays(
    site: Site = Depends(get_admin_site),
    visibility: str = Query(default="active"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    visibility = _validate_visibility(visibility)
    query = select(Stay).where(Stay.site_id == site.id)
    clause = _visibility_clause(Stay, visibility)
    if clause is not None:
        query = query.where(clause)
    stays = (
        await session.execute(
            query
            .options(selectinload(Stay.amenities), selectinload(Stay.room_types), selectinload(Stay.images))
            .order_by(Stay.sort_order.asc(), Stay.id.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()
    return [_stay_payload(stay) for stay in stays]


@router.post("/stays", status_code=201, dependencies=[Depends(require_permission("stays:write"))])
async def create_stay(
    payload: StayAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    data = payload.model_dump(exclude={"amenities", "room_types", "images"})
    stay = Stay(**data, site_id=site.id)
    _replace_stay_children(stay, payload)
    if stay.status == "published":
        _require_publishable_stay(stay)
        stay.published_at = datetime.now(UTC)
    session.add(stay)
    await session.commit()
    await session.refresh(stay)
    return {"id": stay.id, "slug": stay.slug, "status": stay.status}


@router.get("/stays/{stay_id}", dependencies=[Depends(require_permission("stays:read"))])
async def get_stay(
    stay_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    stay = (
        await session.execute(
            select(Stay)
            .where(Stay.id == stay_id, Stay.site_id == site.id)
            .options(selectinload(Stay.amenities), selectinload(Stay.room_types), selectinload(Stay.images))
        )
    ).scalar_one_or_none()
    if stay is None:
        raise HTTPException(status_code=404, detail="Stay not found")
    return _stay_payload(stay)


@router.put("/stays/{stay_id}", dependencies=[Depends(require_permission("stays:write"))])
async def update_stay(
    stay_id: int,
    payload: StayAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    stay = (
        await session.execute(
            select(Stay)
            .where(Stay.id == stay_id, Stay.site_id == site.id)
            .options(selectinload(Stay.amenities), selectinload(Stay.room_types), selectinload(Stay.images))
        )
    ).scalar_one_or_none()
    if stay is None:
        raise HTTPException(status_code=404, detail="Stay not found")
    for key, value in payload.model_dump(exclude={"amenities", "room_types", "images"}).items():
        setattr(stay, key, value)
    _replace_stay_children(stay, payload)
    if stay.status == "published":
        _require_publishable_stay(stay)
        if stay.published_at is None:
            stay.published_at = datetime.now(UTC)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A stay with this slug already exists")
    await session.refresh(stay)
    return {"id": stay.id, "slug": stay.slug, "status": stay.status}


@router.patch("/stays/{stay_id}/status", dependencies=[Depends(require_permission("stays:write"))])
async def update_stay_status(
    stay_id: int,
    payload: ContentStatusUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    stay = await session.get(Stay, stay_id)
    if stay is None or stay.site_id != site.id:
        raise HTTPException(status_code=404, detail="Stay not found")
    if stay.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot change status of a deleted stay")
    if payload.status == "published":
        stay = (
            await session.execute(
                select(Stay)
                .where(Stay.id == stay_id, Stay.site_id == site.id)
                .options(selectinload(Stay.room_types))
            )
        ).scalar_one()
        _require_publishable_stay(stay)
    stay.status = payload.status
    stay.published_at = datetime.now(UTC) if payload.status == "published" else stay.published_at
    await session.commit()
    return {"id": stay.id, "status": stay.status}


@router.post("/stays/{stay_id}/delete", dependencies=[Depends(require_permission("stays:write"))])
async def delete_stay(
    stay_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    stay = await session.get(Stay, stay_id)
    if stay is None or stay.site_id != site.id:
        raise HTTPException(status_code=404, detail="Stay not found")
    _soft_delete(stay)
    await session.commit()
    return {"id": stay.id, "deleted_at": stay.deleted_at, "status": stay.status}


@router.post("/stays/{stay_id}/restore", dependencies=[Depends(require_permission("stays:write"))])
async def restore_stay(
    stay_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    stay = await session.get(Stay, stay_id)
    if stay is None or stay.site_id != site.id:
        raise HTTPException(status_code=404, detail="Stay not found")
    _restore_soft_deleted(stay)
    await session.commit()
    return {"id": stay.id, "deleted_at": stay.deleted_at, "status": stay.status}


@router.post("/stays/{stay_id}/purge", dependencies=[Depends(require_permission("stays:write"))])
async def purge_stay(
    stay_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Delete for good. Only from the bin — see _require_in_bin."""
    stay = await session.get(Stay, stay_id)
    if stay is None or stay.site_id != site.id:
        raise HTTPException(status_code=404, detail="Stay not found")
    _require_in_bin(stay, "Stay")
    # Booking requests keep the stay they were made for (booking_requests.stay_id
    # has no ON DELETE), so the delete would fail on the foreign key and surface
    # as a 500. Say why instead; the stay can stay in the bin.
    referenced = await session.scalar(
        select(func.count()).select_from(BookingRequest).where(BookingRequest.stay_id == stay.id)
    )
    if referenced:
        raise HTTPException(
            status_code=409,
            detail=f"Stay has {referenced} booking request(s); it cannot be deleted permanently while they reference it",
        )
    # amenities / room_types / images are delete-orphan cascades on the
    # relationship, so the ORM removes them with the parent.
    await session.delete(stay)
    await session.commit()
    return {"id": stay_id, "purged": True}


@router.get("/cms/banners", dependencies=[Depends(require_permission("cms:read"))])
async def manage_banners(
    site: Site = Depends(get_admin_site),
    visibility: str = Query(default="active"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    visibility = _validate_visibility(visibility)
    query = select(Banner).where(Banner.site_id == site.id)
    clause = _visibility_clause(Banner, visibility)
    if clause is not None:
        query = query.where(clause)
    # Tie-break on id so paginated ties keep a stable order (else rows can duplicate/drop across pages).
    banners = (await session.execute(query.order_by(Banner.sort_order, Banner.id).offset(skip).limit(limit))).scalars().all()
    return [_banner_payload(banner) for banner in banners]


@router.get("/cms/banners/{banner_id}", dependencies=[Depends(require_permission("cms:read"))])
async def get_banner(
    banner_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    banner = await session.get(Banner, banner_id)
    if banner is None or banner.site_id != site.id:
        raise HTTPException(status_code=404, detail="Banner not found")
    return _banner_payload(banner)


@router.post("/cms/banners", status_code=201, dependencies=[Depends(require_permission("cms:write"))])
async def create_banner(
    payload: BannerAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    banner = Banner(**payload.model_dump(), site_id=site.id)
    if banner.status == "published":
        _require_publishable_banner(banner)
    session.add(banner)
    await session.commit()
    await session.refresh(banner)
    return {"id": banner.id, "status": banner.status}


@router.put("/cms/banners/{banner_id}", dependencies=[Depends(require_permission("cms:write"))])
async def update_banner(
    banner_id: int,
    payload: BannerAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    banner = await session.get(Banner, banner_id)
    if banner is None or banner.site_id != site.id:
        raise HTTPException(status_code=404, detail="Banner not found")
    for key, value in payload.model_dump().items():
        setattr(banner, key, value)
    if banner.status == "published":
        _require_publishable_banner(banner)
    await session.commit()
    return {"id": banner.id, "status": banner.status}


@router.patch("/cms/banners/{banner_id}/status", dependencies=[Depends(require_permission("cms:write"))])
async def update_banner_status(
    banner_id: int,
    payload: ContentStatusUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    banner = await session.get(Banner, banner_id)
    if banner is None or banner.site_id != site.id:
        raise HTTPException(status_code=404, detail="Banner not found")
    if banner.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot change status of a deleted banner")
    if payload.status == "published":
        _require_publishable_banner(banner)
    banner.status = payload.status
    await session.commit()
    return {"id": banner.id, "status": banner.status}


@router.post("/cms/banners/{banner_id}/delete", dependencies=[Depends(require_permission("cms:write"))])
async def delete_banner(
    banner_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    banner = await session.get(Banner, banner_id)
    if banner is None or banner.site_id != site.id:
        raise HTTPException(status_code=404, detail="Banner not found")
    _soft_delete(banner)
    await session.commit()
    return {"id": banner.id, "deleted_at": banner.deleted_at, "status": banner.status}


@router.post("/cms/banners/{banner_id}/restore", dependencies=[Depends(require_permission("cms:write"))])
async def restore_banner(
    banner_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    banner = await session.get(Banner, banner_id)
    if banner is None or banner.site_id != site.id:
        raise HTTPException(status_code=404, detail="Banner not found")
    _restore_soft_deleted(banner)
    await session.commit()
    return {"id": banner.id, "deleted_at": banner.deleted_at, "status": banner.status}


@router.post("/cms/banners/{banner_id}/purge", dependencies=[Depends(require_permission("cms:write"))])
async def purge_banner(
    banner_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    banner = await session.get(Banner, banner_id)
    if banner is None or banner.site_id != site.id:
        raise HTTPException(status_code=404, detail="Banner not found")
    _require_in_bin(banner, "Banner")
    await session.delete(banner)
    await session.commit()
    return {"id": banner_id, "purged": True}


@router.get("/cms/pages", dependencies=[Depends(require_permission("cms:read"))])
async def manage_pages(
    site: Site = Depends(get_admin_site),
    visibility: str = Query(default="active"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    visibility = _validate_visibility(visibility)
    query = select(Page).where(Page.site_id == site.id)
    clause = _visibility_clause(Page, visibility)
    if clause is not None:
        query = query.where(clause)
    # Honour the sort_order the admin edits, matching the public list ordering.
    pages = (await session.execute(query.order_by(Page.sort_order, Page.id.desc()).offset(skip).limit(limit))).scalars().all()
    return [_page_payload(page) for page in pages]


class CategoryUpsert(BaseModel):
    key: str = Field(default="", pattern=r"^(?:[a-z][a-z0-9_-]{0,39})?$")
    name_zh: str = Field(min_length=1, max_length=120)
    name_en: str = Field(default="", max_length=120)
    status: str = Field(default="active", pattern=r"^(active|archived)$")


@router.get("/cms/categories", dependencies=[Depends(require_permission("cms:read"))])
async def manage_categories(site: Site = Depends(get_admin_site)) -> list[dict[str, object]]:
    registry = category_registry(site.settings, site.parent_site_id is None)
    return [{"key": key, **value} for key, value in registry.items()]


@router.post("/cms/categories", dependencies=[Depends(require_permission("cms:write"))], status_code=201)
async def create_category(payload: CategoryUpsert, site: Site = Depends(get_admin_site), session: AsyncSession = Depends(get_session)) -> dict:
    registry = category_registry(site.settings, site.parent_site_id is None)
    if not payload.key:
        # Page.content_type is VARCHAR(40) in PostgreSQL. Leave room for
        # the collision suffix; SQLite QA does not enforce that column size.
        candidate = re.sub(r"[^a-z0-9]+", "-", payload.name_en.lower()).strip("-")[:31].rstrip("-")
        if not candidate or not candidate[0].isalpha():
            candidate = "category-" + secrets.token_hex(4)
        if candidate in registry:
            candidate += "-" + secrets.token_hex(4)
        payload = payload.model_copy(update={"key": candidate})
    if payload.key in registry:
        raise HTTPException(status_code=409, detail="Category key already exists")
    if not payload.name_zh.strip():
        raise HTTPException(status_code=422, detail="Chinese name is required")
    registry[payload.key] = {"label": {"zh": payload.name_zh.strip(), "en": payload.name_en.strip()}, "status": payload.status, "sort_order": max((value.get("sort_order", 99) for value in registry.values()), default=-1) + 1}
    site.settings = {**(site.settings or {}), "article_categories": registry}
    await session.commit()
    return {"key": payload.key, **registry[payload.key]}


@router.put("/cms/categories/{key}", dependencies=[Depends(require_permission("cms:write"))])
async def update_category(key: str, payload: CategoryUpsert, site: Site = Depends(get_admin_site), session: AsyncSession = Depends(get_session)) -> dict:
    registry = category_registry(site.settings, site.parent_site_id is None)
    if key not in registry: raise HTTPException(status_code=404, detail="Category not found")
    if payload.key != key: raise HTTPException(status_code=422, detail="Category keys cannot be renamed")
    if not payload.name_zh.strip(): raise HTTPException(status_code=422, detail="Chinese name is required")
    registry[key] = {**registry[key], "label": {"zh": payload.name_zh.strip(), "en": payload.name_en.strip()}, "status": payload.status}
    site.settings = {**(site.settings or {}), "article_categories": registry}
    await session.commit()
    return {"key": key, **registry[key]}


class WebsitePageCreate(BaseModel):
    name_zh: str = Field(min_length=1, max_length=120)
    name_en: str = Field(default="", max_length=120)
    slug: str = Field(default="", pattern=r"^(?:[a-z][a-z0-9-]{0,119})?$")
    categories: list[str] = Field(default_factory=list, max_length=100)


@router.post("/cms/listing-pages", dependencies=[Depends(require_permission("site_users:write"))], status_code=201)
async def create_website_page(payload: WebsitePageCreate, site: Site = Depends(get_admin_site), session: AsyncSession = Depends(get_session)) -> dict:
    if not payload.name_zh.strip():
        raise HTTPException(status_code=422, detail="Chinese name is required")
    settings = dict(site.settings or {})
    pages = dict(settings.get("pages") or {})
    registry = category_registry(settings, site.parent_site_id is None)
    selected = list(dict.fromkeys(payload.categories))
    if any(key not in registry or registry[key].get("status") == "archived" for key in selected):
        raise HTTPException(status_code=422, detail="Choose active categories in this site")
    slug = payload.slug
    if not slug:
        candidate = re.sub(r"[^a-z0-9]+", "-", payload.name_en.lower()).strip("-")[:100]
        slug = candidate if candidate and candidate[0].isalpha() else "page-" + secrets.token_hex(4)
        if slug in pages:
            slug += "-" + secrets.token_hex(4)
    reserved = {"homepage", "admin", "api", "storage", "stays", "contact", "privacy", "page", "newsletter", "property", "home", "about", "about-us", "blog", "rooms", "villas", "media", "press", "jobs", "faq", "service"}
    if not payload.slug and slug in reserved:
        slug += "-" + secrets.token_hex(4)
    if slug in reserved:
        raise HTTPException(status_code=422, detail="This URL is reserved for a system page")
    if slug in pages:
        raise HTTPException(status_code=409, detail="Page URL already exists")
    pages[slug] = {
        "label": {"zh": payload.name_zh.strip(), "en": payload.name_en.strip()},
        "page_type": "cms_list" if selected else "blocks",
        "article_categories": selected, "content_type": selected[0] if selected else "",
        "extra_content_types": selected[1:], "show_cms_list": bool(selected),
        "blocks": [], "seo": {}, "nav_hidden": True, "footer_hidden": True,
        "sort_order": max((cfg.get("sort_order", 99) for cfg in pages.values() if isinstance(cfg, dict)), default=-1) + 1,
    }
    site.settings = {**settings, "pages": pages, "article_categories": registry}
    await session.commit()
    return {"page_key": slug, "categories": selected}


class ListingCategoriesUpsert(BaseModel):
    categories: list[str] = Field(max_length=100)


@router.put("/cms/listing-pages/{page_key}/categories", dependencies=[Depends(require_permission("site_users:write"))])
async def bind_listing_categories(page_key: str, payload: ListingCategoriesUpsert, site: Site = Depends(get_admin_site), session: AsyncSession = Depends(get_session)) -> dict:
    settings = dict(site.settings or {})
    pages = dict(settings.get("pages") or {})
    if page_key not in pages or page_key == "homepage" or pages[page_key].get("deleted"):
        raise HTTPException(status_code=404, detail="Page not found")
    registry = category_registry(settings, site.parent_site_id is None)
    keys = list(dict.fromkeys(payload.categories))
    cfg = dict(pages[page_key])
    previous = cfg.get("article_categories")
    if not isinstance(previous, list):
        previous = [cfg.get("content_type") or page_key, *(cfg.get("extra_content_types") or [])]
    if any(key not in registry or (registry[key].get("status") == "archived" and key not in previous) for key in keys):
        raise HTTPException(status_code=422, detail="Choose active categories in this site")
    cfg.update({"article_categories": keys, "show_cms_list": bool(keys)})
    if keys:
        cfg.update({"page_type": "cms_list", "content_type": keys[0], "extra_content_types": keys[1:]})
    else:
        cfg.update({"page_type": "blocks", "content_type": "", "extra_content_types": []})
    pages[page_key] = cfg
    site.settings = {**settings, "article_categories": registry, "pages": pages}
    await session.commit()
    return {"page_key": page_key, "categories": keys}


@router.get("/cms/tags", dependencies=[Depends(require_permission("cms:read"))])
async def manage_content_tags(
    site: Site = Depends(get_admin_site),
    include_archived: bool = Query(default=True),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    """List only the current site's bilingual editorial tag vocabulary."""
    query = select(ContentTag).where(ContentTag.site_id == site.id)
    if not include_archived:
        query = query.where(ContentTag.status == "active")
    tags = (await session.execute(query.order_by(ContentTag.sort_order, ContentTag.id))).scalars().all()
    pages = (
        await session.execute(
            select(Page.tags, Page.translations)
            .where(Page.site_id == site.id, Page.deleted_at.is_(None))
        )
    ).all()
    usage: dict[str, int] = {}
    for tags_value, translations in pages:
        values: set[str] = set()
        for raw in tags_value or []:
            value = str(raw or "").strip().casefold()
            if value:
                values.add(value)
        if isinstance(translations, dict):
            for locale in ("zh", "en"):
                data = translations.get(locale)
                raw = data.get("tags") if isinstance(data, dict) else None
                items = raw if isinstance(raw, list) else str(raw or "").split(",")
                values.update(str(item or "").strip().casefold() for item in items if str(item or "").strip())
        for value in values:
            usage[value] = usage.get(value, 0) + 1
    return [
        _tag_payload(
            tag,
            max(
                usage.get(str(tag.name_zh).strip().casefold(), 0),
                usage.get(str(tag.name_en).strip().casefold(), 0) if tag.name_en else 0,
                usage.get(str(tag.slug).strip().casefold(), 0),
            ),
        )
        for tag in tags
    ]


@router.post("/cms/tags", status_code=201, dependencies=[Depends(require_permission("cms:write"))])
async def create_content_tag(
    payload: ContentTagAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    name_zh = payload.name_zh.strip()
    name_en = payload.name_en.strip()
    if not name_zh:
        raise HTTPException(status_code=422, detail="Chinese tag name is required")
    slug = _normalise_content_tag_slug(payload.slug, name_zh, name_en)
    tag = ContentTag(
        site_id=site.id,
        slug=slug,
        name_zh=name_zh,
        name_en=name_en,
        status=payload.status,
        sort_order=payload.sort_order,
    )
    session.add(tag)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A tag with this slug already exists on this site")
    await session.refresh(tag)
    return _tag_payload(tag)


@router.put("/cms/tags/{tag_id}", dependencies=[Depends(require_permission("cms:write"))])
async def update_content_tag(
    tag_id: int,
    payload: ContentTagAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    tag = await session.get(ContentTag, tag_id)
    if tag is None or tag.site_id != site.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    name_zh = payload.name_zh.strip()
    name_en = payload.name_en.strip()
    if not name_zh:
        raise HTTPException(status_code=422, detail="Chinese tag name is required")
    new_slug = _normalise_content_tag_slug(payload.slug, name_zh, name_en)
    old_names = {"zh": tag.name_zh, "en": tag.name_en, "slug": tag.slug}
    new_names = {"zh": name_zh, "en": name_en, "slug": new_slug}
    if old_names != new_names:
        await rename_tag_references(session, site, old_names, new_names)
    tag.slug = new_slug
    tag.name_zh = name_zh
    tag.name_en = name_en
    tag.status = payload.status
    tag.sort_order = payload.sort_order
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A tag with this slug already exists on this site")
    await session.refresh(tag)
    return _tag_payload(tag)


@router.patch("/cms/tags/{tag_id}/status", dependencies=[Depends(require_permission("cms:write"))])
async def update_content_tag_status(
    tag_id: int,
    payload: ContentTagStatusUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    if payload.status not in {"active", "archived"}:
        raise HTTPException(status_code=422, detail="Tag status must be active or archived")
    tag = await session.get(ContentTag, tag_id)
    if tag is None or tag.site_id != site.id:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag.status = payload.status
    await session.commit()
    return _tag_payload(tag)


@router.get("/cms/pages/{page_id}", dependencies=[Depends(require_permission("cms:read"))])
async def get_page(
    page_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    page = await session.get(Page, page_id)
    if page is None or page.site_id != site.id:
        raise HTTPException(status_code=404, detail="Page not found")
    return _page_payload(page)


@router.post("/cms/pages", status_code=201, dependencies=[Depends(require_permission("cms:write"))])
async def create_page(
    payload: PageAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    values = payload.model_dump()
    values["slug"] = values.get("slug") or None
    values["categories"] = _normalise_page_categories(values["content_type"], values.get("categories"))
    page = Page(**values, site_id=site.id)
    if page.status == "published":
        _require_publishable_page(page)
        page.published_at = datetime.now(UTC)
    session.add(page)
    await session.commit()
    await session.refresh(page)
    return {"id": page.id, "slug": page.slug, "status": page.status}


@router.put("/cms/pages/{page_id}", dependencies=[Depends(require_permission("cms:write"))])
async def update_page(
    page_id: int,
    payload: PageAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    page = await session.get(Page, page_id)
    if page is None or page.site_id != site.id:
        raise HTTPException(status_code=404, detail="Page not found")
    values = payload.model_dump()
    values["slug"] = values.get("slug") or None
    values["categories"] = _normalise_page_categories(values["content_type"], values.get("categories"))
    for key, value in values.items():
        setattr(page, key, value)
    if page.status == "published":
        _require_publishable_page(page)
        if page.published_at is None:
            page.published_at = datetime.now(UTC)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A page with this slug already exists")
    return {"id": page.id, "slug": page.slug, "status": page.status}


@router.patch("/cms/pages/{page_id}/status", dependencies=[Depends(require_permission("cms:write"))])
async def update_page_status(
    page_id: int,
    payload: ContentStatusUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    page = await session.get(Page, page_id)
    if page is None or page.site_id != site.id:
        raise HTTPException(status_code=404, detail="Page not found")
    if page.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot change status of a deleted page")
    if payload.status == "published":
        _require_publishable_page(page)
    page.status = payload.status
    if page.status == "published" and page.published_at is None:
        page.published_at = datetime.now(UTC)
    await session.commit()
    return {"id": page.id, "status": page.status}


@router.post("/cms/pages/{page_id}/delete", dependencies=[Depends(require_permission("cms:write"))])
async def delete_page(
    page_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    page = await session.get(Page, page_id)
    if page is None or page.site_id != site.id:
        raise HTTPException(status_code=404, detail="Page not found")
    _soft_delete(page)
    await session.commit()
    return {"id": page.id, "deleted_at": page.deleted_at, "status": page.status}


@router.post("/cms/pages/{page_id}/restore", dependencies=[Depends(require_permission("cms:write"))])
async def restore_page(
    page_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    page = await session.get(Page, page_id)
    if page is None or page.site_id != site.id:
        raise HTTPException(status_code=404, detail="Page not found")
    _restore_soft_deleted(page)
    await session.commit()
    return {"id": page.id, "deleted_at": page.deleted_at, "status": page.status}


@router.post("/cms/pages/{page_id}/purge", dependencies=[Depends(require_permission("cms:write"))])
async def purge_page(
    page_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    page = await session.get(Page, page_id)
    if page is None or page.site_id != site.id:
        raise HTTPException(status_code=404, detail="Page not found")
    _require_in_bin(page, "Page")
    await session.delete(page)
    await session.commit()
    return {"id": page_id, "purged": True}


@router.get("/cms/announcements", dependencies=[Depends(require_permission("cms:read"))])
async def manage_announcements(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    items = (
        await session.execute(select(Announcement).where(Announcement.site_id == site.id).order_by(Announcement.id.desc()).offset(skip).limit(limit))
    ).scalars().all()
    return [_announcement_payload(item) for item in items]


@router.post("/cms/announcements", status_code=201, dependencies=[Depends(require_permission("cms:write"))])
async def create_announcement(
    payload: AnnouncementAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    item = Announcement(**payload.model_dump(), site_id=site.id)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return {"id": item.id, "status": item.status}


@router.put("/cms/announcements/{announcement_id}", dependencies=[Depends(require_permission("cms:write"))])
async def update_announcement(
    announcement_id: int,
    payload: AnnouncementAdminUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    item = await session.get(Announcement, announcement_id)
    if item is None or item.site_id != site.id:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    await session.commit()
    return {"id": item.id, "status": item.status}


def like_pattern(keyword: str) -> str:
    """Wrap a search term in wildcards, escaping any the user typed.

    The backslash is escaped first. Doing it after % and _ would escape the
    backslashes this function had just added and turn its own escapes back into
    wildcards.
    """
    escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _inquiry_keyword_filter(keyword: str):
    """Match a keyword across the fields staff actually search an enquiry by.

    The meeting asked whether enquiries could be routed to a person by type and
    settled on this instead: staff know the name, the subject line, or a phrase
    from the message, and no scheme of categories survives contact with what
    people type into a form.

    ILIKE with an explicit escape so a literal % or _ in the search stays
    literal — without it someone searching "100%" would match every row.
    """
    pattern = like_pattern(keyword)
    return or_(
        Inquiry.name.ilike(pattern, escape="\\"),
        Inquiry.email.ilike(pattern, escape="\\"),
        Inquiry.phone.ilike(pattern, escape="\\"),
        Inquiry.line_id.ilike(pattern, escape="\\"),
        Inquiry.subject.ilike(pattern, escape="\\"),
        Inquiry.message.ilike(pattern, escape="\\"),
    )


@router.get("/inquiries", dependencies=[Depends(require_permission("inquiries:read"))])
async def manage_inquiries(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    visibility: str = Query(default="active"),
    q: str = Query(default="", max_length=120),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    visibility = _validate_visibility(visibility)
    conditions = [Inquiry.site_id == site.id]
    if visibility == "deleted":
        conditions.append(Inquiry.deleted_at.is_not(None))
    elif visibility == "active":
        conditions.append(Inquiry.deleted_at.is_(None))
    keyword = q.strip()
    if keyword:
        conditions.append(_inquiry_keyword_filter(keyword))
    inquiries = (
        await session.execute(select(Inquiry).where(*conditions).order_by(Inquiry.id.desc()).offset(skip).limit(limit))
    ).scalars().all()
    return [_inquiry_payload(inquiry) for inquiry in inquiries]


@router.get("/inquiries/export.csv", dependencies=[Depends(require_permission("inquiries:read"))])
async def export_inquiries(
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    inquiries = (
        await session.execute(
            select(Inquiry)
            .where(Inquiry.site_id == site.id, Inquiry.deleted_at.is_(None))
            .order_by(Inquiry.id.desc())
        )
    ).scalars().all()
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "id",
            "name",
            "email",
            "phone",
            "line_id",
            "stay_id",
            "check_in",
            "check_out",
            "guests",
            "status",
            "source",
            "subject",
            "message",
            "created_at",
        ]
    )
    for inquiry in inquiries:
        writer.writerow(
            [
                inquiry.id,
                _csv_safe(inquiry.name),
                _csv_safe(inquiry.email),
                _csv_safe(inquiry.phone or ""),
                _csv_safe(inquiry.line_id or ""),
                inquiry.stay_id or "",
                inquiry.check_in or "",
                inquiry.check_out or "",
                inquiry.guests,
                inquiry.status,
                _csv_safe(inquiry.source),
                _csv_safe(inquiry.subject or ""),
                _csv_safe(inquiry.message),
                inquiry.created_at or "",
            ]
        )
    buffer.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="inquiries.csv"'}
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv; charset=utf-8", headers=headers)


@router.patch("/inquiries/{inquiry_id}/status", dependencies=[Depends(require_permission("inquiries:write"))])
async def update_inquiry_status(
    inquiry_id: int,
    payload: InquiryStatusUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    inquiry = await session.get(Inquiry, inquiry_id)
    if inquiry is None or inquiry.site_id != site.id:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    # The same rule every other status verb here already has (stay, page,
    # banner, campaign): a row in 已刪除 is not a row you file. It was missing on
    # the two inbox tables, and a stale button left over from a rendering bug
    # filed a soft-deleted enquiry as 已聯繫 — the status changed while the row
    # stayed in the bin. The admin hides these buttons on a deleted row, which is
    # exactly why the API must not be the thing relying on that.
    if inquiry.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot change status of a deleted inquiry")
    inquiry.status = payload.status
    await session.commit()
    return {"id": inquiry.id, "status": inquiry.status}


@router.delete("/inquiries/{inquiry_id}", dependencies=[Depends(require_permission("inquiries:write"))])
async def delete_inquiry(
    inquiry_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Soft delete — spam and test entries leave the list, not the database."""
    inquiry = await session.get(Inquiry, inquiry_id)
    if inquiry is None or inquiry.site_id != site.id:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    inquiry.deleted_at = datetime.now(UTC)
    await session.commit()
    return {"id": inquiry.id, "deleted_at": inquiry.deleted_at}


@router.post("/inquiries/{inquiry_id}/restore", dependencies=[Depends(require_permission("inquiries:write"))])
async def restore_inquiry(
    inquiry_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    inquiry = await session.get(Inquiry, inquiry_id)
    if inquiry is None or inquiry.site_id != site.id:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    inquiry.deleted_at = None
    await session.commit()
    return {"id": inquiry.id, "deleted_at": None}


@router.post("/inquiries/{inquiry_id}/purge", dependencies=[Depends(require_permission("inquiries:write"))])
async def purge_inquiry(
    inquiry_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    inquiry = await session.get(Inquiry, inquiry_id)
    if inquiry is None or inquiry.site_id != site.id:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    _require_in_bin(inquiry, "Inquiry")
    await session.delete(inquiry)
    await session.commit()
    return {"id": inquiry_id, "purged": True}


def _booking_keyword_filter(keyword: str):
    """The enquiry keyword search, over the booking table.

    Both inboxes are one screen now (表單聯絡), under one search box. Only the
    enquiry side had a server-side search, so a keyword found any enquiry in the
    table but only the bookings inside the newest `limit` rows the list happened
    to return — past 200 bookings, searching for an older one came back empty
    while the identical enquiry was found, with nothing on screen to say why.

    room_type joins the enquiry fields: it is the one column a booking has and
    an enquiry does not, and it is what staff scan a booking by.
    """
    pattern = like_pattern(keyword)
    return or_(
        BookingRequest.name.ilike(pattern, escape="\\"),
        BookingRequest.email.ilike(pattern, escape="\\"),
        BookingRequest.phone.ilike(pattern, escape="\\"),
        BookingRequest.line_id.ilike(pattern, escape="\\"),
        BookingRequest.message.ilike(pattern, escape="\\"),
        BookingRequest.room_type.ilike(pattern, escape="\\"),
    )


@router.get("/booking-requests", dependencies=[Depends(require_permission("inquiries:read"))])
async def manage_booking_requests(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    visibility: str = Query(default="active"),
    q: str = Query(default=""),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    visibility = _validate_visibility(visibility)
    conditions = [BookingRequest.site_id == site.id]
    keyword = q.strip()
    if keyword:
        conditions.append(_booking_keyword_filter(keyword))
    if visibility == "deleted":
        conditions.append(BookingRequest.deleted_at.is_not(None))
    elif visibility == "active":
        conditions.append(BookingRequest.deleted_at.is_(None))
    bookings = (
        await session.execute(select(BookingRequest).where(*conditions).order_by(BookingRequest.id.desc()).offset(skip).limit(limit))
    ).scalars().all()
    return [_booking_payload(booking) for booking in bookings]


@router.get("/booking-requests/export.csv", dependencies=[Depends(require_permission("inquiries:read"))])
async def export_booking_requests(
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    bookings = (
        await session.execute(
            select(BookingRequest)
            .where(BookingRequest.site_id == site.id, BookingRequest.deleted_at.is_(None))
            .order_by(BookingRequest.id.desc())
        )
    ).scalars().all()
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "stay_id", "room_type", "name", "email", "phone", "line_id", "check_in", "check_out", "guests", "status", "message", "admin_note", "created_at"])
    for booking in bookings:
        writer.writerow([booking.id, booking.stay_id or "", _csv_safe(booking.room_type), _csv_safe(booking.name), _csv_safe(booking.email), _csv_safe(booking.phone or ""), _csv_safe(booking.line_id or ""), booking.check_in or "", booking.check_out or "", booking.guests, booking.status, _csv_safe(booking.message), _csv_safe(booking.admin_note), booking.created_at or ""])
    buffer.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="booking-requests.csv"'}
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv; charset=utf-8", headers=headers)


@router.patch("/booking-requests/{booking_id}/status", dependencies=[Depends(require_permission("inquiries:write"))])
async def update_booking_request_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    booking = await session.get(BookingRequest, booking_id)
    if booking is None or booking.site_id != site.id:
        raise HTTPException(status_code=404, detail="Booking request not found")
    # See update_inquiry_status: the inbox is two tables behind one list, so the
    # rule has to hold on both or the gap simply moves.
    if booking.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot change status of a deleted booking request")
    booking.status = payload.status
    await session.commit()
    return {"id": booking.id, "status": booking.status}


@router.delete("/booking-requests/{booking_id}", dependencies=[Depends(require_permission("inquiries:write"))])
async def delete_booking_request(
    booking_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Soft delete, as with inquiries.

    There was no delete of any kind here: a spam or test booking stayed in the
    inbox permanently, and the only way to remove one was psql.
    """
    booking = await session.get(BookingRequest, booking_id)
    if booking is None or booking.site_id != site.id:
        raise HTTPException(status_code=404, detail="Booking request not found")
    booking.deleted_at = datetime.now(UTC)
    await session.commit()
    return {"id": booking.id, "deleted_at": booking.deleted_at}


@router.post("/booking-requests/{booking_id}/restore", dependencies=[Depends(require_permission("inquiries:write"))])
async def restore_booking_request(
    booking_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    booking = await session.get(BookingRequest, booking_id)
    if booking is None or booking.site_id != site.id:
        raise HTTPException(status_code=404, detail="Booking request not found")
    booking.deleted_at = None
    await session.commit()
    return {"id": booking.id, "deleted_at": None}


@router.post("/booking-requests/{booking_id}/purge", dependencies=[Depends(require_permission("inquiries:write"))])
async def purge_booking_request(
    booking_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    booking = await session.get(BookingRequest, booking_id)
    if booking is None or booking.site_id != site.id:
        raise HTTPException(status_code=404, detail="Booking request not found")
    _require_in_bin(booking, "Booking request")
    await session.delete(booking)
    await session.commit()
    return {"id": booking_id, "purged": True}


@router.get("/newsletter/subscribers", dependencies=[Depends(require_permission("newsletter:read"))])
async def manage_newsletter_subscribers(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    site: Site = Depends(get_admin_site),
    visibility: str = Query(default="active"),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    visibility = _validate_visibility(visibility)
    query = select(NewsletterSubscriber).where(NewsletterSubscriber.site_id == site.id)
    clause = _visibility_clause(NewsletterSubscriber, visibility)
    if clause is not None:
        query = query.where(clause)
    subscribers = (
        await session.execute(
            query.order_by(NewsletterSubscriber.id.desc()).offset(skip).limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": item.id,
            "email": item.email,
            "name": item.name,
            "groups": item.groups,
            "status": item.status,
            "created_at": item.created_at,
            "deleted_at": item.deleted_at,
        }
        for item in subscribers
    ]


@router.post("/newsletter/subscribers", status_code=201, dependencies=[Depends(require_permission("newsletter:write"))])
async def create_newsletter_subscriber(
    payload: NewsletterSubscriberUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    email = payload.email.strip().lower()
    existing = (
        await session.execute(
            select(NewsletterSubscriber).where(NewsletterSubscriber.site_id == site.id, NewsletterSubscriber.email == email)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="This email already exists. Edit or restore the existing subscriber.")
    subscriber = NewsletterSubscriber(
        site_id=site.id,
        email=email,
        name=payload.name.strip(),
        groups=payload.groups,
        status=payload.status,
        unsubscribe_token=secrets.token_urlsafe(32),
    )
    session.add(subscriber)
    await session.commit()
    await session.refresh(subscriber)
    return {"id": subscriber.id, "status": subscriber.status}


@router.put("/newsletter/subscribers/{subscriber_id}", dependencies=[Depends(require_permission("newsletter:write"))])
async def update_newsletter_subscriber(
    subscriber_id: int,
    payload: NewsletterSubscriberUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    subscriber = await session.get(NewsletterSubscriber, subscriber_id)
    if subscriber is None or subscriber.site_id != site.id:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    email = payload.email.strip().lower()
    if email != subscriber.email:
        clash = (
            await session.execute(
                select(NewsletterSubscriber).where(
                    NewsletterSubscriber.site_id == site.id,
                    NewsletterSubscriber.email == email,
                    NewsletterSubscriber.id != subscriber.id,
                )
            )
        ).scalar_one_or_none()
        if clash is not None:
            raise HTTPException(status_code=409, detail="Another subscriber already uses this email")
    subscriber.email = email
    subscriber.name = payload.name.strip()
    subscriber.groups = payload.groups
    subscriber.status = payload.status
    await session.commit()
    return {"id": subscriber.id, "status": subscriber.status}


@router.get("/newsletter/campaigns", dependencies=[Depends(require_permission("newsletter:read"))])
async def manage_newsletter_campaigns(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    site: Site = Depends(get_admin_site),
    visibility: str = Query(default="active"),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    visibility = _validate_visibility(visibility)
    query = select(NewsletterCampaign).where(NewsletterCampaign.site_id == site.id)
    clause = _visibility_clause(NewsletterCampaign, visibility)
    if clause is not None:
        query = query.where(clause)
    campaigns = (
        await session.execute(query.order_by(NewsletterCampaign.id.desc()).offset(skip).limit(limit))
    ).scalars().all()
    # Count in the database and only for the page being rendered: hydrating
    # every delivery row the site has ever sent, to produce one integer per
    # campaign, grows without bound while this list stays capped at 500.
    counts: dict[int, dict[str, int]] = {}
    campaign_ids = [campaign.id for campaign in campaigns]
    if campaign_ids:
        rows = await session.execute(
            select(NewsletterDelivery.campaign_id, NewsletterDelivery.status, func.count())
            .where(
                NewsletterDelivery.site_id == site.id,
                NewsletterDelivery.campaign_id.in_(campaign_ids),
            )
            .group_by(NewsletterDelivery.campaign_id, NewsletterDelivery.status)
        )
        for campaign_id, status, total in rows.all():
            counts.setdefault(campaign_id, {})[status] = total
    return [_campaign_payload(campaign, sum(counts.get(campaign.id, {}).values()), counts.get(campaign.id)) for campaign in campaigns]


@router.post("/newsletter/campaigns", status_code=201, dependencies=[Depends(require_permission("newsletter:write"))])
async def create_newsletter_campaign(
    payload: NewsletterCampaignUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    # recipient_scope="self+children" only makes sense on a parent site; reject
    # it on child sites so a child admin can't silently fan out to siblings.
    scope = payload.recipient_scope
    if scope == "self+children" and site.parent_site_id is not None:
        raise HTTPException(status_code=400, detail="recipient_scope 'self+children' is only valid on a parent site")
    campaign = NewsletterCampaign(
        site_id=site.id,
        subject=payload.subject.strip(),
        body=strip_clipboard_fragment_markers(payload.body),
        status="draft",
        target_groups=payload.target_groups,
        recipient_scope=scope,
    )
    session.add(campaign)
    await session.commit()
    await session.refresh(campaign)
    return {"id": campaign.id, "status": campaign.status}


@router.put("/newsletter/campaigns/{campaign_id}", dependencies=[Depends(require_permission("newsletter:write"))])
async def update_newsletter_campaign(
    campaign_id: int,
    payload: NewsletterCampaignUpsert,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    campaign = await session.get(NewsletterCampaign, campaign_id)
    if campaign is None or campaign.site_id != site.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Campaign is deleted")
    # Only draft campaigns are editable; once queued/sent the content is locked
    # so it can't drift away from what recipients already received.
    if campaign.status != "draft":
        raise HTTPException(status_code=400, detail=f"Campaign is {campaign.status}; only draft campaigns can be edited")
    # Same parent-site guard as the create path: a child admin must not be able
    # to reach the network-wide audience by editing a draft into that scope.
    if payload.recipient_scope == "self+children" and site.parent_site_id is not None:
        raise HTTPException(status_code=400, detail="recipient_scope 'self+children' is only valid on a parent site")
    campaign.subject = payload.subject.strip()
    campaign.body = strip_clipboard_fragment_markers(payload.body)
    campaign.target_groups = payload.target_groups
    campaign.recipient_scope = payload.recipient_scope
    await session.commit()
    return {"id": campaign.id, "status": campaign.status}


@router.post("/newsletter/campaigns/{campaign_id}/queue", dependencies=[Depends(require_permission("newsletter:write"))])
async def queue_newsletter_campaign(
    campaign_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    campaign = await session.get(NewsletterCampaign, campaign_id)
    if campaign is None or campaign.site_id != site.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Campaign is deleted")
    if campaign.status != "draft":
        raise HTTPException(status_code=400, detail=f"Campaign is already {campaign.status}; only draft campaigns can be queued")
    # Defence-in-depth: refuse cross-network fan-out from a child site even
    # if the campaign row somehow carries that scope.
    if campaign.recipient_scope == "self+children" and site.parent_site_id is not None:
        raise HTTPException(status_code=400, detail="Cross-network campaigns can only be queued from a parent site")
    # Build the site set: self, plus every *active* child of this site if
    # scope demands. Skipping non-active children prevents a campaign from
    # quietly mailing subscribers of an archived / disabled sibling.
    site_ids: list[int] = [site.id]
    if campaign.recipient_scope == "self+children" and site.parent_site_id is None:
        child_rows = await session.execute(
            select(Site.id).where(Site.parent_site_id == site.id, Site.status == "active")
        )
        site_ids.extend(child_rows.scalars().all())
    subscribers = (
        await session.execute(
            select(NewsletterSubscriber).where(
                NewsletterSubscriber.site_id.in_(site_ids),
                NewsletterSubscriber.status == "subscribed",
                NewsletterSubscriber.deleted_at.is_(None),
            )
        )
    ).scalars().all()
    target_groups = set(campaign.target_groups or [])
    recipients = [
        subscriber
        for subscriber in subscribers
        if not target_groups or target_groups.intersection(set(subscriber.groups or []))
    ]
    if not recipients:
        raise HTTPException(status_code=400, detail="No subscribed recipients match this campaign")

    # Claim the campaign before a single delivery row is built. A conditional
    # UPDATE serializes concurrent queue requests; the losing request matches
    # no row and cannot duplicate deliveries.
    claimed = await session.execute(
        update(NewsletterCampaign)
        .where(
            NewsletterCampaign.id == campaign.id,
            NewsletterCampaign.site_id == site.id,
            NewsletterCampaign.status == "draft",
            NewsletterCampaign.deleted_at.is_(None),
        )
        .values(status="queued", queued_at=datetime.now(UTC))
    )
    if claimed.rowcount == 0:
        raise HTTPException(status_code=409, detail="Campaign has already been queued")

    for subscriber in recipients:
        session.add(
            NewsletterDelivery(
                site_id=site.id,
                campaign_id=campaign.id,
                subscriber_id=subscriber.id,
                email=subscriber.email,
                status="pending",
            )
        )
    queued = len(recipients)
    await session.commit()
    return {"id": campaign.id, "queued": queued, "status": "queued"}


@router.post("/newsletter/campaigns/{campaign_id}/schedule", dependencies=[Depends(require_permission("newsletter:write"))])
async def schedule_newsletter_campaign(
    campaign_id: int,
    payload: NewsletterScheduleRequest,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    campaign = await session.get(NewsletterCampaign, campaign_id)
    if campaign is None or campaign.site_id != site.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Campaign is deleted")
    # Only campaigns that have already been queued (deliveries materialised)
    # can be scheduled — otherwise the tick has nothing to send.
    if campaign.status not in ("queued", "scheduled"):
        raise HTTPException(status_code=400, detail=f"Cannot schedule a {campaign.status} campaign; queue it first")
    pending_delivery = await session.execute(
        select(NewsletterDelivery.id)
        .where(
            NewsletterDelivery.site_id == site.id,
            NewsletterDelivery.campaign_id == campaign.id,
            NewsletterDelivery.status == "pending",
        )
        .limit(1)
    )
    if pending_delivery.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Campaign has no pending recipients")
    # Normalise naive datetimes to UTC so comparisons in the tick are sane.
    when = payload.scheduled_at
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    if when <= datetime.now(UTC):
        raise HTTPException(status_code=422, detail="scheduled_at must be in the future")
    campaign.status = "scheduled"
    campaign.scheduled_at = when
    await session.commit()
    return {"id": campaign.id, "status": campaign.status, "scheduled_at": campaign.scheduled_at}


@router.post("/newsletter/campaigns/{campaign_id}/unschedule", dependencies=[Depends(require_permission("newsletter:write"))])
async def unschedule_newsletter_campaign(
    campaign_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    campaign = await session.get(NewsletterCampaign, campaign_id)
    if campaign is None or campaign.site_id != site.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != "scheduled":
        raise HTTPException(status_code=400, detail=f"Campaign is {campaign.status}, not scheduled")
    campaign.status = "queued"
    campaign.scheduled_at = None
    await session.commit()
    return {"id": campaign.id, "status": campaign.status}


@router.post("/newsletter/campaigns/{campaign_id}/process", dependencies=[Depends(require_permission("newsletter:write"))])
async def process_newsletter_campaign(
    campaign_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    campaign = await session.get(NewsletterCampaign, campaign_id)
    if campaign is None or campaign.site_id != site.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Campaign is deleted")
    pending_delivery = await session.execute(
        select(NewsletterDelivery.id)
        .where(
            NewsletterDelivery.site_id == site.id,
            NewsletterDelivery.campaign_id == campaign.id,
            NewsletterDelivery.status == "pending",
        )
        .limit(1)
    )
    if pending_delivery.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Campaign has no pending recipients")
    # "Send now" — if it was scheduled, unschedule first so we don't double-send
    # if the tick fires before this commit lands.
    if campaign.status == "scheduled":
        campaign.status = "queued"
        campaign.scheduled_at = None
        await session.commit()
    # process_newsletter_queue filters on site + status only, so this drains
    # every queued campaign for the site, not just this one, and returns the
    # combined totals under the id the admin clicked. Left as is deliberately —
    # the queue is per-site and draining it early is harmless — but the reported
    # counts belong to the whole queue, so don't read them as this campaign's.
    result = await process_newsletter_queue(session, site.id)
    return {"id": campaign.id, **result}


@router.post("/newsletter/process", dependencies=[Depends(require_permission("newsletter:write"))])
async def process_newsletter(
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    return await process_newsletter_queue(session, site.id)


@router.post("/newsletter/retry-failed", dependencies=[Depends(require_permission("newsletter:write"))])
async def retry_failed_newsletter(
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    return await retry_failed_newsletter_deliveries(session, site.id)


@router.post("/newsletter/subscribers/{subscriber_id}/delete", dependencies=[Depends(require_permission("newsletter:write"))])
async def delete_newsletter_subscriber(
    subscriber_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    subscriber = await session.get(NewsletterSubscriber, subscriber_id)
    if subscriber is None or subscriber.site_id != site.id:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    _soft_delete(subscriber)
    await session.commit()
    return {"id": subscriber.id, "deleted_at": subscriber.deleted_at, "status": subscriber.status}


@router.post("/newsletter/subscribers/{subscriber_id}/restore", dependencies=[Depends(require_permission("newsletter:write"))])
async def restore_newsletter_subscriber(
    subscriber_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    subscriber = await session.get(NewsletterSubscriber, subscriber_id)
    if subscriber is None or subscriber.site_id != site.id:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    _restore_soft_deleted(subscriber)
    await session.commit()
    return {"id": subscriber.id, "deleted_at": subscriber.deleted_at, "status": subscriber.status}


@router.post("/newsletter/subscribers/{subscriber_id}/purge", dependencies=[Depends(require_permission("newsletter:write"))])
async def purge_subscriber(
    subscriber_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    subscriber = await session.get(NewsletterSubscriber, subscriber_id)
    if subscriber is None or subscriber.site_id != site.id:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    _require_in_bin(subscriber, "Subscriber")
    # Deliveries are the send log. Removing the subscriber must not erase the
    # record that mail went out — that record also feeds the daily cap — so the
    # link is cleared rather than the row destroyed.
    await session.execute(
        update(NewsletterDelivery)
        .where(NewsletterDelivery.subscriber_id == subscriber_id)
        .values(subscriber_id=None)
    )
    await session.delete(subscriber)
    await session.commit()
    return {"id": subscriber_id, "purged": True}


@router.post("/newsletter/campaigns/{campaign_id}/delete", dependencies=[Depends(require_permission("newsletter:write"))])
async def delete_newsletter_campaign(
    campaign_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    campaign = await session.get(NewsletterCampaign, campaign_id)
    if campaign is None or campaign.site_id != site.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    _soft_delete(campaign)
    await session.commit()
    return {"id": campaign.id, "deleted_at": campaign.deleted_at, "status": campaign.status}


@router.post("/newsletter/campaigns/{campaign_id}/restore", dependencies=[Depends(require_permission("newsletter:write"))])
async def restore_newsletter_campaign(
    campaign_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    campaign = await session.get(NewsletterCampaign, campaign_id)
    if campaign is None or campaign.site_id != site.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    _restore_soft_deleted(campaign)
    await session.commit()
    return {"id": campaign.id, "deleted_at": campaign.deleted_at, "status": campaign.status}


@router.post("/newsletter/campaigns/{campaign_id}/purge", dependencies=[Depends(require_permission("newsletter:write"))])
async def purge_campaign(
    campaign_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    campaign = await session.get(NewsletterCampaign, campaign_id)
    if campaign is None or campaign.site_id != site.id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    _require_in_bin(campaign, "Campaign")
    # Same reasoning as the subscriber purge: keep the send log, drop the link.
    await session.execute(
        update(NewsletterDelivery)
        .where(NewsletterDelivery.campaign_id == campaign_id)
        .values(campaign_id=None)
    )
    await session.delete(campaign)
    await session.commit()
    return {"id": campaign_id, "purged": True}


@router.get("/media", dependencies=[Depends(require_permission("media:read"))])
async def manage_media(
    request: Request,
    skip: int = Query(default=0, ge=0),
    limit: int | None = Query(default=None, ge=1, le=5000),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    query = select(MediaAsset).where(MediaAsset.site_id == site.id).order_by(MediaAsset.id.desc()).offset(skip)
    if limit is not None:
        query = query.limit(limit)
    assets = (await session.execute(query)).scalars().all()
    return [
        {
            "id": asset.id,
            "file": asset.storage_key or asset.url,
            "display_name": asset.display_name or asset.storage_key or Path(asset.url).name,
            "alt": asset.alt_text,
            "type": asset.mime_type,
            "url": asset.url,
            "poster_url": asset.poster_url,
            "created_at": asset.created_at,
        }
        for asset in assets
    ]


@router.get("/media/summary", dependencies=[Depends(require_permission("media:read"))])
async def media_summary(
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    total, videos = (
        await session.execute(
            select(
                func.count(MediaAsset.id),
                func.count(MediaAsset.id).filter(MediaAsset.mime_type.like("video/%")),
            ).where(MediaAsset.site_id == site.id)
        )
    ).one()
    total_count = int(total or 0)
    video_count = int(videos or 0)
    return {"total": total_count, "images": total_count - video_count, "videos": video_count}


@router.get("/media/overview", dependencies=[Depends(require_permission("media:read"))])
async def media_overview(
    request: Request,
    limit: int = Query(default=48, ge=1, le=500),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Initial media page data in one authenticated request.

    The page previously resolved the admin, site and permissions twice through
    two parallel HTTP requests.  Combining the first page and counters removes
    one full server-to-server request while preserving the paged list endpoint
    used by Load more and filtering.
    """
    assets = (
        await session.execute(
            select(MediaAsset)
            .where(MediaAsset.site_id == site.id)
            .order_by(MediaAsset.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    total, videos = (
        await session.execute(
            select(
                func.count(MediaAsset.id),
                func.count(MediaAsset.id).filter(MediaAsset.mime_type.like("video/%")),
            ).where(MediaAsset.site_id == site.id)
        )
    ).one()
    total_count = int(total or 0)
    return {
        "media": [
            {
                "id": asset.id,
                "file": asset.storage_key or asset.url,
                "display_name": asset.display_name or asset.storage_key or Path(asset.url).name,
                "alt": asset.alt_text,
                "type": asset.mime_type,
                "url": asset.url,
                "poster_url": asset.poster_url,
                "created_at": asset.created_at,
            }
            for asset in assets
        ],
        "summary": {
            "total": total_count,
            "images": total_count - int(videos or 0),
            "videos": int(videos or 0),
        },
    }


@router.post("/media", status_code=201, dependencies=[Depends(require_permission("media:write"))])
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    alt_text: str = Form(default=""),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Upload into the caller's own media library.

    This used to re-register the public handler, which resolves the site from a
    query parameter. `media:write` was checked but the tenant was not, so an
    admin of one villa could file an upload under another site simply by naming
    it, while the read and delete routes either side of this one were scoped by
    `get_admin_site`.
    """
    return await store_media_asset(request, session, site.id, file, alt_text)


@router.get("/media/{media_id}/usage", dependencies=[Depends(require_permission("media:read"))])
async def media_usage(
    media_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Where this image is still in use, so deleting it is an informed choice.

    Media deletion is permanent and unlinks the file. Nothing checked whether
    anything still pointed at it, so removing an image that was a stay's hero
    or sat inside a published article silently broke those pages — the admin
    said "deleted", the visitor got a broken image, and there was no way to
    find out beforehand.

    Both places a URL can hide are searched: the scalar columns that hold one
    directly, and the JSON blobs where the block editors keep theirs. The JSON
    side is a substring match on the serialised document, which is why the url
    is matched rather than the id — a block can store the same url under any
    key, and there is no schema that lists them all.
    """
    asset = await session.get(MediaAsset, media_id)
    if asset is None or asset.site_id != site.id:
        raise HTTPException(status_code=404, detail="Media asset not found")

    url = asset.url
    if not url:
        return {"id": media_id, "total": 0, "usages": []}

    like = "%" + url.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    usages: list[dict[str, object]] = []

    # Sites that may be pointing at this file without owning a row for it.
    #
    # _clone_site_content copies image URLs into the new site's pages and stays
    # but does not copy the MediaAsset rows, so a villa cloned from the parent
    # references /storage/media/<key> while the parent's library is the only
    # place that file is registered. Searching this site alone therefore
    # reported "0 uses" for an image several child sites were displaying, and
    # deleting it broke all of them at once — the exact outcome this endpoint
    # exists to prevent, one level up.
    derived = await session.execute(
        select(Site.id).where(
            or_(Site.parent_site_id == site.id, Site.template_site_id == site.id),
            Site.id != site.id,
        )
    )
    # list(...) rather than .all(): the same idiom the collectors below use, and
    # the one that works on both a ScalarResult and a plain sequence.
    scope_ids = [site.id, *list(derived.scalars())]

    async def _collect(model, label: str, title_col, *match_cols) -> None:
        clause = or_(*[col.like(like, escape="\\") for col in match_cols])
        rows = (
            await session.execute(
                select(model).where(model.site_id.in_(scope_ids)).where(clause)
            )
        ).scalars()
        for row in rows:
            usages.append({
                "kind": label,
                "id": row.id,
                "title": str(getattr(row, title_col, "") or ""),
            })

    # Scalar columns, plus the JSON the block editors write. `.cast(Text)` is
    # what lets a LIKE reach inside the serialised blocks.
    await _collect(Stay, "stay", "name",
                   Stay.hero_image_url, Stay.story, Stay.detail_config.cast(Text), Stay.translations.cast(Text),
                   Stay.seo.cast(Text), Stay.location_config.cast(Text), Stay.faq.cast(Text), Stay.house_rules.cast(Text))
    await _collect(Page, "page", "title",
                   Page.cover_image_url, Page.body, Page.body_blocks.cast(Text), Page.translations.cast(Text), Page.seo.cast(Text))
    await _collect(Banner, "banner", "title",
                   Banner.image_url, Banner.translations.cast(Text))
    await _collect(Announcement, "announcement", "title", Announcement.image_url, Announcement.body, Announcement.translations.cast(Text))
    await _collect(NewsletterCampaign, "newsletter", "subject", NewsletterCampaign.body)
    configured_sites = (
        await session.execute(select(Site).where(Site.id.in_(scope_ids), Site.settings.cast(Text).like(like, escape="\\")))
    ).scalars()
    for configured_site in configured_sites:
        usages.append({"kind": "site", "id": configured_site.id, "title": configured_site.name})

    # Gallery rows hang off a stay rather than the site, so they are matched
    # through their parent.
    gallery = (
        await session.execute(
            select(StayImage, Stay.name)
            .join(Stay, Stay.id == StayImage.stay_id)
            .where(Stay.site_id.in_(scope_ids))
            .where(StayImage.image_url.like(like, escape="\\"))
        )
    ).all()
    for image, stay_name in gallery:
        usages.append({"kind": "stay_gallery", "id": image.stay_id, "title": str(stay_name or "")})

    return {"id": media_id, "total": len(usages), "usages": usages}


@router.patch("/media/{media_id}", dependencies=[Depends(require_permission("media:write"))])
async def rename_media(
    media_id: int,
    payload: MediaAssetRename,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    asset = await session.get(MediaAsset, media_id)
    if asset is None or asset.site_id != site.id:
        raise HTTPException(status_code=404, detail="Media asset not found")
    display_name = payload.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="Display name is required")
    asset.display_name = display_name
    await session.commit()
    await session.refresh(asset)
    return {
        "id": asset.id,
        "display_name": asset.display_name,
        "url": asset.url,
    }


@router.delete("/media/{media_id}", status_code=204, dependencies=[Depends(require_permission("media:write"))])
async def delete_media(
    media_id: int,
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> None:
    asset = await session.get(MediaAsset, media_id)
    if asset is None or asset.site_id != site.id:
        raise HTTPException(status_code=404, detail="Media asset not found")

    storage_keys = [
        asset.storage_key or Path(asset.url).name,
        Path(asset.poster_url).name if asset.poster_url else "",
    ]
    await session.delete(asset)
    await session.commit()

    for storage_key in storage_keys:
        if not storage_key:
            continue
        target = media_path(storage_key)
        if target is not None:
            # Same reason as the upload: filesystem calls block the event loop.
            await asyncio.to_thread(target.unlink, True)


# ---------------------------------------------------------------------------
# Removing an administrator
# ---------------------------------------------------------------------------
# 帳號管理 gets the same 刪除 / 復原 / 永久刪除 trio as every other list here, and
# the same two-step shape: deleting moves the account to 已刪除, deleting it
# again from there removes the row. What is different about an account is who
# may press the buttons and which rows must refuse them, so each rule lives in
# one named helper and all three routes run them in one order.


async def _has_global_user_scope(admin: AdminUser, session: AsyncSession) -> bool:
    """Whether *admin* sees the whole network's accounts, or only one site's.

    The same line `manage_site_users` draws for its picker, pulled out so the
    two cannot drift: the screen that lists the accounts and the routes that
    act on one have to agree about which accounts exist for this caller, or the
    admin shows a row whose buttons answer 404.
    """
    role = await _global_role(admin, session)
    perms = role.permissions if role else []
    return "*" in perms or "global_users:read" in perms


async def _super_admin_role_ids(session: AsyncSession) -> set[int]:
    """Ids of every role whose holder is a super-admin.

    By the permission, never by the name. "super_admin" and "owner" are BOTH
    超級管理者 — `roleLabels` in the frontend maps the two to the same words and
    `update_role_permissions` forces "*" onto either — so a count of
    `name == "super_admin"` would not see the owner, and "there is another one"
    would be wrong in the one direction that matters. `"*"` is what
    `_is_super_admin`, `require_permission` and `/auth/me` all actually read,
    and a bespoke role that was given "*" counts for exactly the same reason.
    """
    roles = (await session.execute(select(Role))).scalars().all()
    return {role.id for role in roles if "*" in (role.permissions or [])}


async def _is_last_super_admin(user: AdminUser, session: AsyncSession) -> bool:
    """True when removing *user* would leave nobody able to administer.

    Creating a super-admin, restoring one, and editing the roles that make one
    are all super-admin work, so zero is a state the admin cannot climb out of;
    it takes psql. Archived and already-deleted accounts are not cover — an
    archived super-admin cannot log in, and reactivating one is itself a call
    nobody would be left to make.
    """
    super_role_ids = await _super_admin_role_ids(session)
    if user.role_id not in super_role_ids:
        return False
    remaining = (
        await session.execute(
            select(func.count())
            .select_from(AdminUser)
            .where(
                AdminUser.id != user.id,
                AdminUser.role_id.in_(super_role_ids),
                AdminUser.deleted_at.is_(None),
                AdminUser.is_active.is_(True),
            )
        )
    ).scalar_one()
    return remaining == 0


async def _admin_user_for_removal(
    user_id: int,
    admin: AdminUser,
    site: Site,
    session: AsyncSession,
) -> AdminUser:
    """The account a delete / restore / purge is aimed at, or the refusal.

    The order below is the order the checks have to run in, and each step is
    load-bearing:

    1. **404 for an account this caller cannot see.** `admin_users` is one
       global table, but a site-scoped caller only ever sees the accounts
       linked to the site they are working in. 403 would confirm that an
       account with that id exists somewhere on the network, which is the one
       thing a caller with no claim to it must not learn; 404 is what the rest
       of this module answers for a row belonging to another tenant, and this
       is checked BEFORE the permission so "not yours" cannot be told apart
       from "not there".
    2. **403 unless the caller is a super-admin.** `global_users:write` is
       grantable to any custom role from the roles screen, and its holder could
       otherwise delete every account above them. Deleting an administrator is
       the one verb on this screen that is not undoable by the person it was
       used on, so it stays with the role that already holds everything.
    3. **400 for your own account.** Deleting yourself signs you out with no
       way back in — `get_current_admin` refuses the token you are holding on
       the very next request. 停用 already refuses this for the same reason.
    """
    user = await session.get(AdminUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Admin user not found")
    if not await _has_global_user_scope(admin, session):
        link = (
            await session.execute(
                select(AdminUserSite.id).where(
                    AdminUserSite.admin_user_id == user_id,
                    AdminUserSite.site_id == site.id,
                )
            )
        ).scalar_one_or_none()
        if link is None:
            raise HTTPException(status_code=404, detail="Admin user not found")
    if not await _is_super_admin(admin, session):
        raise HTTPException(status_code=403, detail="Only a super-admin can delete an account")
    identity = inspect(admin).identity
    caller_id: int = identity[0] if identity else admin.id
    if user_id == caller_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    return user


@router.get("/users", dependencies=[Depends(require_permission("global_users:read"))])
async def manage_users(
    admin: AdminUser = Depends(get_current_admin),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
    visibility: str = Query(default="active"),
) -> list[dict[str, object]]:
    # global_users:read is a global permission — callers already have
    # system-wide scope.
    visibility = _validate_visibility(visibility)
    statement = select(AdminUser).options(selectinload(AdminUser.role))
    clause = _visibility_clause(AdminUser, visibility)
    if clause is not None:
        statement = statement.where(clause)
    users = (await session.execute(statement.order_by(AdminUser.id))).scalars().all()
    # The bootstrap fallback, kept to the live view. An empty 已刪除 is an
    # ordinary answer, and handing back the caller's own row for it would put
    # an account that is not deleted into the bin's list, with 復原 and
    # 永久刪除 beside it.
    if not users and visibility == "active":
        users = [admin]
    site_links = (
        await session.execute(
            select(AdminUserSite)
            .options(selectinload(AdminUserSite.role))
            .where(AdminUserSite.site_id == site.id)
        )
    ).scalars().all()
    site_role_by_user = {link.admin_user_id: link.role for link in site_links}
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.name if getattr(user, "role", None) else "admin",
            # The account list edits the role on the current site. Returning it
            # beside the global role makes the saved admin/editor choice visible
            # after redirect; previously the PATCH updated AdminUserSite while
            # this GET kept painting AdminUser.role, so the UI looked inert.
            "site_role": site_role_by_user[user.id].name if user.id in site_role_by_user else "",
            # Show what this account can actually do in the selected site. A
            # site-scoped account has the empty `site_member` role globally,
            # so returning only AdminUser.role.permissions made admin/editor
            # both look like they had no permissions even after a successful
            # role change.
            "permissions": list(dict.fromkeys(
                (user.role.permissions if getattr(user, "role", None) else [])
                + (site_role_by_user[user.id].permissions if user.id in site_role_by_user else [])
            )),
            "status": "active" if user.is_active else "archived",
            "deleted_at": user.deleted_at,
            "created_at": user.created_at,
        }
        for user in users
    ]


@router.get("/roles", dependencies=[Depends(require_permission("roles:read"))])
async def manage_roles(session: AsyncSession = Depends(get_session)) -> list[dict[str, object]]:
    for role_name in ["super_admin", "admin", "editor"]:
        await _ensure_role(session, role_name)
    await session.commit()
    roles = (await session.execute(select(Role).order_by(Role.name))).scalars().all()
    return [{"id": role.id, "name": role.name, "permissions": role.permissions} for role in roles]


@router.get("/permissions", dependencies=[Depends(require_permission("roles:read"))])
async def manage_permissions() -> list[str]:
    return _allowed_permissions()


@router.patch("/roles/{role_id}/permissions", dependencies=[Depends(require_permission("roles:write"))])
async def update_role_permissions(
    role_id: int,
    payload: RolePermissionsUpdate,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    role = await session.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    # "*" is offered by the picker so an existing super-admin role reads
    # correctly, but it must not be assignable here: `roles:write` is a
    # site-admin grade permission, and writing "*" onto any role would let its
    # holder promote themselves past every other check in this module.
    allowed = set(_allowed_permissions()) - {"*"}
    requested = [permission for permission in dict.fromkeys(payload.permissions) if permission != "*"]
    # Anything else the server does not recognise is a mistake, not a policy,
    # and it used to be dropped in the same silent filter as "*" — so a single
    # mistyped name came back 200 with the role quietly narrowed to whatever
    # survived. The picker only ever offers names this same list produced, so
    # nothing legitimate reaches here and refusing costs no working caller.
    unknown = [permission for permission in requested if permission not in allowed]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown permission(s): {', '.join(sorted(unknown))}",
        )
    permissions = requested
    if role.name in ("super_admin", "owner") and "*" not in permissions:
        raise HTTPException(status_code=422, detail="Super-admin role must keep full access")

    # A site role must not carry a global permission.
    #
    # "admin" and "editor" are handed to every site-scoped user, and until this
    # existed a single tick on this screen widened all of them at once — the
    # picker offers sites:write next to cms:write with nothing to say the two
    # have different blast radii. Granting someone network powers is still
    # possible; it takes a purpose-made role rather than an edit to the role
    # every villa manager already holds.
    if role.name in SITE_ROLE_NAMES:
        global_asked = sorted(p for p in permissions if p in _GLOBAL_PERMISSIONS)
        if global_asked:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"'{role.name}' is a site role and cannot hold network-wide "
                    f"permission(s): {', '.join(global_asked)}. Create a separate role "
                    "for that instead."
                ),
            )

    # Nobody edits the role they hold themselves.
    #
    # roles:write is a site-admin grade permission, and this endpoint could not
    # see its caller at all — so its holder could add global_users:write to
    # their own role and go on to deactivate every super-admin. Super-admins are
    # exempt: they already hold "*", so there is nothing here to escalate to.
    if not await _is_super_admin(admin, session):
        # identity is None for an instance not attached to a session; `.id` is
        # the plain attribute and is always loaded on the one get_current_admin
        # hands over.
        identity = inspect(admin).identity
        admin_id: int = identity[0] if identity else admin.id
        own_site_roles = (
            await session.execute(
                select(AdminUserSite.role_id).where(AdminUserSite.admin_user_id == admin_id)
            )
        ).scalars().all()
        if role.id == admin.role_id or role.id in set(own_site_roles):
            raise HTTPException(
                status_code=403,
                detail="You cannot edit the permissions of a role you hold yourself",
            )
    role.permissions = permissions
    await session.commit()
    return {"id": role.id, "name": role.name, "permissions": role.permissions}


@router.post("/users", status_code=201, dependencies=[Depends(require_permission("global_users:write"))])
async def create_admin_user(
    payload: AdminUserCreate,
    admin: AdminUser = Depends(get_current_admin),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    _GLOBAL_ROLES = {"super_admin", "owner"}
    # An allow-list, not a denylist. Blocking only {"super_admin", "owner"}
    # reads as "block the dangerous ones", but that is not what it did:
    # `_ensure_role` resolves a role **by name** and hands back the existing
    # row, so any custom role an operator had ever created — including one
    # given `roles:write` or `global_users:write` through the roles screen —
    # could be requested here by name. The holder of `global_users:write` then
    # had a brand-new account carrying that role, with a password they chose,
    # to log straight back in as. The two sibling endpoints
    # (`update_site_user_role`, `update_admin_user_role`) were already
    # allow-listed; this one was the hole between them.
    _ASSIGNABLE_ROLES = {"admin", "editor"}
    if payload.role not in _ASSIGNABLE_ROLES and not await _is_super_admin(admin, session):
        if payload.role in _GLOBAL_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only super-admins can assign global roles",
            )
        raise HTTPException(
            status_code=422,
            detail=f"Only site roles are allowed: {', '.join(sorted(_ASSIGNABLE_ROLES))}",
        )

    existing = (
        await session.execute(select(AdminUser).where(AdminUser.email == payload.email.strip().lower()))
    ).scalar_one_or_none()
    if existing is not None:
        # The address is unique across the whole table, deleted rows included,
        # so a soft-deleted account still holds its own email. Saying so turns
        # a dead end into an instruction: the account is in 已刪除, restore it
        # or remove it for good, then this address is free again.
        if existing.deleted_at is not None:
            raise HTTPException(
                status_code=409,
                detail="An account with this email is in the deleted list — restore it, or delete it permanently first",
            )
        raise HTTPException(status_code=409, detail="Admin email already exists")

    requested_role = await _ensure_role(session, payload.role)
    if payload.role in _GLOBAL_ROLES:
        # A global role belongs in the global slot; the site link gets "admin"
        # so global permissions do not leak into the site context.
        global_role = requested_role
        site_role = await _ensure_role(session, "admin")
    else:
        # A site-level role belongs ONLY in the site slot. The global slot gets
        # the empty site_member row — see SITE_MEMBER_ROLE. Putting the
        # requested row in both (which is what this did) meant a later edit to
        # the "admin" role changed every site admin's GLOBAL permissions.
        global_role = await _ensure_role(session, SITE_MEMBER_ROLE)
        site_role = requested_role

    # Resolve target site: explicit slug (if provided) wins over cookie site,
    # but the caller must already have a role on that site — otherwise a child
    # admin could escalate by passing the parent slug.
    target_site = site
    if payload.site_slug:
        requested = (
            await session.execute(select(Site).where(Site.slug == payload.site_slug.strip().lower()))
        ).scalar_one_or_none()
        # Collapse "not found" and "no access" into one 403 so callers can't
        # enumerate site slugs they don't already have access to.
        if requested is None or await _site_role(admin, requested, session) is None:
            raise HTTPException(status_code=403, detail="No access to target site")
        target_site = requested

    user = AdminUser(
        email=payload.email.strip().lower(),
        name=payload.name.strip(),
        password_hash=await hash_password_async(payload.password),
        role_id=global_role.id,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    session.add(AdminUserSite(admin_user_id=user.id, site_id=target_site.id, role_id=site_role.id))
    await session.commit()
    await session.refresh(user)
    return {"id": user.id, "email": user.email, "status": "active"}


@router.patch("/users/{user_id}/status", dependencies=[Depends(require_permission("global_users:write"))])
async def update_admin_user_status(
    user_id: int,
    payload: AdminUserStatusUpdate,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    user = await session.get(AdminUser, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Admin user not found")
    # A row in 已刪除 is not a row you file. The same rule the six content lists
    # follow (see test_status_verbs_reject_deleted_rows): 400, not 404, because
    # the account exists and can be named — which is how 復原 still reaches it.
    # 停用 / 啟用 on it would move a badge on an account nobody can sign in to.
    if user.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot change the status of a deleted account")
    identity = inspect(admin).identity
    caller_id: int = identity[0] if identity else admin.id
    if user_id == caller_id and payload.status == "archived":
        raise HTTPException(status_code=422, detail="You cannot deactivate your own account")
    # Only a super-admin may deactivate a super-admin.
    #
    # "You cannot deactivate your own account" was the only guard here, so a
    # holder of global_users:write could archive every super-admin on the
    # network — and auth rejects an inactive user's existing token immediately
    # (auth/routes.py: `not user.is_active`), so that is a full lockout of the
    # people who could undo it. Chained with roles:write it was the last step of
    # a complete takeover; on its own it is still a denial of service against
    # the owner.
    if payload.status == "archived" and not await _is_super_admin(admin, session):
        target_role = await session.get(Role, user.role_id) if user.role_id is not None else None
        if target_role is not None and "*" in (target_role.permissions or []):
            raise HTTPException(
                status_code=403,
                detail="Only a super-admin can deactivate a super-admin",
            )
    user.is_active = payload.status == "active"
    await session.commit()
    return {"id": user.id, "status": "active" if user.is_active else "archived"}


@router.patch("/users/{user_id}/role", dependencies=[Depends(require_permission("site_users:write"))])
async def update_admin_user_role(
    user_id: int,
    payload: AdminUserRoleUpdate,
    admin: AdminUser = Depends(get_current_admin),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Update a user's **site-level** role for the current site.

    Site admin and editor create/update the current site's link. Selecting
    site_member removes that link and leaves the account as a network member
    with no permissions on this site. Global roles (super_admin) cannot be
    assigned via this endpoint.
    """
    _SITE_ROLES = {"admin", "editor", SITE_MEMBER_ROLE}
    if payload.role not in _SITE_ROLES:
        raise HTTPException(
            status_code=422,
            detail=f"Only site roles are allowed: {', '.join(sorted(_SITE_ROLES))}",
        )
    user = await session.get(AdminUser, user_id)
    if user is None:
        # This 404 does tell a `site_users:write` holder which admin user ids
        # exist, which the sibling site-slug lookup in `create_admin_user`
        # deliberately collapses into one status. Kept as-is after weighing it:
        # the response carries no name, email or role, self-edit is refused
        # below so nothing here escalates, and collapsing the two cases means
        # requiring a pre-existing AdminUserSite link — which would remove the
        # only way /admin/users can give a listed user a role on the current
        # site, since that screen lists every user and the link is created on
        # demand a few lines down. An id oracle is the cheaper of the two.
        raise HTTPException(status_code=404, detail="Admin user not found")
    if user.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot change the role of a deleted account")
    if user_id == inspect(admin).identity[0]:
        raise HTTPException(status_code=422, detail="You cannot change your own role")
    # Only update the site-level link — never touch user.role_id (global role)
    link = (
        await session.execute(
            select(AdminUserSite).where(
                AdminUserSite.admin_user_id == user_id,
                AdminUserSite.site_id == site.id,
            )
        )
    ).scalar_one_or_none()
    if payload.role == SITE_MEMBER_ROLE:
        if link:
            await session.delete(link)
        await session.commit()
        return {"id": user.id, "site_role": SITE_MEMBER_ROLE, "message": "Site role updated to site_member"}
    role = await _ensure_role(session, payload.role)
    if link:
        link.role_id = role.id
    else:
        session.add(AdminUserSite(admin_user_id=user.id, site_id=site.id, role_id=role.id))
    await session.commit()
    return {"id": user.id, "site_role": role.name, "message": f"Site role updated to {role.name}"}


@router.post("/users/{user_id}/delete", dependencies=[Depends(require_permission("global_users:write"))])
async def delete_admin_user(
    user_id: int,
    admin: AdminUser = Depends(get_current_admin),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Move an account to 已刪除. Super-admins only — see _admin_user_for_removal."""
    user = await _admin_user_for_removal(user_id, admin, site, session)
    if user.deleted_at is not None:
        raise HTTPException(status_code=400, detail="This account is already in the deleted list")
    # The network keeps at least one person who can administer it.
    #
    # Every route that could put a super-admin back — creating one, restoring
    # one, editing a role to carry "*" — is itself super-admin work, so the
    # count reaching zero is not a state this admin can undo. 停用 refuses the
    # same thing one door along; this is the other door.
    if await _is_last_super_admin(user, session):
        raise HTTPException(
            status_code=400,
            detail="This is the last super-admin. Give another account the super-admin role first.",
        )
    _soft_delete(user)
    # Ends the sessions this account has open right now. The epoch is not what
    # stops them today — `get_current_admin` refuses a deleted user outright —
    # it is what stops 復原 from handing those same tokens back. A restored
    # account starts from a fresh login, which is the only reading of "restore
    # the account" that does not also restore whoever was holding its token.
    user.token_epoch = (user.token_epoch or 0) + 1
    await session.commit()
    return {"id": user.id, "deleted_at": user.deleted_at}


@router.post("/users/{user_id}/restore", dependencies=[Depends(require_permission("global_users:write"))])
async def restore_admin_user(
    user_id: int,
    admin: AdminUser = Depends(get_current_admin),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    user = await _admin_user_for_removal(user_id, admin, site, session)
    _restore_soft_deleted(user)
    await session.commit()
    return {"id": user.id, "deleted_at": None}


@router.post("/users/{user_id}/purge", dependencies=[Depends(require_permission("global_users:write"))])
async def purge_admin_user(
    user_id: int,
    admin: AdminUser = Depends(get_current_admin),
    site: Site = Depends(get_admin_site),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Delete for good. Only from the bin — see _require_in_bin."""
    user = await _admin_user_for_removal(user_id, admin, site, session)
    _require_in_bin(user, "Admin user")
    # Three tables point at this row and none of them cascades.
    #
    # LoginAudit is the sign-in history and its FK is nullable: the attempts
    # stay, carrying the email they were made with, and only the link goes —
    # removing an account must not erase the record of how it was used.
    # PasswordResetToken and AdminUserSite have NOT NULL FKs and mean nothing
    # without the account, so they go with it; leaving either behind is a
    # foreign-key violation on the DELETE below rather than a tidy-up.
    await session.execute(
        update(LoginAudit).where(LoginAudit.admin_user_id == user_id).values(admin_user_id=None)
    )
    await session.execute(sql_delete(PasswordResetToken).where(PasswordResetToken.admin_user_id == user_id))
    await session.execute(sql_delete(AdminUserSite).where(AdminUserSite.admin_user_id == user_id))
    await session.delete(user)
    await session.commit()
    return {"id": user_id, "purged": True}


@router.get("/login-audits", dependencies=[Depends(require_permission("global_users:read"))])
async def manage_login_audits(session: AsyncSession = Depends(get_session)) -> list[dict[str, object]]:
    audits = (await session.execute(select(LoginAudit).order_by(LoginAudit.id.desc()).limit(100))).scalars().all()
    return [
        {
            "id": audit.id,
            "admin_user_id": audit.admin_user_id,
            "email": audit.email,
            "ip_address": audit.ip_address,
            "success": audit.success,
            "created_at": audit.created_at,
        }
        for audit in audits
    ]
