import logging
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from urllib.parse import urlsplit

from jose import JWTError, jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.rate_limit import client_ip, login_limiter, password_reset_limiter
from app.db.session import get_session
from app.modules.auth.models import AdminUser, LoginAudit, PasswordResetToken, Role
from app.modules.auth.permissions import GLOBAL_PERMISSIONS
from app.modules.auth.schemas import (
    AdminProfile,
    BootstrapAdminResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    TokenResponse,
)
from app.modules.auth.security import (
    ALGORITHM,
    create_access_token,
    hash_password,
    hash_password_async,
    needs_rehash,
    verify_password_async,
)
from app.modules.email.service import send_password_reset_email
from app.modules.sites.models import AdminUserSite, Site

logger = logging.getLogger(__name__)

# A real hash of a value nothing can log in with, so a login attempt for an
# address that does not exist still pays the KDF cost. Built once at import:
# hashing it per request would put the cost on the wrong side of the timer.
_DUMMY_PASSWORD_HASH = hash_password("not-a-real-password-" + token_urlsafe(16))

router = APIRouter()
PASSWORD_RESET_EXPIRE_MINUTES = 30
_COOKIE_AUTH_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def hash_reset_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _credential_from_request(authorization: str | None, request: Request | None) -> str:
    """Read the bearer token, or the same-origin HttpOnly admin cookie.

    Browser media uploads bypass the Next proxy so a 100 MB video is not
    parsed and buffered twice. Cookie-authenticated writes must carry a matching
    Origin; server-to-server Bearer requests keep their existing behaviour.
    """
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()

    token = request.cookies.get("admin-token") if request is not None else None
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    if request.method.upper() in _COOKIE_AUTH_MUTATING_METHODS:
        origin = request.headers.get("origin")
        host = request.headers.get("host")
        try:
            origin_host = urlsplit(origin or "").netloc
        except ValueError:
            origin_host = ""
        if not origin_host or not host or origin_host.lower() != host.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF rejected")
    return token


async def get_current_admin(
    request: Request,
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> AdminUser:
    token = _credential_from_request(authorization, request)
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
        # Tokens minted before this claim existed have no "epc"; treating them
        # as epoch 0 keeps everyone signed in across the deploy, and the first
        # password change after it invalidates them like any other.
        token_epoch = int(payload.get("epc", 0))
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    result = await session.execute(
        select(AdminUser).options(selectinload(AdminUser.role)).where(AdminUser.id == user_id)
    )
    user = result.scalar_one_or_none()
    # `deleted_at` alongside `is_active` and not folded into it: 停用 and 刪除
    # are different verbs with different undo, and the row has to keep saying
    # which one happened. What they share is this line — a token minted before
    # either stops working on the next request, which is what makes 刪除 take
    # effect on a session that is open at the moment it is pressed rather than
    # whenever the JWT happens to expire (seven days).
    if user is None or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive admin")
    # A token from before the account's current epoch belongs to a session that
    # a password change has since ended.
    if token_epoch < (user.token_epoch or 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session ended by a password change",
        )
    _ = user.role_id
    return user


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    login_limiter.check(request)
    result = await session.execute(select(AdminUser).where(AdminUser.email == payload.email))
    user = result.scalar_one_or_none()
    # The KDF runs even when the account does not exist.
    #
    # Python short-circuits `user and ...`, so a request for an unknown address
    # skipped verify_password_async entirely and answered in about a
    # millisecond, while a real address paid the full PBKDF2 cost — measured at
    # 284ms for 600k rounds. Three orders of magnitude apart needs no statistics
    # to read, and it enumerated every administrator's email address.
    # forgot-password goes to the trouble of returning an identical response
    # either way; this undid that.
    #
    # Verifying against a throwaway hash costs what verifying a real one costs,
    # which is the whole point.
    if user is not None:
        password_ok = await verify_password_async(payload.password, user.password_hash)
    else:
        await verify_password_async(payload.password, _DUMMY_PASSWORD_HASH)
        password_ok = False
    success = bool(user and user.is_active and user.deleted_at is None and password_ok)
    # A successful login is the only point where the plaintext exists, so it is
    # the only place a hash below the current work factor can be upgraded.
    if success and user is not None and needs_rehash(user.password_hash):
        user.password_hash = await hash_password_async(payload.password)
    session.add(
        LoginAudit(
            admin_user_id=user.id if user else None,
            email=payload.email,
            ip_address=client_ip(request),
            success=success,
        )
    )
    await session.commit()
    if not success or user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(str(user.id), user.token_epoch or 0))


@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    payload: ChangePasswordRequest,
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
) -> ChangePasswordResponse:
    if not await verify_password_async(payload.current_password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if await verify_password_async(payload.new_password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different")

    admin.password_hash = await hash_password_async(payload.new_password)
    # Ends every other session opened with the old password. The caller's own
    # token goes with them, which is why a fresh one is returned.
    admin.token_epoch = (admin.token_epoch or 0) + 1
    await session.commit()
    return ChangePasswordResponse(
        accepted=True,
        message="Password updated",
        access_token=create_access_token(str(admin.id), admin.token_epoch),
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ForgotPasswordResponse:
    password_reset_limiter.check(request)
    result = await session.execute(select(AdminUser).where(AdminUser.email == payload.email))
    user = result.scalar_one_or_none()
    reset_url: str | None = None
    # A deleted account is treated exactly as one that never existed: no token
    # is minted, no mail goes out, and the response below is the same either
    # way — so this does not become a way to ask whether an address used to be
    # an administrator here.
    if user is not None and user.deleted_at is not None:
        user = None
    if user:
        # Invalidate any existing unused reset tokens for this user
        await session.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.admin_user_id == user.id, PasswordResetToken.used_at.is_(None))
            .values(used_at=datetime.now(UTC))
        )
        token = token_urlsafe(32)
        session.add(
            PasswordResetToken(
                admin_user_id=user.id,
                token_hash=hash_reset_token(token),
                expires_at=datetime.now(UTC) + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES),
            )
        )
        await session.commit()
        reset_url = f"{settings.frontend_url.rstrip('/')}/admin/reset-password?token={token}"
        # The relay this goes out over belongs to a site, and every site admin
        # controls their own smtp_host — so sending over a site this user is not
        # linked to hands their reset link to that site's admin. With no link, or
        # with several, there is no one site that is unambiguously theirs, so we
        # send nothing and log: an operator resetting the password by hand is the
        # safe failure, mailing the wrong tenant is not.
        site_ids = (
            await session.execute(
                select(AdminUserSite.site_id).where(AdminUserSite.admin_user_id == user.id)
            )
        ).scalars().all()
        if len(site_ids) != 1:
            logger.error(
                "No password reset email sent to %s: %d site links, cannot pick an SMTP relay",
                user.email,
                len(site_ids),
            )
        else:
            try:
                # The response below is identical either way — telling the caller
                # the mail failed would tell them the account exists.
                if not await send_password_reset_email(session, site_ids[0], user.email, reset_url):
                    logger.error(
                        "Password reset email to %s not sent: site %s SMTP is off or incomplete",
                        user.email,
                        site_ids[0],
                    )
            except Exception:
                logger.error("Failed to send password reset email to %s", user.email, exc_info=True)
    return ForgotPasswordResponse(
        accepted=True,
        message="If the account exists, a password reset email will be sent.",
        reset_url=reset_url if settings.app_env == "local" else None,
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ResetPasswordResponse:
    password_reset_limiter.check(request)
    result = await session.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_reset_token(payload.token))
    )
    reset_token = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if reset_token is None or reset_token.used_at is not None or reset_token.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    user = await session.get(AdminUser, reset_token.admin_user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        # A link mailed out before the account was deleted must not be a way
        # back in. Same wording as an expired token, for the same reason it is
        # the same wording for an inactive one: the response tells the holder
        # nothing about the account's state.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    if await verify_password_async(payload.new_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be different")

    user.password_hash = await hash_password_async(payload.new_password)
    # The whole point of a reset is often that someone else has the account;
    # their sessions end here.
    user.token_epoch = (user.token_epoch or 0) + 1
    reset_token.used_at = now
    await session.commit()
    return ResetPasswordResponse(accepted=True, message="Password reset complete")


@router.get("/me", response_model=AdminProfile)
async def me(
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
    site: str | None = None,
) -> AdminProfile:
    global_role = await session.get(Role, admin.role_id)
    global_role_name = global_role.name if global_role else "admin"
    global_perms: list[str] = global_role.permissions if global_role else []

    # Super-admin: return everything
    if "*" in global_perms:
        return AdminProfile(
            id=admin.id,
            email=admin.email,
            name=admin.name,
            role=global_role_name,
            permissions=["*"],
        )

    # Merge, the same way require_permission resolves.
    #
    # This took the global role's permissions whole, but only the GLOBAL ones
    # are honoured from that slot (deps.require_permission step 4) — site
    # permissions there are ignored at enforcement time. While a site user's
    # global slot held the "admin" row, /auth/me therefore reported a full set
    # of site permissions for a site the user has no link to, and the admin UI
    # drew menus for pages that answer 403. Filtering to the global set makes
    # what is reported and what is allowed the same list.
    merged = {p for p in global_perms if p in GLOBAL_PERMISSIONS}
    site_role_name = ""

    if site:
        site_obj = await session.execute(select(Site).where(Site.slug == site))
        site_record = site_obj.scalar_one_or_none()
        if site_record:
            from sqlalchemy import inspect as sa_inspect
            admin_id: int = sa_inspect(admin).identity[0]
            link_result = await session.execute(
                select(AdminUserSite)
                .options(selectinload(AdminUserSite.role))
                .where(
                    AdminUserSite.admin_user_id == admin_id,
                    AdminUserSite.site_id == site_record.id,
                )
            )
            link = link_result.scalar_one_or_none()
            if link and link.role:
                site_role_name = link.role.name
                merged.update(link.role.permissions)

    # Display role: prefer site role name when available
    display_role = site_role_name or global_role_name

    return AdminProfile(
        id=admin.id,
        email=admin.email,
        name=admin.name,
        role=display_role,
        permissions=sorted(merged),
    )


@router.post("/bootstrap-admin", response_model=BootstrapAdminResponse)
async def bootstrap_admin(session: AsyncSession = Depends(get_session)) -> BootstrapAdminResponse:
    # Block in production — this endpoint should only run during local setup
    if settings.app_env == "production":
        raise HTTPException(status_code=403, detail="Bootstrap is disabled in production")

    result = await session.execute(select(AdminUser).where(AdminUser.email == settings.admin_bootstrap_email))
    existing = result.scalar_one_or_none()
    if existing:
        return BootstrapAdminResponse(
            email=settings.admin_bootstrap_email,
            password="********",
            created=False,
        )

    # Try super_admin first, fall back to legacy "owner"
    role_result = await session.execute(
        select(Role).where(Role.name.in_(["super_admin", "owner"])).order_by(Role.name)
    )
    role = role_result.scalars().first()
    if role is None:
        role = Role(name="super_admin", permissions=["*"])
        session.add(role)
        await session.flush()

    session.add(
        AdminUser(
            email=settings.admin_bootstrap_email,
            name="Super Admin",
            password_hash=await hash_password_async(settings.admin_bootstrap_password),
            role_id=role.id,
            is_active=True,
        )
    )
    await session.commit()
    return BootstrapAdminResponse(
        email=settings.admin_bootstrap_email,
        password="********",
        created=True,
    )
