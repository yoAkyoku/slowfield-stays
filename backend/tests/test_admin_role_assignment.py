"""Which role a caller is allowed to hand to somebody else.

`POST /admin/users` blocked the two names it was afraid of — "super_admin" and
"owner" — and let every other name through. That is not the same as blocking
privilege: `_ensure_role` looks a role up **by name** and returns the row that
is already there, so a custom role built on the roles screen (which can be
given `roles:write`, `global_users:write`, anything short of "*") was
assignable by name. A delegated admin holding `global_users:write` could mint
an account into it, choose its password, and log in as something strictly more
powerful than themselves. The two sibling endpoints already worked from an
allow-list; this one was the gap between them.

The second test here records a decision rather than a fix: `PATCH
/admin/users/{id}/role` answers 404 for an id nobody holds and 200 for one that
exists, which tells a `site_users:write` holder which admin ids are real. It
stays that way — see the comment at the 404 — so what is pinned instead is the
pair of properties that make it tolerable: the answer carries nothing about the
user, and the caller still cannot aim it at themselves.
"""

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import make_transient_to_detached

from app.modules.admin.routes import (
    AdminUserCreate,
    AdminUserRoleUpdate,
    create_admin_user,
    update_admin_user_role,
)
from app.modules.auth.models import AdminUser, Role
from app.modules.sites.models import Site

_UNSET = object()


class _Result:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    """Enough AsyncSession surface for the two handlers under test.

    `execute` refuses by default: every query in `create_admin_user` happens
    after the role gate, so a test that expects a rejection and sees a query
    instead has caught the gate falling through.
    """

    def __init__(self, roles=None, users=None, execute_result=_UNSET):
        self.roles = roles or {}
        self.users = users or {}
        self.execute_result = execute_result
        self.added = []
        self.deleted = []
        self.committed = False

    async def get(self, model, item_id):
        if model is Role:
            return self.roles.get(item_id)
        if model is AdminUser:
            return self.users.get(item_id)
        return None

    async def execute(self, statement):
        if self.execute_result is _UNSET:
            raise AssertionError("the role gate should have rejected before any query ran")
        return _Result(self.execute_result)

    def add(self, item):
        self.added.append(item)

    async def delete(self, item):
        self.deleted.append(item)

    async def commit(self):
        self.committed = True


def _caller(user_id: int, role_id: int) -> AdminUser:
    # `deleted_at` spelled out because of the line below: a detached instance
    # treats an unset column as expired and tries to reload it, which with no
    # session is a DetachedInstanceError rather than the None it holds. Every
    # column a handler reads has to be given a value here.
    admin = AdminUser(
        id=user_id, email="ops@example.com", name="Ops", password_hash="x", role_id=role_id, deleted_at=None
    )
    # Gives the instance an identity key, which is what `inspect(admin).identity[0]`
    # reads. No session involved, so the handlers stay unit-testable.
    make_transient_to_detached(admin)
    return admin


def _site() -> Site:
    return Site(id=1, name="Slowfield Stays", slug="slowfield", domain="localhost")


def _new_user(role: str) -> AdminUserCreate:
    return AdminUserCreate(name="Mallory", email="mallory@example.com", password="hunter2hunter2", role=role)


def test_a_delegated_admin_cannot_mint_a_user_into_an_arbitrary_role() -> None:
    # The role an operator built for their own ops team, carrying everything
    # except the "*" the roles screen refuses to write.
    delegated = Role(id=7, name="network_ops", permissions=["global_users:write", "roles:write", "sites:write"])
    session = _FakeSession(roles={7: delegated})

    with pytest.raises(HTTPException) as raised:
        asyncio.run(create_admin_user(_new_user("network_ops"), _caller(4, 7), _site(), session))

    assert raised.value.status_code == 422
    assert "admin" in raised.value.detail and "editor" in raised.value.detail
    assert session.added == [], "no account may be created for a role the caller cannot assign"
    assert not session.committed


def test_a_delegated_admin_still_gets_the_global_role_refusal_it_always_got() -> None:
    delegated = Role(id=7, name="network_ops", permissions=["global_users:write"])
    session = _FakeSession(roles={7: delegated})

    with pytest.raises(HTTPException) as raised:
        asyncio.run(create_admin_user(_new_user("super_admin"), _caller(4, 7), _site(), session))

    assert raised.value.status_code == 403
    assert session.added == []


def test_the_site_roles_a_delegated_admin_is_meant_to_hand_out_still_go_through() -> None:
    delegated = Role(id=7, name="network_ops", permissions=["global_users:write"])
    # Getting as far as the duplicate-email check is the proof the gate passed;
    # the rest of the handler needs a database and is not what is under test.
    taken = AdminUser(id=9, email="mallory@example.com", name="Mallory", password_hash="x", role_id=3)
    session = _FakeSession(roles={7: delegated}, execute_result=taken)

    for role in ("admin", "editor"):
        with pytest.raises(HTTPException) as raised:
            asyncio.run(create_admin_user(_new_user(role), _caller(4, 7), _site(), session))
        assert raised.value.status_code == 409, f"{role} must not be blocked by the role gate"


def test_a_super_admin_keeps_the_wider_role_set() -> None:
    root = Role(id=1, name="super_admin", permissions=["*"])
    taken = AdminUser(id=9, email="mallory@example.com", name="Mallory", password_hash="x", role_id=3)
    session = _FakeSession(roles={1: root}, execute_result=taken)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(create_admin_user(_new_user("network_ops"), _caller(1, 1), _site(), session))

    assert raised.value.status_code == 409, "the gate must not narrow what a super-admin may assign"


def test_the_user_id_oracle_stays_an_oracle_and_nothing_more() -> None:
    caller = _caller(4, 7)
    session = _FakeSession(users={4: caller})

    with pytest.raises(HTTPException) as unknown:
        asyncio.run(update_admin_user_role(9999, AdminUserRoleUpdate(role="admin"), caller, _site(), session))
    assert unknown.value.status_code == 404
    # The accepted part of the leak is the status alone. If a name, email or
    # role ever reaches this body, the trade recorded at the 404 no longer holds.
    assert unknown.value.detail == "Admin user not found"

    with pytest.raises(HTTPException) as self_edit:
        asyncio.run(update_admin_user_role(4, AdminUserRoleUpdate(role="admin"), caller, _site(), session))
    assert self_edit.value.status_code == 422

    assert session.added == []
    assert not session.committed


def test_site_member_removes_the_current_site_assignment() -> None:
    caller = _caller(4, 7)
    target = _caller(5, 5)
    existing_link = object()
    session = _FakeSession(users={5: target}, execute_result=existing_link)

    result = asyncio.run(
        update_admin_user_role(5, AdminUserRoleUpdate(role="site_member"), caller, _site(), session)
    )

    assert result["site_role"] == "site_member"
    assert session.deleted == [existing_link]
    assert session.added == []
    assert session.committed
