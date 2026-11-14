"""A site-scoped admin's global role is not the same row as their site role.

A role sits in one of two slots — ``AdminUser.role_id`` decides GLOBAL
permissions (``sites:*``, ``global_users:*``, ``roles:*``) and
``AdminUserSite.role_id`` decides SITE ones. That split is the multi-tenant
boundary and ``require_permission`` enforces it slot by slot.

``create_admin_user`` put the SAME Role row in both slots for a site user, so
every villa admin's global role was the row named "admin". Nothing was wrong
while that row held only site permissions — and the roles screen offers
``sites:write`` right beside ``cms:write``, so one tick would have granted it to
every site admin on the network through a slot nobody was looking at.

Three things keep it apart now, and each is tested here: new accounts get the
empty ``site_member`` row globally, the roles screen refuses network permissions
on a site role, and nobody may edit a role they hold themselves.
"""

import asyncio

import pytest
from fastapi import HTTPException

import app.modules.admin.routes as routes
from app.modules.admin.routes import (
    SITE_MEMBER_ROLE,
    SITE_ROLE_NAMES,
    _role_permissions,
    create_admin_user,
    update_role_permissions,
)
from app.modules.auth.models import AdminUser, Role
from app.modules.auth.permissions import GLOBAL_PERMISSIONS
from app.modules.sites.models import AdminUserSite, Site


class _Result:
    def __init__(self, value=None, many=None):
        self._value, self._many = value, many or []

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._many


class _Session:
    """Enough AsyncSession surface for the two handlers under test."""

    def __init__(self, rows=None, scalar_rows=None):
        self.added = []
        self.rows = rows or {}
        self.scalar_rows = scalar_rows or []
        self.committed = False

    async def execute(self, _statement):
        return _Result(many=self.scalar_rows)

    async def get(self, model, item_id):
        return self.rows.get((model, item_id))

    def add(self, item):
        self.added.append(item)

    async def flush(self):
        # The handler reads user.id after flushing.
        for item in self.added:
            if isinstance(item, AdminUser) and item.id is None:
                item.id = 99

    async def commit(self):
        self.committed = True

    async def refresh(self, _item):
        return None


class _Payload:
    def __init__(self, role):
        self.role = role
        self.email = "New.Admin@example.com"
        self.name = "New Admin"
        self.password = "a-password"
        self.site_slug = None


def _make_roles():
    """One Role row per name, each with a distinct id."""
    rows = {"admin": Role(id=2, name="admin", permissions=_role_permissions("admin")),
            "editor": Role(id=3, name="editor", permissions=_role_permissions("editor")),
            "super_admin": Role(id=1, name="super_admin", permissions=["*"]),
            SITE_MEMBER_ROLE: Role(id=4, name=SITE_MEMBER_ROLE, permissions=[])}
    return rows


def _create(role_name):
    """Run create_admin_user and return (global_role_id, site_role_id)."""
    roles = _make_roles()
    session = _Session()

    async def _ensure(_session, name):
        return roles[name]

    async def _stub_super(_admin, _session):
        # Creating a global role requires it; a site role does not care.
        return True

    original = routes._ensure_role
    original_super = routes._is_super_admin
    routes._ensure_role = _ensure
    routes._is_super_admin = _stub_super
    try:
        asyncio.run(
            create_admin_user(
                payload=_Payload(role_name),
                admin=AdminUser(id=1, email="a@b.co", name="A"),
                site=Site(id=7, name="Villa", slug="villa", domain=""),
                session=session,
            )
        )
    finally:
        routes._ensure_role = original
        routes._is_super_admin = original_super

    user = next(i for i in session.added if isinstance(i, AdminUser))
    link = next(i for i in session.added if isinstance(i, AdminUserSite))
    return user.role_id, link.role_id


def test_a_site_admin_gets_an_empty_global_role() -> None:
    global_id, site_id = _create("admin")
    assert global_id != site_id, (
        "the same Role row is in both slots again — editing the 'admin' role "
        "would change every site admin's network permissions"
    )
    assert site_id == 2, "the site slot should hold the requested 'admin' role"
    assert global_id == 4, f"the global slot should hold {SITE_MEMBER_ROLE}, got role id {global_id}"
    # And that row must grant nothing at all.
    assert _role_permissions(SITE_MEMBER_ROLE) == []


def test_an_editor_gets_the_same_treatment() -> None:
    global_id, site_id = _create("editor")
    assert global_id != site_id
    assert site_id == 3 and global_id == 4


def test_a_global_role_still_lands_in_the_global_slot() -> None:
    # A super-admin's global role IS their role; the site link gets "admin" so
    # the global permissions do not leak into a site context.
    global_id, site_id = _create("super_admin")
    assert global_id == 1, "a super-admin no longer holds their global role"
    assert site_id == 2, "the site link should be the plain 'admin' role"


# ── the roles screen ─────────────────────────────────────────────────────────

def _update_role(role, permissions, *, caller_role_id=9, is_super=False, own_site_roles=()):
    session = _Session(rows={(Role, role.id): role}, scalar_rows=list(own_site_roles))

    class _Body:
        def __init__(self, perms):
            self.permissions = perms

    async def _stub_super(_admin, _session):
        return is_super

    original = routes._is_super_admin
    routes._is_super_admin = _stub_super
    try:
        return asyncio.run(
            update_role_permissions(
                role_id=role.id,
                payload=_Body(permissions),
                admin=AdminUser(id=5, email="c@d.co", name="C", role_id=caller_role_id),
                session=session,
            )
        )
    finally:
        routes._is_super_admin = original


@pytest.mark.parametrize("role_name", sorted(SITE_ROLE_NAMES))
@pytest.mark.parametrize("permission", sorted(GLOBAL_PERMISSIONS))
def test_a_site_role_cannot_be_given_a_network_permission(role_name, permission) -> None:
    role = Role(id=2, name=role_name, permissions=_role_permissions(role_name))
    with pytest.raises(HTTPException) as exc:
        _update_role(role, ["cms:read", permission], is_super=True)
    assert exc.value.status_code == 422
    assert permission in exc.value.detail
    assert role.permissions == _role_permissions(role_name), "the role was modified before the refusal"


def test_site_permissions_on_a_site_role_are_still_fine() -> None:
    role = Role(id=2, name="admin", permissions=[])
    out = _update_role(role, ["cms:read", "cms:write"], is_super=True)
    assert out["permissions"] == ["cms:read", "cms:write"]


def test_a_custom_role_may_still_hold_network_permissions() -> None:
    # The guard is about the two roles every site user holds, not about making
    # network permissions unassignable — otherwise there would be no way to
    # delegate them at all.
    role = Role(id=8, name="network_ops", permissions=[])
    out = _update_role(role, ["sites:write"], is_super=True)
    assert out["permissions"] == ["sites:write"]


def test_you_cannot_edit_a_role_you_hold_globally() -> None:
    role = Role(id=9, name="network_ops", permissions=["roles:write"])
    with pytest.raises(HTTPException) as exc:
        _update_role(role, ["roles:write", "global_users:write"], caller_role_id=9)
    assert exc.value.status_code == 403


def test_you_cannot_edit_a_role_you_hold_on_a_site() -> None:
    role = Role(id=2, name="custom_site_role", permissions=["cms:read"])
    with pytest.raises(HTTPException) as exc:
        _update_role(role, ["cms:read", "cms:write"], caller_role_id=9, own_site_roles=[2])
    assert exc.value.status_code == 403


def test_a_super_admin_is_exempt_from_the_self_edit_rule() -> None:
    # They already hold "*", so there is nothing to escalate to.
    role = Role(id=9, name="network_ops", permissions=[])
    out = _update_role(role, ["sites:write"], caller_role_id=9, is_super=True)
    assert out["permissions"] == ["sites:write"]


# ── what /auth/me reports ────────────────────────────────────────────────────

def test_me_reports_only_what_require_permission_would_allow() -> None:
    """The reported permissions and the enforced ones are the same list.

    me() took the global role's permissions whole, but only the GLOBAL ones are
    honoured from that slot (require_permission step 4). While a site user's
    global slot held the "admin" row, /auth/me therefore reported a full set of
    site permissions for a site the user has no link to at all, and the admin UI
    drew menus for pages that then answered 403.
    """
    import inspect as _inspect

    from app.modules.auth.routes import me

    src = _inspect.getsource(me)
    assert "merged = {p for p in global_perms if p in GLOBAL_PERMISSIONS}" in src, (
        "me() merges the global role's permissions whole again"
    )
    assert "merged = set(global_perms)" not in src

    # The filter has to be the same list the enforcement uses — not a copy.
    from app.modules.admin.deps import _GLOBAL_PERMISSIONS
    assert _GLOBAL_PERMISSIONS is GLOBAL_PERMISSIONS, (
        "deps and auth are reading two different permission lists again"
    )


def test_the_permission_split_has_one_definition() -> None:
    # The whole point of moving it beside Role: admin.deps imports auth.routes,
    # so auth could not import back, and a second copy is how two code paths
    # come to disagree about a security boundary.
    from app.modules.auth import permissions as shared
    from app.modules.admin.deps import _GLOBAL_PERMISSIONS, _SITE_PERMISSIONS

    assert _GLOBAL_PERMISSIONS is shared.GLOBAL_PERMISSIONS
    assert _SITE_PERMISSIONS is shared.SITE_PERMISSIONS
    assert not (shared.GLOBAL_PERMISSIONS & shared.SITE_PERMISSIONS), (
        "a permission is in both sets, so which slot grants it is ambiguous"
    )
