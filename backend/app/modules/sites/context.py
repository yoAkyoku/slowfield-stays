import logging

from fastapi import Header, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.sites.models import Site

logger = logging.getLogger(__name__)
DEFAULT_SITE_SLUG = "slowfield"


def normalize_host(host: str | None) -> str:
    if not host:
        return ""
    return host.split(",")[0].split(":")[0].strip().lower()


def canonical_domain(host: str | None) -> str:
    normalized = normalize_host(host)
    if normalized.startswith("www."):
        return normalized[4:]
    return normalized


def _degraded_default_site() -> Site:
    """A stand-in site for a request that could not reach the database.

    Deliberate: a transient DB fault should not take the marketing pages down,
    and every caller here only needs somewhere to hang a site id and a name.

    Detached on purpose, never session.add()ed. resolve_site is also on the
    write paths (inquiry, newsletter signup, booking, media upload), so a
    transient object with a hardcoded id=1 attached to the session would be
    flushed with whatever that request went on to commit: either a phantom site
    row or an IntegrityError raised a long way from its cause.
    """
    return Site(id=1, name="Slowfield Stays", slug=DEFAULT_SITE_SLUG, domain="localhost")


async def ensure_default_site(session: AsyncSession) -> Site:
    """Fetch, or create, the default site. Raises if the database is unreachable.

    No degraded fallback here on purpose. This is the create-the-row path, so a
    failure is a misconfiguration (wrong DATABASE_URL, migrations not run)
    rather than the blip resolve_site is willing to ride out, and answering it
    with a phantom site would let a deploy pointed at the wrong database look
    healthy. Startup already refuses to come up in that state: the lifespan
    seeds the bootstrap admin with an unguarded query.

    On the create branch being a write reached from read paths (`resolve_site`
    falls here for any request whose host matches no site, and `manage_sites`
    calls it too). Audited and left alone, because in a migrated database the
    branch is dead: 202605150002_multisite inserts the slowfield row
    unconditionally, `delete_site` refuses to delete the root site, and the
    lookup above is deliberately not filtered on status — so archiving the
    default site still finds it rather than growing a second one. Reaching the
    create means an empty sites table, i.e. a fresh local checkout, which is
    the case this exists to serve. It also flushes rather than commits, and
    `get_session` never commits on the caller's behalf, so a read that ends
    here leaves nothing behind when the session closes; the row only survives
    where the handler goes on to commit for its own reasons.
    """
    result = await session.execute(select(Site).where(Site.slug == DEFAULT_SITE_SLUG))
    site = result.scalar_one_or_none()
    if site:
        return site
    site = Site(
        name="Slowfield Stays",
        slug=DEFAULT_SITE_SLUG,
        domain="localhost",
        status="active",
        default_locale="zh",
        theme_config={"primaryColor": "#2f4638", "accentColor": "#b78b58"},
        contact_config={"email": "hello@example.com", "line": "@slowfield"},
        seo_defaults={"title": "Slowfield Stays", "description": "Curated private stays."},
    )
    session.add(site)
    await session.flush()
    return site


async def resolve_site(
    session: AsyncSession,
    host: str | None = None,
    site_slug: str | None = None,
    include_unpublished: bool = False,
) -> Site:
    """Resolve the site a request is for.

    ``include_unpublished`` is the difference between the admin and the public.
    A site's status is ``active``, ``draft`` or ``archived``, and this used to
    exclude only ``archived`` — so a ``draft`` site, which SiteCreate documents
    as "not live yet", was served to the public from the moment it was created.
    Its name, theme and public settings were readable, along with anything the
    tenant published while still building.

    The admin has to keep seeing them, or a site could never be built before it
    goes live: ``get_admin_site`` passes ``include_unpublished=True`` and still
    requires an AdminUserSite link, so seeing a draft site remains something
    only its own operators can do.
    """
    live_only = Site.status == "active"
    status_filter = Site.status != "archived" if include_unpublished else live_only
    if site_slug:
        try:
            result = await session.execute(select(Site).where(Site.slug == site_slug, status_filter))
            site = result.scalar_one_or_none()
            if site:
                return site
            # The caller named a site and no such site exists. Falling through to
            # the host lookup and then to the default meant a typo, or a bookmark
            # pointing at a renamed site, quietly served — and on the admin paths,
            # edited — a different tenant while looking entirely successful. The
            # database answered; there is nothing degraded about this case.
            raise HTTPException(status_code=404, detail=f"Unknown site '{site_slug}'")
        except HTTPException:
            raise
        except Exception:
            # error, not warning: the request that follows is served against the
            # wrong site, so this line is the only place the fault is visible.
            logger.error("Site resolution failed for slug %r, serving degraded default", site_slug, exc_info=True)
            await session.rollback()
            return _degraded_default_site()
    normalized_host = normalize_host(host)
    if normalized_host:
        try:
            result = await session.execute(
                select(Site).where(
                    or_(Site.domain == normalized_host, Site.slug == normalized_host),
                    status_filter,
                )
            )
            site = result.scalar_one_or_none()
            if site:
                return site
            canonical_host = canonical_domain(normalized_host)
            if canonical_host:
                result = await session.execute(select(Site).where(status_filter))
                for candidate in result.scalars().all():
                    if canonical_domain(candidate.domain) == canonical_host:
                        return candidate
        except Exception:
            logger.error("Site resolution failed for host %r, serving degraded default", normalized_host, exc_info=True)
            await session.rollback()
            return _degraded_default_site()
    return await ensure_default_site(session)


async def current_public_site(
    request: Request,
    session: AsyncSession,
    site: str | None = Query(default=None),
    x_site_slug: str | None = Header(default=None),
) -> Site:
    return await resolve_site(session, request.headers.get("host"), site or x_site_slug)


def require_site(site: Site | None) -> Site:
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return site
