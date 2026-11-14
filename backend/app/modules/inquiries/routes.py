import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import client_ip, inquiry_form_limiter, public_form_limiter
from app.db.session import get_session
from app.modules.inquiries.models import Inquiry
from app.modules.inquiries.schemas import InquiryCreate, InquiryRead
from app.modules.sites.context import resolve_site

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=InquiryRead, status_code=201)
async def create_inquiry(
    payload: InquiryCreate,
    request: Request,
    site: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> InquiryRead:
    public_form_limiter.check(request)
    inquiry_form_limiter.check(request)
    if payload.website.strip():
        logger.info(
            "inquiry honeypot trip",
            extra={"ip": client_ip(request)},
        )
        return InquiryRead.model_validate({
            **payload.model_dump(),
            "id": 0,
            "status": "new",
            "created_at": datetime.now(UTC),
        })
    data = payload.model_dump()
    data.pop("website", None)
    current_site = await resolve_site(session, request.headers.get("host"), site)
    inquiry = Inquiry(**data, site_id=current_site.id, status="new")
    session.add(inquiry)
    await session.commit()
    await session.refresh(inquiry)
    return InquiryRead.model_validate(inquiry)


@router.get("", response_model=list[InquiryRead])
async def list_inquiries() -> list[InquiryRead]:
    return []
