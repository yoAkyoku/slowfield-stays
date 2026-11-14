import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.api import api_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.modules.auth.models import AdminUser, Role
from app.modules.auth.security import hash_password_async
from app.modules.email.service import tick_scheduled_newsletters

SCHEDULER_INTERVAL_SECONDS = 60

# Nothing in this app configured logging, so every `logger.info` in these
# thirteen modules was discarded and every warning/error came out through
# Python's lastResort handler: bare stderr, no timestamp, no level, no logger
# name, interleaved with uvicorn's formatted output. The lines that matter most
# in production — "SMTP password could not be decrypted", "newsletter scheduler
# tick failed" — were the ones arriving as anonymous fragments.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    # uvicorn configures its own handlers first; without this ours never
    # attaches and the whole block is a no-op.
    force=True,
)

logger = logging.getLogger(__name__)


async def _seed_admin() -> None:
    """Create the bootstrap admin user if it doesn't exist yet (idempotent)."""
    from sqlalchemy.exc import IntegrityError

    async with SessionLocal() as session:
        result = await session.execute(
            select(AdminUser).where(AdminUser.email == settings.admin_bootstrap_email)
        )
        if result.scalar_one_or_none():
            return

        role_result = await session.execute(
            select(Role).where(Role.name.in_(["super_admin", "owner"])).order_by(Role.name)
        )
        role = role_result.scalars().first()
        if role is None:
            role = Role(name="super_admin", permissions=["*"])
            session.add(role)
            try:
                await session.flush()
            except IntegrityError:
                # Production runs `--workers 2` and lifespan runs once per
                # worker, so on a brand-new database both of them find no role
                # and both insert one. `roles.name` is unique, so the loser
                # raised HERE — outside the try around commit() below — and a
                # first boot logged a full traceback for a race that is
                # entirely normal and already resolved. Take the row the winner
                # wrote instead of inventing a second one.
                await session.rollback()
                role = (
                    await session.execute(
                        select(Role)
                        .where(Role.name.in_(["super_admin", "owner"]))
                        .order_by(Role.name)
                    )
                ).scalars().first()
                if role is None:
                    raise

        session.add(
            AdminUser(
                email=settings.admin_bootstrap_email,
                name="Super Admin",
                password_hash=await hash_password_async(settings.admin_bootstrap_password),
                role_id=role.id,
                is_active=True,
            )
        )
        try:
            await session.commit()
            logger.info("Seeded bootstrap admin: %s", settings.admin_bootstrap_email)
        except IntegrityError:
            await session.rollback()
            logger.debug("Bootstrap admin already exists (concurrent create), skipping.")


async def _newsletter_scheduler_loop() -> None:
    """Background loop: promote due scheduled campaigns and send them.

    NOTE: `lifespan` runs once per uvicorn worker and production starts
    `--workers 2`, so there are two of these loops ticking the same queue every
    60 seconds — plus whatever the admin triggers by hand. Promotion is a status
    flip and idempotent, but SENDING was not: the queue processor used to select
    pending rows, send them all, and only write status at the end, so the two
    loops read the same rows and mailed subscribers twice. That is why
    process_newsletter_queue claims rows in the database before sending rather
    than holding an in-process lock, which would not cross workers.

    Errors are caught so one bad sweep can't kill the loop.
    """
    while True:
        try:
            result = await tick_scheduled_newsletters(SessionLocal)
            # Log any tick that did something. Keying only on "promoted" meant
            # the ticks that actually deliver the bulk of a campaign — every one
            # after the first — went unrecorded, so a stalled send left nothing
            # in the log to look at.
            if result["promoted"] or result["sent"] or result["failed"]:
                logger.info("Newsletter scheduler tick: %s", result)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Newsletter scheduler tick failed")
        await asyncio.sleep(SCHEDULER_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Seeding is bootstrap, not a precondition for serving.
    #
    # An unguarded await here meant any database hiccup at startup took the
    # whole process down — and with `restart: unless-stopped` plus a CMD that
    # runs migrations first, that is a crash loop rather than a degraded start.
    # The admin row it creates only matters on a brand-new install; an existing
    # deployment has one already, and a running API is what lets anyone diagnose
    # why the database is unhappy.
    try:
        await _seed_admin()
    except Exception:
        logger.exception("Bootstrap admin seeding failed; continuing startup")
    scheduler_task = asyncio.create_task(_newsletter_scheduler_loop())
    try:
        yield
    finally:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass


def create_app() -> FastAPI:
    Path("storage/media").mkdir(parents=True, exist_ok=True)
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
        docs_url=None if settings.app_env == "production" else "/docs",
        redoc_url=None if settings.app_env == "production" else "/redoc",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.get("/healthz", tags=["system"])
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    class SandboxedStaticFiles(StaticFiles):
        """Serve uploaded files with scripting switched off.

        Uploads share an origin with the site, and an SVG is a document: one
        carrying a script would run it against this origin, where the admin
        session cookie is sent automatically. The sandbox directive drops the
        file into a unique opaque origin, so even a file that slips past the
        upload sanitiser cannot script anything or reach the API as the admin.
        nosniff stops a mislabelled upload being re-interpreted as HTML.
        """

        async def get_response(self, path: str, scope):  # type: ignore[override]
            response = await super().get_response(path, scope)
            # The sandbox is needed when an SVG is opened as a document, but it
            # must not be attached to ordinary media responses. Chromium builds
            # its top-level audio/video player around the requested resource;
            # applying ``default-src 'none'`` to an MP4 can leave that player at
            # 0:00 even though the file, MIME type and byte ranges are valid.
            if Path(path).suffix.lower() == ".svg":
                response.headers["Content-Security-Policy"] = (
                    "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
                )
            response.headers["X-Content-Type-Options"] = "nosniff"
            return response

    app.mount("/storage/media", SandboxedStaticFiles(directory="storage/media"), name="media")
    return app


app = create_app()
