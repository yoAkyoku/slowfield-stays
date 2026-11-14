import logging
from collections.abc import Iterable
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limits import MAX_ID_FILTER, cap_rows
from app.db.session import get_session
from app.modules.cms.models import Announcement, Banner, Page
from app.modules.cms.schemas import AnnouncementRead, BannerRead, PageRead
from app.modules.cms.seed import PUBLIC_BANNERS, PUBLIC_PAGES
from app.modules.stays.models import Stay
from app.modules.sites.context import resolve_site

logger = logging.getLogger(__name__)
router = APIRouter()

# What the seeded fallback exists for: a database that will not answer. Narrower
# than `except Exception`, which also swallowed serialisation and programming
# bugs and turned them into a 200 serving the two demo pages. asyncpg raises the
# socket error unwrapped when the connection is refused at pool checkout, so it
# never becomes a SQLAlchemyError and OSError has to be named alongside it.
DB_UNAVAILABLE = (SQLAlchemyError, OSError)

CONTENT_TYPE_TO_CATEGORY = {
    "brand": "brand",
    "dining": "dining",
    "activity": "activities",
    "journal": "journal",
    "media": "media-coverage",
    "pr": "pr",
    "career": "careers",
    "franchise": "franchise",
    "page": "page",
    "experience": "experience",
    "privacy": "privacy",
    "news": "news",
    "service": "services",
    # 慢域選品 — see the note on the frontend mirror in contentRoutes.ts.
    "curation": "curation",
}

# The inverse, derived rather than written out again. This table and its mirror
# in the frontend's contentRoutes.ts were four hand-kept copies that all had to
# agree; two of them now follow from the other two.
CONTENT_CATEGORY_ALIASES = {
    category: content_type for content_type, category in CONTENT_TYPE_TO_CATEGORY.items()
}


def content_category_for_page(page: Page | PageRead) -> str:
    return CONTENT_TYPE_TO_CATEGORY.get(page.content_type or "page", "page")


def page_has_content_type(page: Page | PageRead, content_type: str | None) -> bool:
    if not content_type:
        return True
    categories = getattr(page, "categories", None) or [page.content_type]
    return content_type == page.content_type or content_type in categories


def content_public_path(page: Page | PageRead) -> str:
    category = content_category_for_page(page)
    identifier = page.slug or str(page.id)
    return f"/{category}/{identifier}"


def page_to_read(page: Page | PageRead) -> PageRead:
    if isinstance(page, PageRead):
        return page.model_copy(
            update={
                "route_category": content_category_for_page(page),
                "public_path": content_public_path(page),
            }
        )
    return PageRead(
        id=page.id,
        slug=page.slug,
        title=page.title,
        summary=page.summary,
        body=page.body,
        body_blocks=page.body_blocks or [],
        content_type=page.content_type,
        categories=getattr(page, "categories", None) or [page.content_type],
        layout=getattr(page, "layout", "page") or "page",
        cover_image_url=page.cover_image_url,
        sort_order=page.sort_order,
        tags=page.tags or [],
        related_stay_ids=page.related_stay_ids or [],
        status=page.status,
        seo=page.seo or {},
        translations=page.translations or {},
        published_at=page.published_at,
        route_category=content_category_for_page(page),
        public_path=content_public_path(page),
    )


def _read_rows(pages: Iterable[Page | PageRead]) -> list[PageRead]:
    """Serialise a listing row by row, dropping only the rows that will not read.

    The write and read schemas disagree — PageAdminUpsert.seo is a loose dict
    while PageRead.seo is a strict SeoMeta — so a saved `{"title": 123}` stores
    fine and then cannot be read back. Serialising the whole list inside the
    query's try meant one such row aborted the listing and the site answered 200
    with the two seeded demo pages as its entire content. One missing article is
    the smaller outage.
    """
    rows: list[PageRead] = []
    for page in pages:
        try:
            rows.append(page_to_read(page))
        except Exception:
            logger.error("CMS page %s could not be serialised; omitted", getattr(page, "id", "?"), exc_info=True)
    return rows


@router.get("/banners", response_model=list[BannerRead])
async def list_banners(
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[BannerRead]:
    now = datetime.now(UTC)
    current_site = await resolve_site(session, request.headers.get("host"), site)
    banners = []
    db_down = False
    try:
        banners = (
            (
                await session.execute(
                    select(Banner)
                    .where(
                        Banner.status == "published",
                        Banner.site_id == current_site.id,
                        Banner.deleted_at.is_(None),
                        Banner.image_url != "",
                        or_(Banner.starts_at.is_(None), Banner.starts_at <= now),
                        or_(Banner.ends_at.is_(None), Banner.ends_at >= now),
                    )
                    .order_by(Banner.sort_order, Banner.id)
                )
            )
            .scalars()
            .all()
        )
    except DB_UNAVAILABLE:
        logger.error("CMS banner query failed; serving the seeded demo banners", exc_info=True)
        db_down = True
    # Validation stays outside the try: a row this endpoint cannot read is a bug
    # to surface, not a reason to answer 200 with the seeded demo banners.
    if banners:
        return [BannerRead.model_validate(banner) for banner in banners]
    # The demo banners stand in only for a database that cannot answer. A site
    # that simply has no banners gets none: serving the seed there put stock
    # slides on a real brand's homepage the moment its last banner was retired.
    return PUBLIC_BANNERS if db_down else []


@router.get("/pages/{slug}", response_model=PageRead)
async def get_page(
    slug: str,
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> PageRead:
    current_site = await resolve_site(session, request.headers.get("host"), site)
    page = None
    try:
        page = (
            await session.execute(
                select(Page).where(
                    Page.site_id == current_site.id,
                    Page.slug == slug,
                    Page.status == "published",
                    Page.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
    except DB_UNAVAILABLE:
        logger.error("CMS page lookup failed for %r; serving the seeded page", slug, exc_info=True)

    # Serialisation stays outside the try so a row the read schema rejects raises
    # a 500 instead of silently serving a seeded demo page under the real slug.
    if page is not None:
        return page_to_read(page)

    fallback_page = PUBLIC_PAGES.get(slug)
    if fallback_page is None:
        raise HTTPException(status_code=404, detail="Page not found")
    return page_to_read(fallback_page)


def _parse_ids(raw: str | None) -> list[int] | None:
    """None when the caller did not filter; a (possibly empty) list when it did.

    The empty list matters: "these ids" with nothing parseable has to mean no
    rows, not every row.
    """
    if raw is None:
        return None
    out: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
        if len(out) >= MAX_ID_FILTER:
            # This exists to fetch a stay's handful of related articles. Past a
            # couple of hundred the caller is not doing that, and an unbounded
            # IN clause is theirs to choose rather than ours to build.
            break
    return out


async def _shared_parent_pages(
    session: AsyncSession,
    current_site,
    content_type: str | None,
    stay_slug: str | None,
    wanted_ids: list[int] | None = None,
) -> list[Page]:
    """Parent-site posts that name this villa in related_stay_ids.

    related_stay_ids is a JSON column and the containment operators differ
    between backends, so the match is done in Python. A CMS listing is small
    enough that this costs nothing, and it behaves the same on SQLite and
    Postgres.
    """
    if not stay_slug or not getattr(current_site, "parent_site_id", None):
        return []
    stay_id = (
        await session.execute(
            select(Stay.id).where(
                Stay.site_id == current_site.parent_site_id,
                Stay.slug == stay_slug,
                Stay.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if stay_id is None:
        return []
    query = select(Page).where(
        Page.site_id == current_site.parent_site_id,
        Page.status == "published",
        Page.deleted_at.is_(None),
    )
    if wanted_ids is not None:
        # The ids= filter has to reach the shared rows too. It was applied only
        # to the villa's own query, so asking for a stay's two related articles
        # still came back with every parent post naming that villa appended.
        query = query.where(Page.id.in_(wanted_ids))
    candidates = (await session.execute(query)).scalars().all()
    return [
        page for page in candidates
        if page_has_content_type(page, content_type) and stay_id in (page.related_stay_ids or [])
    ]


@router.get("/pages", response_model=list[PageRead])
async def list_pages(
    request: Request,
    content_type: str | None = Query(default=None),
    site: str | None = Query(default=None),
    # Slug of the stay this listing belongs to. On a child (villa) site it pulls
    # in the parent's brand-wide posts that name this villa in related_stay_ids,
    # so 慢域 can publish one 品牌活動 and tick which villas it appears on,
    # instead of re-posting it under every villa.
    stay: str | None = Query(default=None),
    # Comma-separated page ids, for pulling a stay's related_content_ids in one
    # call. The frontend was already sending this and the endpoint was ignoring
    # it, so a request for two related articles came back with every article.
    ids: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[PageRead]:
    current_site = await resolve_site(session, request.headers.get("host"), site)
    pages: list[Page] = []
    try:
        query = select(Page).where(Page.site_id == current_site.id, Page.status == "published", Page.deleted_at.is_(None))
        wanted_ids = _parse_ids(ids)
        if wanted_ids is not None:
            if not wanted_ids:
                return []
            query = query.where(Page.id.in_(wanted_ids))
        pages = list((await session.execute(query.order_by(Page.sort_order, Page.id.desc()))).scalars().all())
        if content_type:
            pages = [page for page in pages if page_has_content_type(page, content_type)]
        pages.extend(await _shared_parent_pages(session, current_site, content_type, stay, wanted_ids))
    except DB_UNAVAILABLE:
        # Replacing a site's whole listing with the seeded demo pages is a content
        # outage, not a notice, and it hides behind a 200 either way.
        logger.error("CMS page query failed; serving the seeded demo pages", exc_info=True)
        pages = []

    if pages:
        # Re-sort after the merge so shared posts sit in the same running
        # order as the villa's own, rather than tacked on the end.
        pages.sort(key=lambda item: (item.sort_order, -item.id))
        return _read_rows(cap_rows(pages, "GET /cms/pages"))

    fallback_pages = _read_rows(page for page in PUBLIC_PAGES.values() if page_has_content_type(page, content_type))
    return sorted(fallback_pages, key=lambda item: (item.sort_order, -item.id))


@router.get("/pages/resolve/{category}/{identifier}", response_model=PageRead)
async def resolve_page(
    category: str,
    identifier: str,
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> PageRead:
    current_site = await resolve_site(session, request.headers.get("host"), site)
    content_type = CONTENT_CATEGORY_ALIASES.get(category)
    if content_type is None:
        raise HTTPException(status_code=404, detail="Page not found")

    page = None
    try:
        query = select(Page).where(
            Page.site_id == current_site.id,
            (or_(Page.content_type == "page", Page.content_type.not_in(list(CONTENT_TYPE_TO_CATEGORY))) if category == "page" else Page.content_type == content_type),
            Page.status == "published",
            Page.deleted_at.is_(None),
        )
        if identifier.isdigit():
            query = query.where(Page.id == int(identifier))
        else:
            query = query.where(Page.slug == identifier)
        page = (await session.execute(query)).scalar_one_or_none()
    except DB_UNAVAILABLE:
        logger.error(
            "CMS page resolve failed for %s/%s; serving the seeded page", category, identifier, exc_info=True
        )

    # Serialisation stays outside the try so a row the read schema rejects raises
    # a 500 instead of quietly resolving to a seeded demo page or a 404.
    if page is not None:
        return page_to_read(page)

    fallback_page = PUBLIC_PAGES.get(category)
    if fallback_page is not None:
        fallback_identifier = fallback_page.slug or str(fallback_page.id)
        if category == content_category_for_page(fallback_page) and identifier in {fallback_identifier, str(fallback_page.id)}:
            return page_to_read(fallback_page)

    raise HTTPException(status_code=404, detail="Page not found")


@router.get("/announcements", response_model=list[AnnouncementRead])
async def list_announcements(
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[AnnouncementRead]:
    now = datetime.now(UTC)
    current_site = await resolve_site(session, request.headers.get("host"), site)
    announcements = (
        await session.execute(
            select(Announcement)
            .where(
                Announcement.site_id == current_site.id,
                Announcement.status == "published",
                or_(Announcement.starts_at.is_(None), Announcement.starts_at <= now),
                or_(Announcement.ends_at.is_(None), Announcement.ends_at >= now),
            )
            .order_by(Announcement.id.desc())
        )
    ).scalars().all()
    return [AnnouncementRead.model_validate(item) for item in announcements]
