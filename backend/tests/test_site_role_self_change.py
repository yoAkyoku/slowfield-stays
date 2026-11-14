"""Whether an admin may change their own role on a site.

Removing your own access was already refused. Demoting yourself was not, and it
arrives at the same place: only a site admin can reach this endpoint at all
(site_users:write), so the one self-change available to them is admin → editor
— which drops that permission and leaves nobody who can put it back. The guard
that exists for removal has to cover the step that achieves removal in two
moves.

A super-admin is exempt on purpose: their access comes from the global "*"
role, not from the AdminUserSite row, so editing their own link changes nothing
about what they can do.
"""

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import make_transient_to_detached

from app.modules.admin.routes import SiteUserRoleUpdate, update_site_user_role
from app.modules.auth.models import AdminUser, Role
from app.modules.sites.models import AdminUserSite, Site

SITE = Site(id=1, name="Villa", slug="villa", domain="")
SITE_ADMIN = Role(id=2, name="admin", permissions=["site_users:read", "site_users:write"])
SUPER = Role(id=1, name="super_admin", permissions=["*"])
EDITOR = Role(id=3, name="editor", permissions=["cms:read"])


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    """Enough surface to reach the guard. `commit` records that a write landed."""

    def __init__(self, caller_role: Role, link=None):
        self.caller_role = caller_role
        self.link = link
        self.committed = False
        self.deleted = []

    async def get(self, model, item_id):
        if model is Site:
            return SITE if item_id == SITE.id else None
        if model is AdminUser:
            return _user(item_id, self.caller_role.id)
        if model is Role:
            return self.caller_role
        return None

    async def execute(self, statement):
        # _ensure_role looks a Role up by name; every other query here is
        # after the AdminUserSite link. Both allowed paths in this file assign
        # "editor", so one row answers it.
        if "FROM roles" in str(statement):
            return _Result(EDITOR)
        return _Result(self.link)

    def add(self, item):
        pass

    async def flush(self):
        pass

    async def delete(self, item):
        self.deleted.append(item)

    async def commit(self):
        self.committed = True


def _link(user_id: int, role: Role) -> AdminUserSite:
    """`_site_role` reads link.role, the loaded relationship — not role_id."""
    link = AdminUserSite(admin_user_id=user_id, site_id=1, role_id=role.id)
    link.role = role
    return link


def _user(user_id: int, role_id: int) -> AdminUser:
    # `deleted_at` spelled out: `make_transient_to_detached` below leaves every
    # unset column expired, and reading one with no session raises rather than
    # answering None. The handler asks whether this account is in 已刪除.
    user = AdminUser(
        id=user_id, email=f"u{user_id}@example.com", name="U", password_hash="x", role_id=role_id, deleted_at=None
    )
    make_transient_to_detached(user)
    return user


def _run(caller: AdminUser, target_id: int, role: str | None, session: _FakeSession):
    return asyncio.run(
        update_site_user_role(SITE.id, target_id, SiteUserRoleUpdate(role=role), caller, session)
    )


def test_a_site_admin_cannot_demote_themselves() -> None:
    caller = _user(7, SITE_ADMIN.id)
    session = _FakeSession(SITE_ADMIN, link=_link(7, SITE_ADMIN))

    with pytest.raises(HTTPException) as raised:
        _run(caller, 7, "editor", session)

    assert raised.value.status_code == 422
    assert not session.committed, "nothing may be written on the refused path"


def test_a_site_admin_cannot_remove_their_own_access() -> None:
    """The guard that already existed, still in force."""
    caller = _user(7, SITE_ADMIN.id)
    session = _FakeSession(SITE_ADMIN, link=_link(7, SITE_ADMIN))

    with pytest.raises(HTTPException) as raised:
        _run(caller, 7, None, session)

    assert raised.value.status_code == 422
    assert session.deleted == []


def test_a_site_admin_may_still_change_somebody_else() -> None:
    caller = _user(7, SITE_ADMIN.id)
    session = _FakeSession(SITE_ADMIN, link=_link(9, SITE_ADMIN))

    result = _run(caller, 9, "editor", session)

    assert result["site_role"] == "editor"
    assert session.committed


def test_a_super_admin_may_edit_their_own_link() -> None:
    """Exempt: their access is global, so this row does not gate anything."""
    caller = _user(1, SUPER.id)
    session = _FakeSession(SUPER, link=_link(1, SUPER))

    result = _run(caller, 1, "editor", session)

    assert result["site_role"] == "editor"
    assert session.committed
