import logging
import secrets
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import RateLimiter, subscribe_limiter, unsubscribe_limiter
from app.db.session import get_session
from app.modules.email.models import NewsletterSubscriber
from app.modules.email.service import resolve_unsubscribe_base_url, unsubscribe_page_url
from app.modules.newsletter.schemas import NewsletterResult, NewsletterSubscribe
from app.modules.sites.context import resolve_site
from app.modules.sites.models import Site

logger = logging.getLogger(__name__)

router = APIRouter()

_SUPPORTED_LOCALES = ("zh", "en")

#: RFC 8058 §3.1 — the body a mailbox provider posts when the reader uses the
#: unsubscribe button the List-Unsubscribe-Post header enables.
ONE_CLICK_BODY = ("List-Unsubscribe", "One-Click")

#: One-click POSTs do not come from the reader's machine; they come from Gmail's
#: or Yahoo's outbound range, so a whole campaign's unsubscribes arrive from a
#: handful of shared addresses. The 20/minute ceiling the browser-driven
#: endpoint uses would start answering those with 429s, which the provider reads
#: as "this sender's one-click is broken" — the exact reputation damage the
#: header exists to avoid. Still bounded, because the endpoint writes.
one_click_limiter = RateLimiter(max_requests=300, window_seconds=60)


def _resolve_locale(query_locale: str | None, request: Request, default_locale: str) -> str:
    """Pick the visitor's locale: explicit query param, then Accept-Language, then the site default."""
    if query_locale in _SUPPORTED_LOCALES:
        return query_locale
    for part in request.headers.get("accept-language", "").split(","):
        code = part.split(";")[0].strip().lower()[:2]
        if code in _SUPPORTED_LOCALES:
            return code
    return default_locale if default_locale in _SUPPORTED_LOCALES else "zh"


@router.post("/subscribe", response_model=NewsletterResult, status_code=201)
async def subscribe(
    payload: NewsletterSubscribe,
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> NewsletterResult:
    subscribe_limiter.check(request)
    current_site = await resolve_site(session, request.headers.get("host"), site)
    email = payload.email.strip().lower()
    existing = await _live_subscriber(session, current_site.id, email)
    if existing is not None:
        _apply_signup(existing, payload)
        await session.commit()
        return NewsletterResult(ok=True, status="subscribed")

    subscriber = NewsletterSubscriber(
        site_id=current_site.id,
        email=email,
        name=payload.name.strip(),
        groups=payload.groups,
        unsubscribe_token=secrets.token_urlsafe(32),
    )
    session.add(subscriber)
    try:
        await session.commit()
    except IntegrityError:
        # Two submissions of the same address at once: both read nothing and
        # both insert, and the unique index lets exactly one through. Before
        # that index this produced a duplicate row — the address then received
        # every newsletter twice, an unsubscribe stopped only one copy, and the
        # NEXT signup from that address failed outright because the lookup above
        # was `scalar_one_or_none`. The loser of the race is not an error to the
        # person on the form; their subscription exists, so finish the job.
        await session.rollback()
        winner = await _live_subscriber(session, current_site.id, email)
        if winner is None:
            raise
        _apply_signup(winner, payload)
        await session.commit()
    return NewsletterResult(ok=True, status="subscribed")


async def _live_subscriber(
    session: AsyncSession, site_id: int, email: str
) -> NewsletterSubscriber | None:
    """The subscription for this address, ignoring erased ones.

    `deleted_at IS NULL` matches the partial unique index. It also has a meaning:
    a row that was erased on request must not be silently revived by a later
    signup — that signup is fresh consent and gets a fresh row, while the old one
    stays as the record of the erasure.

    `first()` rather than `one_or_none()` because the latter RAISES on duplicate
    rows. The index makes new duplicates impossible, but a database that has not
    run the merge migration yet still holds old ones, and a public form must not
    return 500 because of history.
    """
    return (
        await session.execute(
            select(NewsletterSubscriber)
            .where(
                NewsletterSubscriber.site_id == site_id,
                NewsletterSubscriber.email == email,
                NewsletterSubscriber.deleted_at.is_(None),
            )
            .order_by(NewsletterSubscriber.id)
        )
    ).scalars().first()


def _apply_signup(subscriber: NewsletterSubscriber, payload: NewsletterSubscribe) -> None:
    subscriber.name = payload.name.strip() or subscriber.name
    # Public signup may add a source group, but must retain operator segments.
    subscriber.groups = list(dict.fromkeys([*(subscriber.groups or []), *(payload.groups or [])]))
    subscriber.status = "subscribed"


async def _unsubscribe_address(session: AsyncSession, subscriber: NewsletterSubscriber) -> int:
    """Opt this ADDRESS out for its site, not merely the row the token points at.

    A token belongs to one row. That was the whole of an unsubscribe, so where an
    address had more than one row — which nothing prevented until the unique
    index — clicking the link in one newsletter stopped that copy and left the
    others sending. Mail after an explicit opt-out is the one failure bulk mail
    cannot have.

    It still matters with the index in place: the merge migration soft-deletes
    the duplicates it finds, and the links already sitting in people's inboxes
    carry those rows' tokens. Such a link would otherwise unsubscribe a row that
    sends nothing and leave the surviving one subscribed.

    Returns how many rows were changed, for the log.
    """
    subscriber.status = "unsubscribed"
    changed = 1
    site_match = (
        NewsletterSubscriber.site_id.is_(None)
        if subscriber.site_id is None
        else NewsletterSubscriber.site_id == subscriber.site_id
    )
    siblings = (
        await session.execute(
            select(NewsletterSubscriber).where(
                site_match,
                NewsletterSubscriber.email == subscriber.email,
                NewsletterSubscriber.id != subscriber.id,
                NewsletterSubscriber.deleted_at.is_(None),
            )
        )
    ).scalars().all()
    for sibling in siblings:
        if sibling.status != "unsubscribed":
            sibling.status = "unsubscribed"
            changed += 1
    return changed


async def _subscriber_for_token(session: AsyncSession, token: str) -> NewsletterSubscriber | None:
    return (
        await session.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.unsubscribe_token == token))
    ).scalar_one_or_none()


async def _is_one_click_post(request: Request) -> bool:
    """Whether the body is the ``List-Unsubscribe=One-Click`` RFC 8058 names.

    Read from the raw body rather than ``request.form()`` so a provider that
    omits or mangles the Content-Type cannot make this raise. The answer is
    logged, not enforced: the header we publish is a promise that this URI
    unsubscribes, and refusing a POST because its body was not byte-perfect
    would break the promise for the sake of a formality.
    """
    try:
        raw = (await request.body()).decode("utf-8", "replace")
    except Exception:  # pragma: no cover - a body we cannot read is not a reason to fail
        return False
    return ONE_CLICK_BODY in parse_qsl(raw, keep_blank_values=True)


@router.post("/unsubscribe/one-click", response_model=NewsletterResult)
async def one_click_unsubscribe(
    request: Request,
    token: str = Query(...),
    session: AsyncSession = Depends(get_session),
) -> NewsletterResult:
    """RFC 8058 one-click unsubscribe — the URI in the List-Unsubscribe header.

    Deliberately separate from the GET confirmation page the same token also
    reaches: that page must keep rendering without writing, because mail
    scanners and link-preview fetchers follow GETs and would otherwise
    unsubscribe people who never clicked anything. A POST is not something a
    scanner does, which is the entire premise of RFC 8058, so it is safe — and
    required — for this one to act immediately with no second confirmation.
    """
    one_click_limiter.check(request)
    subscriber = await _subscriber_for_token(session, token)
    if subscriber is None:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    well_formed = await _is_one_click_post(request)
    changed = await _unsubscribe_address(session, subscriber)
    await session.commit()
    logger.info(
        "One-click unsubscribe for subscriber %s (site %s), %d row(s), "
        "RFC 8058 body present: %s",
        subscriber.id,
        subscriber.site_id,
        changed,
        well_formed,
    )
    return NewsletterResult(ok=True, status="unsubscribed")


@router.get("/unsubscribe/one-click", include_in_schema=False)
async def one_click_unsubscribe_landing(
    token: str = Query(default=""),
    session: AsyncSession = Depends(get_session),
) -> RedirectResponse:
    """A human who opened the header's URI instead of pressing the button.

    Some clients surface the List-Unsubscribe URI as an ordinary link, and mail
    scanners fetch it. Both arrive here as a GET, so this hands them the
    confirmation page and writes nothing at all.
    """
    subscriber = await _subscriber_for_token(session, token) if token else None
    base_url = await resolve_unsubscribe_base_url(
        session, subscriber.site_id if subscriber is not None else None
    )
    return RedirectResponse(unsubscribe_page_url(base_url, token), status_code=302)


@router.post("/unsubscribe", response_model=NewsletterResult)
async def unsubscribe(
    request: Request,
    token: str = Query(...),
    locale: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> NewsletterResult:
    unsubscribe_limiter.check(request)
    subscriber = await _subscriber_for_token(session, token)
    if subscriber is None:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    # Resolve which site the subscriber belonged to so the page can name it.
    # Done before the commit: a blob that will not format must fail the whole
    # request, not leave the visitor unsubscribed and looking at a 500 that
    # invites them to click the link again.
    site_name = None
    site_slug = None
    if subscriber.site_id is not None:
        site = await session.get(Site, subscriber.site_id)
        if site is not None:
            site_slug = site.slug
            # settings is hand-editable free-form JSON validated only at its top
            # level, so `{"name_translations": "禾境"}` saves cleanly and a
            # truthy string sails past `or {}` into an AttributeError on .get.
            site_settings = site.settings if isinstance(site.settings, dict) else {}
            name_trs = site_settings.get("name_translations")
            if not isinstance(name_trs, dict):
                name_trs = {}
            # The tokenised link carries no locale, so a hard "zh"-first lookup showed
            # an English subscriber the Chinese name. Resolve per the visitor's locale,
            # then the other locale, then the raw site name.
            visitor_locale = _resolve_locale(locale, request, site.default_locale)
            other_locale = "en" if visitor_locale == "zh" else "zh"
            site_name = name_trs.get(visitor_locale) or name_trs.get(other_locale) or site.name
    await _unsubscribe_address(session, subscriber)
    await session.commit()
    return NewsletterResult(ok=True, status="unsubscribed", site_name=site_name, site_slug=site_slug)
