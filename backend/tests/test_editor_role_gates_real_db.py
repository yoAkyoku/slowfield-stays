"""What an 編輯者 may and may not do, against the real permission gate.

The client asked for a non-super-admin account to be exercised. The account is
theirs to create and sign in to; what can be pinned without a session is the
thing that decides every one of those requests — `require_permission`, called
with a real Editor's real permission set.

The existing authorization tests run against a fake session that answers with
whatever the test queued, so a refusal they report is one the database never
performed. These use the real-database fixture: the role, the account and the
site link are rows, and the gate loads them the way a request does.

Editor's permissions are the eight the roles screen shows on the live site:
stays and CMS and media read+write, inquiries and newsletter READ only. The
last two are the interesting ones — 表單聯絡 and 電子報 are both visible to an
Editor and neither is actionable, so "can open the screen" and "can press the
button" have to come apart. Sending a newsletter is irreversible and goes to
real subscribers; filing an enquiry is what the inbox is for.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException, Request

from app.modules.admin.deps import require_permission
from app.modules.auth.models import AdminUser, Role
from app.modules.sites.models import AdminUserSite, Site

from conftest import make

SITE = make(Site, id=1, slug="slowfield", name="Slowfield Stays")

# Exactly what 角色 shows for 編輯者 on the live site.
EDITOR_PERMISSIONS = [
    "stays:read", "stays:write",
    "cms:read", "cms:write",
    "media:read", "media:write",
    "inquiries:read",
    "newsletter:read",
]

EDITOR_ROLE_ID = 3
EDITOR_ID = 21


def _seed(db_session):
    """An Editor on one site, exactly as the admin creates one."""
    site = make(Site, id=1, slug="slowfield", name="Slowfield Stays")
    role = make(Role, id=EDITOR_ROLE_ID, name="editor", permissions=list(EDITOR_PERMISSIONS))
    # `role_id` is not nullable, so every account carries a GLOBAL role as well
    # as its per-site one. For somebody who only works inside a site that global
    # role is the empty one — which is what `site_member` is: it holds no
    # permissions because the permissions live on the site link beside it.
    member = make(Role, id=9, name="site_member", permissions=[])
    user = make(
        AdminUser,
        id=EDITOR_ID,
        email="editor@example.com",
        name="Editor",
        password_hash="x",
        is_active=True,
        role_id=9,
        deleted_at=None,
    )
    link = make(AdminUserSite, admin_user_id=EDITOR_ID, site_id=1, role_id=EDITOR_ROLE_ID)
    db_session.add_all([site, role, member, user, link])
    asyncio.run(db_session.commit())
    return user


def _request() -> Request:
    return Request({
        "type": "http", "method": "GET", "path": "/api/v1/admin/x",
        "headers": [(b"x-site-slug", b"slowfield")],
        "query_string": b"", "client": ("203.0.113.60", 44321),
    })


def _check(db_session, user, permission: str):
    """Run the real gate. Returns None on pass, raises HTTPException on refusal."""
    return asyncio.run(
        require_permission(permission)(
            _request(), admin=user, session=db_session, site="slowfield", x_site_slug="slowfield"
        )
    )


# ── what an Editor is for ───────────────────────────────────────────────────


@pytest.mark.parametrize("permission", ["cms:read", "cms:write", "stays:read", "stays:write", "media:read", "media:write"])
def test_an_editor_may_do_the_editing(db_session, permission) -> None:
    """The allow half. Without it a gate that refused everything would pass
    every refusal test below and be completely broken."""
    user = _seed(db_session)
    assert _check(db_session, user, permission) is not None


@pytest.mark.parametrize("permission", ["inquiries:read", "newsletter:read"])
def test_an_editor_may_look_at_the_inbox_and_the_newsletter(db_session, permission) -> None:
    user = _seed(db_session)
    assert _check(db_session, user, permission) is not None


# ── and what it is not ──────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "permission,why",
    [
        ("inquiries:write", "filing or replying to an enquiry"),
        ("newsletter:write", "sending a newsletter to real subscribers"),
        ("site_users:write", "adding or removing people on this site"),
        ("global_users:write", "creating or deleting admin accounts"),
        ("roles:write", "granting itself anything it likes"),
        ("sites:write", "creating or deleting a site"),
        ("*", "everything"),
    ],
)
def test_an_editor_is_refused(db_session, permission, why) -> None:
    user = _seed(db_session)
    with pytest.raises(HTTPException) as raised:
        _check(db_session, user, permission)
    assert raised.value.status_code == 403, f"an Editor got as far as {why}"


def test_read_does_not_imply_write(db_session) -> None:
    """The pair that matters most, asserted together so a gate that granted
    write alongside read could not pass one test by failing the other."""
    user = _seed(db_session)
    assert _check(db_session, user, "newsletter:read") is not None
    with pytest.raises(HTTPException):
        _check(db_session, user, "newsletter:write")
    assert _check(db_session, user, "inquiries:read") is not None
    with pytest.raises(HTTPException):
        _check(db_session, user, "inquiries:write")


def test_an_editor_has_no_reach_into_another_site(db_session) -> None:
    """Its permissions live on the site LINK, so they must not travel."""
    user = _seed(db_session)
    other = make(Site, id=2, slug="hejing", name="Hejing Villa")
    db_session.add(other)
    asyncio.run(db_session.commit())

    with pytest.raises(HTTPException):
        asyncio.run(
            require_permission("cms:write")(
                _request(), admin=user, session=db_session, site="hejing", x_site_slug="hejing"
            )
        )


def test_the_gate_can_only_be_reached_through_authentication(db_session) -> None:
    """Where the deleted-account refusal actually lives.

    An earlier version of this test set `deleted_at` and called the gate
    directly, expecting a refusal. It did not get one — and the gate is right:
    it never sees an unauthenticated caller, because `admin` arrives from
    `get_current_admin`, which is where a deleted account and a stale token
    epoch are both turned away (four tests in
    test_admin_user_deletion_guards.py cover that, including a token already in
    somebody's browser).

    So what is pinned here is the wiring rather than the behaviour: the gate
    takes its admin from that dependency and from nothing else. Swapping it for
    a parameter the request could supply would let a deleted account back in
    without a single permission test noticing.
    """
    import inspect as _inspect

    dependency = require_permission("cms:write")
    admin_param = _inspect.signature(dependency).parameters["admin"]
    assert admin_param.default is not _inspect.Parameter.empty, (
        "require_permission's admin no longer has a dependency — it would take whatever the caller passed"
    )
    assert "get_current_admin" in repr(admin_param.default), (
        "require_permission no longer resolves its admin through get_current_admin, "
        "which is the only thing refusing a deleted account or a revoked token"
    )
