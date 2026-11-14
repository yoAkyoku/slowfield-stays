import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.limits import cap_rows
from app.db.session import get_session
from app.modules.stays.models import Stay
from app.modules.stays.schemas import StayRead
from app.modules.sites.context import resolve_site

logger = logging.getLogger(__name__)

# asyncpg raises ConnectionRefusedError unwrapped at pool checkout, so a real
# outage never becomes a SQLAlchemyError — narrowing to that alone turned a
# degraded response into a 500.
DB_UNAVAILABLE = (SQLAlchemyError, OSError)

router = APIRouter()


def _stay_read(stay: Stay) -> StayRead:
    return StayRead(
        id=stay.id,
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
        tags=stay.tags or [],
        amenities=[item.name for item in stay.amenities],
        facilities=stay.facilities or [],
        experiences=stay.experiences or [],
        room_types=[
            {
                "name": room.name,
                "description": room.description,
                "price": room.price,
                "capacity": room.capacity,
            }
            for room in stay.room_types
        ],
        images=[
            {"image_url": image.image_url, "alt_text": image.alt_text, "sort_order": image.sort_order}
            for image in sorted(stay.images, key=lambda item: item.sort_order)
        ],
        seo=stay.seo,
        detail_config=stay.detail_config,
        faq=stay.faq,
        house_rules=stay.house_rules,
        location_config=stay.location_config,
        social_links=stay.social_links,
        related_content_ids=stay.related_content_ids,
        translations=stay.translations or {},
    )



def matches_any_facility(stay: StayRead, needles: list[str]) -> bool:
    """Does this stay offer any of the requested facilities?

    Multi-select is OR: picking several widens the results rather than narrowing
    them, which is what a row of toggle chips looks like it should do.

    `facilities` holds the ticked canonical values and is the real answer.
    `amenities` is the villa's own display copy ("14 米中庭泳池 · Courtyard
    Pool"), matched as a substring so a villa whose copy happens to name the
    facility still answers the filter — that is how the data looked before
    facilities existed, and it keeps older records searchable.

    Needles are expected lower-cased by the caller.
    """
    ticked = [str(item).lower() for item in (stay.facilities or [])]
    copy = [str(item).lower() for item in stay.amenities]
    return any(
        needle in ticked or any(needle in text for text in copy)
        for needle in needles
    )


def matches_any_experience(stay: StayRead, needles: list[str]) -> bool:
    """Match any selected 慢域體驗 against its controlled stay values."""
    assigned = {str(item).lower() for item in (stay.experiences or [])}
    return any(needle in assigned for needle in needles)

@router.get("", response_model=list[StayRead])
async def list_stays(
    request: Request,
    destination: str | None = Query(default=None),
    region: str | None = Query(default=None),
    guests: int | None = Query(default=None, ge=1),
    tag: str | None = Query(default=None),
    amenity: list[str] | None = Query(default=None),
    experience: list[str] | None = Query(default=None),
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[StayRead]:
    current_site = await resolve_site(session, request.headers.get("host"), site)
    try:
        result = await session.execute(
            select(Stay)
            .where(Stay.status == "published", Stay.site_id == current_site.id, Stay.deleted_at.is_(None))
            .options(selectinload(Stay.amenities), selectinload(Stay.room_types), selectinload(Stay.images))
            .order_by(Stay.sort_order.asc(), Stay.id.desc())
        )
        db_stays = cap_rows(list(result.scalars().all()), "GET /stays")
    except DB_UNAVAILABLE:
        logger.error("Failed to query stays for site %s", current_site.id, exc_info=True)
        db_stays = []
    # Serialised outside the try, one row at a time: the whole list used to be
    # built inside it, so a single unreadable stay emptied the catalogue and the
    # page answered 200 with nothing on it. One missing villa is the smaller
    # outage, and a serialisation bug is a bug rather than an empty result.
    stays = []
    for stay in db_stays:
        try:
            stays.append(_stay_read(stay))
        except Exception:
            logger.error("Stay %s could not be serialised; omitted", getattr(stay, "id", "?"), exc_info=True)
    # Both accept a comma-separated list and match if ANY value matches.
    #
    # region and destination are free text typed per stay, so the same place is
    # filed under more than one spelling — the catalogue has stays under both
    # "Yilan" and "宜蘭". The search bar builds its options from those values, so
    # it offered two chips that both read 宜蘭, and picking either returned half
    # the stays in the county with nothing to say the other half existed.
    #
    # The frontend now merges chips that read the same and submits every raw
    # value behind them. A single value with no comma behaves exactly as before,
    # so old links and bookmarks are unaffected.
    def _any_match(value: str | None, raw_query: str) -> bool:
        haystack = (value or "").lower()
        return any(needle in haystack for needle in
                   (part.strip().lower() for part in raw_query.split(",")) if needle)

    if destination:
        stays = [stay for stay in stays if _any_match(stay.destination, destination)]
    if region:
        stays = [stay for stay in stays if _any_match(stay.region, region)]
    if guests:
        stays = [stay for stay in stays if stay.max_guests >= guests]
    if tag:
        stays = [stay for stay in stays if tag.lower() in [item.lower() for item in stay.tags]]
    if amenity:
        needles = [a.lower() for a in amenity if a and a.strip()]
        if needles:
            stays = [stay for stay in stays if matches_any_facility(stay, needles)]
    if experience:
        needles = [value.strip().lower() for value in experience if value and value.strip()]
        if needles:
            stays = [stay for stay in stays if matches_any_experience(stay, needles)]
    return stays


@router.get("/search-options")
async def list_stay_search_options(
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, str]]:
    """Return only the location fields needed to build the search controls."""
    current_site = await resolve_site(session, request.headers.get("host"), site)
    try:
        rows = (
            await session.execute(
                select(Stay.region, Stay.destination)
                .where(
                    Stay.status == "published",
                    Stay.site_id == current_site.id,
                    Stay.deleted_at.is_(None),
                )
                .order_by(Stay.sort_order.asc(), Stay.id.desc())
            )
        ).all()
    except DB_UNAVAILABLE:
        logger.error("Failed to query stay search options for site %s", current_site.id, exc_info=True)
        return []
    return [{"region": str(region or ""), "destination": str(destination or "")} for region, destination in rows]


@router.get("/{slug}", response_model=StayRead)
async def get_stay(
    slug: str,
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> StayRead:
    current_site = await resolve_site(session, request.headers.get("host"), site)
    try:
        result = await session.execute(
            select(Stay).where(
                Stay.slug == slug,
                Stay.status == "published",
                Stay.site_id == current_site.id,
                Stay.deleted_at.is_(None),
            )
            .options(selectinload(Stay.amenities), selectinload(Stay.room_types), selectinload(Stay.images))
        )
        stay = result.scalar_one_or_none()
        if stay:
            return _stay_read(stay)
    except Exception:
        logger.warning("Failed to fetch stay '%s'", slug, exc_info=True)
    raise HTTPException(status_code=404, detail="Stay not found")
