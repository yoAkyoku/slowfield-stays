"""What PATCH /admin/roles/{id}/permissions accepts.

Two different things were being dropped by one filter. Stripping "*" is policy:
`roles:write` is a site-admin grade permission, and letting its holder write a
wildcard onto any role would promote them past every check in the module. But
an unrecognised *name* is a mistake, and it fell through the same silent path —
the call returned 200 having quietly narrowed the role to whatever survived, so
one typo in an integration could remove permissions nobody meant to touch.
"""

import asyncio

import pytest
from fastapi import HTTPException

from app.modules.admin.routes import RolePermissionsUpdate, update_role_permissions
from app.modules.auth.models import AdminUser, Role


class _FakeSession:
    def __init__(self, role):
        self.role = role
        self.committed = False

    async def get(self, model, item_id):
        return self.role if item_id == self.role.id else None

    async def commit(self):
        self.committed = True



# update_role_permissions gained an `admin` parameter so it can refuse an edit to
# the caller's own role (a `roles:write` holder could otherwise grant themselves
# global_users:write). These tests are about the permission *values*, not about
# who is editing, so the caller is a super-admin — exempt from that rule because
# they already hold "*".
def _as_super_admin(call):
    import app.modules.admin.routes as routes

    async def _stub(_admin, _session):
        return True

    original = routes._is_super_admin
    routes._is_super_admin = _stub
    try:
        return call()
    finally:
        routes._is_super_admin = original


def _patch(role, permissions):
    session = _FakeSession(role)
    result = _as_super_admin(lambda: asyncio.run(
        update_role_permissions(
            role_id=role.id,
            payload=RolePermissionsUpdate(permissions=permissions),
            admin=AdminUser(id=1, email="a@b.co", name="A", role_id=99),
            session=session,
        )
    ))
    return result, session


def _editor() -> Role:
    return Role(id=3, name="editor", permissions=["stays:read", "cms:read"])


def test_an_unknown_permission_is_refused_not_dropped() -> None:
    role = _editor()

    with pytest.raises(HTTPException) as raised:
        _patch(role, ["stays:read", "not_a_real:permission"])

    assert raised.value.status_code == 422
    assert "not_a_real:permission" in raised.value.detail
    assert role.permissions == ["stays:read", "cms:read"], "the role must be left exactly as it was"


def test_the_wildcard_is_still_stripped_silently() -> None:
    """Policy, not a typo: refusing it would be a worse answer than ignoring it."""
    role = _editor()

    result, session = _patch(role, ["stays:read", "*"])

    assert result["permissions"] == ["stays:read"]
    assert session.committed


def test_a_valid_set_is_written_through() -> None:
    role = _editor()

    result, _ = _patch(role, ["stays:read", "stays:write", "cms:read"])

    assert result["permissions"] == ["stays:read", "stays:write", "cms:read"]


def test_duplicates_collapse() -> None:
    role = _editor()

    result, _ = _patch(role, ["stays:read", "stays:read"])

    assert result["permissions"] == ["stays:read"]
