"""Who an admin is, and which site they are allowed to act on.

Split out of ``admin.routes`` so the media module can share the same tenant
check. It could not import it there: ``admin.routes`` imports
``store_media_asset`` from ``media.routes``, so the dependency has to live
somewhere neither of them owns. The alternative was a second copy of the
AdminUserSite lookup living in the media module, which is how the two paths
came to disagree in the first place.
"""

from fastapi import Depends, Header, HTTPException, Query, Request
from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_session
from app.modules.auth.models import AdminUser, Role
from app.modules.auth.permissions import GLOBAL_PERMISSIONS, SITE_PERMISSIONS
from app.modules.auth.routes import get_current_admin
from app.modules.sites.context import resolve_site
from app.modules.sites.models import AdminUserSite, Site


async def _global_role(admin: AdminUser, session: AsyncSession) -> Role | None:
    """Return the user's global (system-wide) role, or None."""
    role_id = admin.__dict__.get("role_id")
    if role_id is None:
        loaded = inspect(admin).attrs.role_id.loaded_value
        if isinstance(loaded, int):
            role_id = loaded
    if role_id is None:
        admin_id: int = inspect(admin).identity[0]
        result = await session.execute(select(AdminUser.role_id).where(AdminUser.id == admin_id))
        role_id = result.scalar_one_or_none()
    return await session.get(Role, role_id) if role_id is not None else None


async def _is_super_admin(admin: AdminUser, session: AsyncSession) -> bool:
    role = await _global_role(admin, session)
    return role is not None and "*" in role.permissions


async def _site_role(admin: AdminUser, site: Site, session: AsyncSession) -> Role | None:
    """Return the user's effective role for *site*.

    Super-admins (global ``"*"``) get their global role back.
    Everyone else needs an explicit ``AdminUserSite`` link.
    """
    admin_id: int = inspect(admin).identity[0]
    global_r = await _global_role(admin, session)
    if global_r and "*" in global_r.permissions:
        return global_r
    result = await session.execute(
        select(AdminUserSite).options(selectinload(AdminUserSite.role)).where(
            AdminUserSite.admin_user_id == admin_id,
            AdminUserSite.site_id == site.id,
        )
    )
    link = result.scalar_one_or_none()
    return link.role if link else None


async def get_admin_site(
    admin: AdminUser = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
    site: str | None = Query(default=None),
    x_site_slug: str | None = Header(default=None),
) -> Site:
    if session is None:
        return Site(id=1, name="Slowfield Stays", slug="slowfield", domain="localhost")
    current = await resolve_site(session, None, site or x_site_slug, include_unpublished=True)
    role = await _site_role(admin, current, session)
    if role is None:
        # Strict isolation — without a direct AdminUserSite role on this site
        # the admin can neither read nor edit it. Child-site admins therefore
        # cannot reach the parent site by manually entering its slug; the
        # frontend SiteSwitcher already hides anything not in this user's
        # accessible list.
        raise HTTPException(status_code=403, detail="Site access denied")
    return current


# Moved here from admin.routes for the same reason get_admin_site was: the
# media module has to apply the same permission check, and it cannot import
# admin.routes — that module imports media.routes. The two paths disagreeing
# about permissions is exactly what a second copy would reintroduce.
# Re-exported under their old names so the existing importers keep working; the
# definitions moved next to Role so auth.routes can read the same list without
# importing this module (which imports auth.routes).
_GLOBAL_PERMISSIONS = GLOBAL_PERMISSIONS
_SITE_PERMISSIONS = SITE_PERMISSIONS


def require_permission(permission: str):
    """Check the user has *permission*.

    * ``"*"`` — only super-admins pass.
    * Global permissions (``sites:*``, ``global_users:*``, ``roles:*``)
      are checked against the user's **global role**.
    * Site permissions (``stays:*``, ``cms:*``, …) are checked against
      the user's **site-specific role** (``AdminUserSite`` link) for the
      site resolved from ``X-Site-Slug``.
    """

    async def dependency(
        request: Request,
        admin: AdminUser = Depends(get_current_admin),
        session: AsyncSession = Depends(get_session),
        site: str | None = Query(default=None),
        x_site_slug: str | None = Header(default=None),
    ) -> AdminUser:
        # 1. Load the global role
        admin_id: int = inspect(admin).identity[0]
        role_id = admin.__dict__.get("role_id")
        if role_id is None:
            loaded = inspect(admin).attrs.role_id.loaded_value
            if isinstance(loaded, int):
                role_id = loaded
        if role_id is None:
            result = await session.execute(select(AdminUser.role_id).where(AdminUser.id == admin_id))
            role_id = result.scalar_one_or_none()
        global_role = await session.get(Role, role_id) if role_id is not None else None
        global_perms = global_role.permissions if global_role else []

        # 2. Super-admin shortcut
        if "*" in global_perms:
            return admin

        # 3. Requesting super-admin-only endpoint?
        if permission == "*":
            raise HTTPException(status_code=403, detail="Permission denied")

        # 4. Global permission → check global role only
        if permission in _GLOBAL_PERMISSIONS:
            if permission in global_perms:
                return admin
            raise HTTPException(status_code=403, detail="Permission denied")

        # 5. Site permission → check AdminUserSite link for the site being acted on.
        #    When the route addresses a site by path (/sites/{site_id}/...), the
        #    permission MUST be evaluated against THAT site — never a slug the
        #    caller supplies out-of-band via ?site= / X-Site-Slug. Reading the
        #    permission-site from the header while the handler mutates the
        #    path-site let a caller borrow a permission held on site A (e.g.
        #    site_users:write as admin of villa A) to act on site B where they
        #    hold only a content role. request.path_params carries only genuine
        #    path segments, so ?site_id= cannot spoof it.
        path_site_id = request.path_params.get("site_id")
        if path_site_id is not None:
            current_site = await session.get(Site, int(path_site_id))
            if current_site is None:
                raise HTTPException(status_code=404, detail="Site not found")
        else:
            current_site = await resolve_site(session, None, site or x_site_slug, include_unpublished=True)
        link_result = await session.execute(
            select(AdminUserSite).options(selectinload(AdminUserSite.role)).where(
                AdminUserSite.admin_user_id == admin_id,
                AdminUserSite.site_id == current_site.id,
            )
        )
        link = link_result.scalar_one_or_none()
        site_perms = link.role.permissions if link and link.role else []
        if permission in site_perms:
            return admin

        raise HTTPException(status_code=403, detail="Permission denied")

    return dependency
