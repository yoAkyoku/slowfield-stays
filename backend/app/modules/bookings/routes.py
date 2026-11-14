import logging
from datetime import UTC, datetime
from html import escape

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import booking_form_limiter, client_ip, public_form_limiter
from app.db.session import get_session
from app.modules.bookings.models import BookingRequest
from app.modules.bookings.schemas import BookingRequestCreate, BookingRequestPublicRead
from app.modules.sites.context import resolve_site

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=BookingRequestPublicRead, status_code=201)
async def create_booking_request(
    payload: BookingRequestCreate,
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> BookingRequestPublicRead:
    # Two-tier rate limit: broad public_form ceiling first, then a stricter
    # booking-specific cap (3 per 5 min) so a single IP can't flood the inbox.
    public_form_limiter.check(request)
    booking_form_limiter.check(request)
    # Honeypot: bots that auto-fill every field trip this; humans never see
    # the field (rendered off-screen). Return a fake 201 so the bot doesn't
    # learn the form rejected it, but never write to the DB.
    if payload.website.strip():
        logger.info(
            "booking honeypot trip",
            extra={"ip": client_ip(request)},
        )
        # Pydantic model_validate from a dict to satisfy response_model.
        return BookingRequestPublicRead.model_validate({
            **payload.model_dump(),
            "id": 0,
            "status": "new",
            "created_at": datetime.now(UTC),
        })
    data = payload.model_dump()
    data.pop("website", None)  # never persist the honeypot
    current_site = await resolve_site(session, request.headers.get("host"), site)
    booking = BookingRequest(**data, site_id=current_site.id, status="new")
    session.add(booking)
    await session.commit()
    await session.refresh(booking)
    # Fire a staff notification so the team learns about the request without
    # having to poll the admin queue. Best-effort: never let a mail failure
    # break the booking submission. Per-site: uses this site's email settings
    # and routes to its reply_to (the managers' inbox), falling back to from.
    await _notify_staff_of_booking(session, current_site, booking)
    return BookingRequestPublicRead.model_validate(booking)


async def _notify_staff_of_booking(session: AsyncSession, current_site, booking: BookingRequest) -> None:
    try:
        from app.modules.email.service import get_email_settings, send_email_async

        settings = await get_email_settings(session, current_site.id)
        if not settings or not settings.is_enabled:
            return
        notify_to = (getattr(settings, "reply_to", "") or "").strip() or (settings.from_email or "").strip()
        if not notify_to:
            return

        def _row(label: str, value) -> str:
            if value in (None, ""):
                return ""
            # Every value here came from the unauthenticated public form and this
            # goes out with html=True, so unescaped it lets a visitor put their own
            # markup — a phishing link — inside a genuine notice from our domain.
            return (
                f"<tr><td style='padding:4px 12px 4px 0;color:#6b6a62'>{label}</td>"
                f"<td>{escape(str(value))}</td></tr>"
            )

        site_name = current_site.name or "Slowfield Stays"
        subject = f"[新預約 / New booking] {booking.name} — {site_name}"
        rows = "".join([
            _row("姓名 Name", booking.name),
            _row("Email", booking.email),
            _row("電話 Phone", booking.phone),
            _row("LINE ID", booking.line_id),
            _row("入住 Check-in", booking.check_in),
            _row("退房 Check-out", booking.check_out),
            _row("人數 Guests", booking.guests),
            _row("房型 Room", getattr(booking, "room_type", None)),
            _row("留言 Message", booking.message),
        ])
        body = (
            f"<p>{site_name} 收到一筆新的預約需求 / A new booking request has arrived.</p>"
            f"<table style='border-collapse:collapse;font-size:14px'>{rows}</table>"
            f"<p style='margin-top:16px'>請至後台「預約隊列」查看與回覆。"
            f"<br>Manage it in the admin booking queue.</p>"
        )
        await send_email_async(settings, notify_to, subject, body, html=True)
    except Exception:
        logger.warning("booking notification email failed", exc_info=True)
