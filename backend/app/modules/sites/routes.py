from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.modules.sites.context import resolve_site
from app.modules.sites.models import Site
from app.modules.admin.content_categories import category_registry

router = APIRouter()

# socialLinks.ts reads each platform at three spellings: nested under
# social_links, bare, and social_-prefixed.
_SOCIAL_PLATFORMS = (
    "instagram",
    "facebook",
    "line",
    "threads",
    "tiktok",
    "twitter",
    "youtube",
    "linkedin",
)

# Site.settings is free-form JSON that admins write wholesale, so a denylist made
# every key public by default and the failure direction was "expose": the
# readiness flow writes qa_status, qa_note and qa_decision into the same blob and
# they were served to anyone who asked. Only what the public front end reads is
# listed here; a key that is not listed is simply not published.
_PUBLIC_SETTING_KEYS = {
    # Page and navigation structure.
    "pages",
    "homepage",
    "nav",
    "booking",
    "parent_link",
    # Tracking tags and compliance notices rendered into the document.
    "ga_id",
    "ads_code",
    "head_code",
    "body_code",
    "cookie_notice",
    "gdpr_notice",
    "footer_notice",
    "footer_description",
    "footer_title",
    "footer_copyright",
    # Header and branding.
    "logo_url",
    "header_logo_only",
    "header_auto_hide",
    "name_translations",
    # Contact details the site already prints on its contact page.
    "contact_phone",
    "show_footer_phone",
    "contact_address",
    "contact_email",
    "contact_line",
    "contact_inquiry_types",
    # Search bar filter options.
    "search_facilities",
    "search_experiences",
    "search_types",
    "search_guest_ranges",
    "search_guest_ranges_unit",
    # Typography and spacing.
    "font_config",
    "font_preset",
    "type_scale",
    "layout",
    # SEO and label overrides.
    "seo_og_image",
    "amenity_short",
    "social_links",
    *_SOCIAL_PLATFORMS,
    *(f"social_{platform}" for platform in _SOCIAL_PLATFORMS),
}

# CategoryPage.tsx composes this key per CMS content type (hero_journal,
# hero_media, ...), so the set is open by design and cannot be enumerated here.
_PUBLIC_SETTING_PREFIXES = ("hero_",)


def public_site_settings(raw_settings: object, root: bool = True) -> dict[str, object]:
    """The publishable subset of a site's settings blob.

    The blob is hand-editable and validated only at its top level, so it is not
    guaranteed to be a dict at all.
    """
    if not isinstance(raw_settings, dict):
        return {}
    result = {
        key: value
        for key, value in raw_settings.items()
        if key in _PUBLIC_SETTING_KEYS or key.startswith(_PUBLIC_SETTING_PREFIXES)
    }
    # Publish only the category fields consumed by public labels and source pickers.
    registry = category_registry(raw_settings, root)
    if registry:
        result["article_categories"] = {
            key: {field: cfg[field] for field in ("label", "status", "sort_order") if field in cfg}
            for key, cfg in registry.items() if isinstance(cfg, dict)
        }
    return result


@router.get("/resolve")
async def resolve_current_site(
    request: Request,
    host: str | None = Query(default=None),
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    current = await resolve_site(session, host or request.headers.get("host"), site)
    public_settings = public_site_settings(current.settings, current.parent_site_id is None)
    return {
        "id": current.id,
        "parent_site_id": current.parent_site_id,
        "template_site_id": current.template_site_id,
        "name": current.name,
        "slug": current.slug,
        "domain": current.domain,
        "status": current.status,
        "is_template": current.is_template,
        "template_version": current.template_version,
        "default_locale": current.default_locale,
        "theme_config": current.theme_config,
        "contact_config": current.contact_config,
        "seo_defaults": current.seo_defaults,
        "settings": public_settings,
    }


@router.get("/children")
async def list_child_sites(
    request: Request,
    host: str | None = Query(default=None),
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, object]]:
    """Active child (property) sites of the current site.

    Used by the public front-end to link a parent stay whose slug matches a
    child site over to that child's official site (/property/{slug}).
    """
    current = await resolve_site(session, host or request.headers.get("host"), site)
    # A child site links to its parent; the parent itself is the umbrella site.
    parent_id = current.id if current.parent_site_id is None else current.parent_site_id
    rows = (
        await session.execute(
            select(Site).where(
                Site.parent_site_id == parent_id,
                Site.status == "active",
                Site.is_template.is_(False),
            )
        )
    ).scalars().all()
    return [
        {
            "id": s.id,
            "parent_site_id": s.parent_site_id,
            "name": s.name,
            "slug": s.slug,
            "domain": s.domain,
            "status": s.status,
            "default_locale": s.default_locale,
            "theme_config": s.theme_config,
            "seo_defaults": s.seo_defaults,
            "settings": public_site_settings(s.settings, s.parent_site_id is None),
        }
        for s in rows
    ]
