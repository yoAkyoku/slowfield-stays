from fastapi import APIRouter

from app.modules.admin.routes import router as admin_router
from app.modules.auth.routes import router as auth_router
from app.modules.bookings.routes import router as bookings_router
from app.modules.cms.routes import router as cms_router
from app.modules.inquiries.routes import router as inquiries_router
from app.modules.media.routes import router as media_router
from app.modules.newsletter.routes import router as newsletter_router
from app.modules.sites.routes import router as sites_router
from app.modules.stays.routes import router as stays_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(cms_router, prefix="/cms", tags=["cms"])
api_router.include_router(stays_router, prefix="/stays", tags=["stays"])
api_router.include_router(bookings_router, prefix="/booking-requests", tags=["booking-requests"])
api_router.include_router(inquiries_router, prefix="/inquiries", tags=["inquiries"])
api_router.include_router(media_router, prefix="/media", tags=["media"])
api_router.include_router(newsletter_router, prefix="/newsletter", tags=["newsletter"])
api_router.include_router(sites_router, prefix="/site", tags=["site"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
