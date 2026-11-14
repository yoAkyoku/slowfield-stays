"""Who may delete an administrator, and which accounts refuse to be deleted.

帳號管理 gained the 刪除 / 復原 / 永久刪除 trio every other list here already has.
The verb is the easy part; what the account is are the five ways it goes wrong,
and each one below is a separate refusal with a separate test:

1. **Only a super-admin.** `global_users:write` can be granted to any custom
   role from the roles screen, and 停用 — the neighbouring verb — accepts its
   holder. Deleting is the one action on this screen the person it is used on
   cannot undo, so it stays with the role that already holds everything.
2. **Never yourself.** `get_current_admin` refuses a deleted account, so the
   request after this one is the one that locks the door.
3. **Never the last super-admin.** Creating, restoring or promoting one is all
   super-admin work, so zero is a state the admin cannot climb back out of.
   `roleLabels` calls BOTH "super_admin" and "owner" 超級管理者, so a count that
   goes by name reads one of them as nobody.
4. **Not another site's account.** `admin_users` is one global table but a
   site-scoped caller only ever sees the accounts linked to the site they are
   in. 404 rather than 403, and checked BEFORE the permission — 403 would
   confirm that an account with that id exists somewhere on the network.
5. **A deleted account cannot get back in.** Not at the next login, and not
   with the token already in its browser.

Run against the real-database fixture. Most of these assert that NOTHING was
written, and a session that throws the statement away cannot show that: it
answers whatever the test told it to and reports a refusal that never happened.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import make_transient_to_detached

from app.modules.admin.routes import (
    AdminUserStatusUpdate,
    delete_admin_user,
    purge_admin_user,
    restore_admin_user,
    update_admin_user_status,
)
from app.modules.auth.models import AdminUser, LoginAudit, PasswordResetToken, Role
from app.modules.auth.routes import (
    forgot_password,
    get_current_admin,
    hash_reset_token,
    login,
    reset_password,
)
from app.modules.auth.schemas import ForgotPasswordRequest, LoginRequest, ResetPasswordRequest
from app.modules.auth.security import create_access_token, hash_password
from app.modules.sites.models import AdminUserSite, Site

from conftest import make

# ── the cast ────────────────────────────────────────────────────────────────
#
# Roles first, because every guard below is really a question about one.

SUPER_ROLE = 1       # "super_admin"  ["*"]
OWNER_ROLE = 2       # "owner"        ["*"]      — the same thing under another name
SITE_ADMIN_ROLE = 3  # "admin"        site permissions only
EDITOR_ROLE = 4      # "editor"
MEMBER_ROLE = 5      # "site_member"  []         — the empty global slot a site user holds
OPS_ROLE = 6         # a custom role carrying global_users:* but NOT "*"

SITE_A = make(Site, id=1, slug="slowfield", name="Slowfield Stays")
SITE_B = make(Site, id=2, slug="hejing", name="Hejing Villa")

ROOT = 1      # super_admin, on site A
OWNER = 2     # owner, on site A
SITE_A_ADMIN = 3
SITE_B_ADMIN = 4
SITE_A_EDITOR = 5
NETWORK_OPS = 6   # holds global_users:write — the caller the permission gate lets through
SITE_B_EDITOR = 7

PASSWORD = "correct-horse-battery"


def _seed(db_session) -> None:
    """Two sites, six roles, seven accounts — the shapes the guards distinguish."""
    db_session.add_all([
        make(Role, id=SUPER_ROLE, name="super_admin", permissions=["*"]),
        make(Role, id=OWNER_ROLE, name="owner", permissions=["*"]),
        make(Role, id=SITE_ADMIN_ROLE, name="admin", permissions=["cms:read", "cms:write", "site_users:read", "site_users:write"]),
        make(Role, id=EDITOR_ROLE, name="editor", permissions=["cms:read", "cms:write"]),
        make(Role, id=MEMBER_ROLE, name="site_member", permissions=[]),
        make(Role, id=OPS_ROLE, name="network_ops", permissions=["global_users:read", "global_users:write"]),
        make(Site, id=SITE_A.id, slug=SITE_A.slug, name=SITE_A.name),
        make(Site, id=SITE_B.id, slug=SITE_B.slug, name=SITE_B.name),
    ])
    for user_id, role_id, site_id, site_role in [
        (ROOT, SUPER_ROLE, SITE_A.id, SITE_ADMIN_ROLE),
        (OWNER, OWNER_ROLE, SITE_A.id, SITE_ADMIN_ROLE),
        (SITE_A_ADMIN, MEMBER_ROLE, SITE_A.id, SITE_ADMIN_ROLE),
        (SITE_B_ADMIN, MEMBER_ROLE, SITE_B.id, SITE_ADMIN_ROLE),
        (SITE_A_EDITOR, MEMBER_ROLE, SITE_A.id, EDITOR_ROLE),
        (NETWORK_OPS, OPS_ROLE, SITE_A.id, SITE_ADMIN_ROLE),
        (SITE_B_EDITOR, MEMBER_ROLE, SITE_B.id, EDITOR_ROLE),
    ]:
        db_session.add_all([
            make(
                AdminUser,
                id=user_id,
                email=f"u{user_id}@example.com",
                name=f"User {user_id}",
                password_hash="x",
                role_id=role_id,
                is_active=True,
                deleted_at=None,
                token_epoch=0,
            ),
            make(AdminUserSite, admin_user_id=user_id, site_id=site_id, role_id=site_role),
        ])
    asyncio.run(db_session.commit())


def _caller(db_session, user_id: int) -> AdminUser:
    """The signed-in account, as `get_current_admin` would have handed it over."""
    return asyncio.run(db_session.get(AdminUser, user_id))


def _row(db_session, user_id: int) -> AdminUser | None:
    """The account as the DATABASE holds it, not as the session remembers it."""
    db_session.sync.expire_all()
    return asyncio.run(
        db_session.execute(select(AdminUser).where(AdminUser.id == user_id))
    ).scalars().one_or_none()


# ── 1. only a super-admin ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("caller_id", "target_id", "site", "who"),
    [
        (SITE_A_ADMIN, SITE_A_EDITOR, SITE_A, "站點管理員 deleting an editor on their own site"),
        (SITE_A_EDITOR, SITE_A_ADMIN, SITE_A, "編輯者"),
        # The one the permission gate on the route lets through: a bespoke role
        # holding global_users:write, which the roles screen can hand out. It
        # passes require_permission and reaches the handler, so this refusal is
        # the only thing between it and deleting the owner.
        (NETWORK_OPS, SITE_A_EDITOR, SITE_A, "a custom role holding global_users:write"),
        (NETWORK_OPS, ROOT, SITE_A, "a custom role holding global_users:write, aimed at the super-admin"),
    ],
)
def test_only_a_super_admin_may_delete_an_account(db_session, caller_id, target_id, site, who) -> None:
    _seed(db_session)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(delete_admin_user(target_id, _caller(db_session, caller_id), site, db_session))

    assert raised.value.status_code == 403, who
    assert _row(db_session, target_id).deleted_at is None, f"{who}: the account was deleted anyway"


@pytest.mark.parametrize("verb", [restore_admin_user, purge_admin_user])
def test_restore_and_purge_are_super_admin_only_too(db_session, verb) -> None:
    """Or the rule is one third of a rule: 復原 puts an account back and
    永久刪除 removes the row outright."""
    _seed(db_session)
    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    with pytest.raises(HTTPException) as raised:
        asyncio.run(verb(SITE_A_EDITOR, _caller(db_session, NETWORK_OPS), SITE_A, db_session))

    assert raised.value.status_code == 403
    assert _row(db_session, SITE_A_EDITOR).deleted_at is not None, "the account left the bin"


def test_a_super_admin_may_delete(db_session) -> None:
    """The refusals have to be about who is asking, not about the verb."""
    _seed(db_session)

    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    assert _row(db_session, SITE_A_EDITOR).deleted_at is not None


def test_an_owner_may_delete_as_much_as_a_super_admin_may(db_session) -> None:
    """"owner" is 超級管理者 under its other name — `_is_super_admin` reads "*",
    so the caller's role NAME must not be what decides this either."""
    _seed(db_session)

    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, OWNER), SITE_A, db_session))

    assert _row(db_session, SITE_A_EDITOR).deleted_at is not None


# ── 2. never yourself ───────────────────────────────────────────────────────


@pytest.mark.parametrize("caller_id", [ROOT, OWNER])
def test_nobody_deletes_their_own_account(db_session, caller_id) -> None:
    """The account signs itself out on its very next request, and only the role
    it just removed could put it back. 停用 refuses the same move."""
    _seed(db_session)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(delete_admin_user(caller_id, _caller(db_session, caller_id), SITE_A, db_session))

    assert raised.value.status_code == 400
    assert _row(db_session, caller_id).deleted_at is None, "the caller deleted themselves"


# ── 3. never the last super-admin ───────────────────────────────────────────
#
# The caller in these four is built by hand rather than read out of the table,
# and that is the honest way to write them: with the self-delete refusal above
# in force, a super-admin pressing 刪除 is themselves an account that remains,
# so no sequence of clicks in today's admin can drive the count to zero. This
# refusal is the backstop under that one — the thing that still holds if the
# permission on the route is ever widened the way its 停用 neighbour already is,
# which is exactly the change that would remove the reason it cannot fire.


def _detached_super_admin(user_id: int = 99) -> AdminUser:
    """A signed-in super-admin with no row of their own in `admin_users`.

    `make_transient_to_detached` gives the instance the identity key that
    `inspect(admin).identity[0]` reads, which is all the handler wants from it.
    Every column the handler touches is spelled out: a detached instance treats
    an unset one as expired and tries to reload it, and with no session that
    raises instead of answering None.
    """
    admin = AdminUser(
        id=user_id,
        email=f"ghost{user_id}@example.com",
        name="Ghost",
        password_hash="x",
        role_id=SUPER_ROLE,
        is_active=True,
        deleted_at=None,
        token_epoch=0,
    )
    make_transient_to_detached(admin)
    return admin


def _only_super_admin_left(db_session, *, spare: str | None = None) -> None:
    """Seed a network whose single "*" account is ROOT.

    `spare` optionally adds a second one that must NOT count as cover:
    "archived" cannot sign in, "deleted" is already in the bin.
    """
    _seed(db_session)
    owner = asyncio.run(db_session.get(AdminUser, OWNER))
    if spare == "archived":
        owner.is_active = False
    elif spare == "deleted":
        owner.deleted_at = datetime.now(UTC)
    else:
        owner.role_id = SITE_ADMIN_ROLE  # demoted out of "*" entirely
    asyncio.run(db_session.commit())


@pytest.mark.parametrize(
    ("spare", "why"),
    [
        (None, "there is no other account carrying \"*\""),
        ("archived", "an archived super-admin cannot sign in, so it is not cover"),
        ("deleted", "a super-admin already in the bin is not cover"),
    ],
)
def test_the_last_super_admin_cannot_be_deleted(db_session, spare, why) -> None:
    _only_super_admin_left(db_session, spare=spare)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(delete_admin_user(ROOT, _detached_super_admin(), SITE_A, db_session))

    assert raised.value.status_code == 400, why
    assert _row(db_session, ROOT).deleted_at is None, f"the network was left unadministrable: {why}"


def test_an_owner_counts_as_another_super_admin(db_session) -> None:
    """The one a name-based count gets wrong, in the direction that matters.

    `roleLabels` maps "super_admin" AND "owner" to 超級管理者, and
    `update_role_permissions` forces "*" onto either — so a `WHERE name =
    'super_admin'` count reads the owner as nobody and refuses a deletion that
    is perfectly safe. The account is countable by its PERMISSION or not at all.
    """
    _seed(db_session)  # ROOT is "super_admin", OWNER is "owner", both hold "*"

    asyncio.run(delete_admin_user(ROOT, _detached_super_admin(), SITE_A, db_session))

    assert _row(db_session, ROOT).deleted_at is not None, (
        "the owner was not counted, so the last-super-admin guard fired on a network that has two"
    )


def test_a_bespoke_role_carrying_the_wildcard_counts_too(db_session) -> None:
    """Nothing says the two blessed names are the only roles that ever hold "*"."""
    _only_super_admin_left(db_session)
    db_session.add(make(Role, id=20, name="founder", permissions=["*"]))
    db_session.add(
        make(AdminUser, id=21, email="f@example.com", name="F", password_hash="x",
             role_id=20, is_active=True, deleted_at=None, token_epoch=0)
    )
    asyncio.run(db_session.commit())

    asyncio.run(delete_admin_user(ROOT, _detached_super_admin(), SITE_A, db_session))

    assert _row(db_session, ROOT).deleted_at is not None


# ── 4. not another site's account ───────────────────────────────────────────


def test_a_site_scoped_caller_cannot_reach_an_account_on_another_site(db_session) -> None:
    """404, and it is answered BEFORE the permission is looked at.

    403 here would tell a villa's admin that account #5 exists somewhere on the
    network — the sibling test below is the same caller against an account they
    CAN see, and the two statuses have to differ or this one is saying nothing.
    """
    _seed(db_session)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            delete_admin_user(SITE_A_EDITOR, _caller(db_session, SITE_B_ADMIN), SITE_B, db_session)
        )

    assert raised.value.status_code == 404
    assert _row(db_session, SITE_A_EDITOR).deleted_at is None


def test_the_same_caller_gets_403_for_an_account_that_is_theirs(db_session) -> None:
    _seed(db_session)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            delete_admin_user(SITE_B_EDITOR, _caller(db_session, SITE_B_ADMIN), SITE_B, db_session)
        )

    assert raised.value.status_code == 403, (
        "an account on the caller's own site answers 403 — if this is 404 too, the tenant check "
        "is refusing everything and proves nothing"
    )


def test_a_super_admin_is_not_confined_to_the_site_they_are_looking_at(db_session) -> None:
    """帳號管理 is a network-wide screen. Scoping the super-admin to the site in
    the switcher would make half its rows undeletable from the screen that
    lists them."""
    _seed(db_session)

    asyncio.run(delete_admin_user(SITE_B_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    assert _row(db_session, SITE_B_EDITOR).deleted_at is not None


def test_an_account_that_does_not_exist_is_404_for_a_super_admin_as_well(db_session) -> None:
    _seed(db_session)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(delete_admin_user(4242, _caller(db_session, ROOT), SITE_A, db_session))

    assert raised.value.status_code == 404


# ── 5. a deleted account cannot get back in ─────────────────────────────────


def _login_request(ip: str) -> Request:
    """A bare ASGI scope — enough for the rate limiter to key on, and a distinct
    address per test so one does not throttle the next."""
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": [],
        "query_string": b"",
        "client": (ip, 44321),
    })


def test_a_deleted_account_cannot_log_in(db_session) -> None:
    _seed(db_session)
    user = asyncio.run(db_session.get(AdminUser, SITE_A_EDITOR))
    user.password_hash = hash_password(PASSWORD)
    asyncio.run(db_session.commit())
    # The same credentials work first, or the assertion below proves nothing.
    asyncio.run(
        login(LoginRequest(email=user.email, password=PASSWORD), _login_request("203.0.113.11"), db_session)
    )

    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            login(LoginRequest(email=user.email, password=PASSWORD), _login_request("203.0.113.12"), db_session)
        )
    assert raised.value.status_code == 401


def test_a_token_at_the_current_epoch_is_still_refused_once_the_account_is_deleted(db_session) -> None:
    """The `deleted_at` check in `get_current_admin`, on its own.

    Deleting also bumps the token epoch, which would refuse any token minted
    BEFORE it — so a test using one of those would stay green with the
    deleted-account check removed. This one mints the token afterwards, at the
    account's own current epoch, which the epoch mechanism has no complaint
    about.
    """
    _seed(db_session)
    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))
    deleted = _row(db_session, SITE_A_EDITOR)
    fresh = create_access_token(str(deleted.id), deleted.token_epoch)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(get_current_admin(request=None, authorization=f"Bearer {fresh}", session=db_session))

    assert raised.value.status_code == 401


def test_a_session_open_at_the_moment_of_deletion_ends(db_session) -> None:
    _seed(db_session)
    live = _row(db_session, SITE_A_EDITOR)
    token = create_access_token(str(live.id), live.token_epoch)
    assert asyncio.run(get_current_admin(request=None, authorization=f"Bearer {token}", session=db_session)).id == SITE_A_EDITOR

    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    with pytest.raises(HTTPException):
        asyncio.run(get_current_admin(request=None, authorization=f"Bearer {token}", session=db_session))


def test_a_reset_link_mailed_before_the_delete_is_not_a_way_back_in(db_session) -> None:
    """The reset flow is a sign-in path, so it is a way in that has to close too.

    The token is a live, unused, unexpired one — everything the route asks for
    except the account still being there.
    """
    _seed(db_session)
    # Held in a local on purpose. SQLAlchemy's identity map is weak, and SQLite
    # hands a DateTime back without its tzinfo — so letting this row fall out of
    # memory and be re-read makes `expires_at < now` compare naive against aware
    # and raise before the check under test is reached. A fixture artifact:
    # Postgres `timestamptz` comes back aware.
    live_token = make(
        PasswordResetToken,
        admin_user_id=SITE_A_EDITOR,
        token_hash=hash_reset_token("a-live-token"),
        expires_at=datetime.now(UTC) + timedelta(minutes=20),
        used_at=None,
    )
    db_session.add(live_token)
    asyncio.run(db_session.commit())
    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            reset_password(
                ResetPasswordRequest(token="a-live-token", new_password=PASSWORD),
                _login_request("203.0.113.21"),
                db_session,
            )
        )

    assert raised.value.status_code == 400
    # Same wording as an expired token: the response must not report the
    # account's state to whoever is holding the link.
    assert raised.value.detail == "Invalid or expired reset token"


def test_a_deleted_account_gets_no_new_reset_link(db_session) -> None:
    """Answered exactly as an address that was never an administrator here —
    identical response, and no token minted — so this does not become a way to
    ask who used to have an account."""
    _seed(db_session)
    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    answer = asyncio.run(
        forgot_password(
            ForgotPasswordRequest(email="u5@example.com"), _login_request("203.0.113.22"), db_session
        )
    )

    assert answer.accepted is True
    assert answer.reset_url is None, "a reset link was minted for a deleted account"
    minted = asyncio.run(
        db_session.execute(select(PasswordResetToken).where(PasswordResetToken.admin_user_id == SITE_A_EDITOR))
    ).scalars().all()
    assert minted == []


def test_restoring_the_account_does_not_restore_its_old_sessions(db_session) -> None:
    """Why deleting bumps the epoch at all.

    `get_current_admin` refuses a deleted account outright, so the epoch is not
    what stops the token today. It is what stops 復原 from handing the token
    back: without the bump, every session that was open when the account was
    deleted resumes the moment it is restored — including whoever the account
    was deleted because of.
    """
    _seed(db_session)
    # Copied out as a plain int, not held as an attribute: `_row` expires the
    # session, so the same instance comes back and "before" would silently be
    # the value after.
    epoch_before = int(_row(db_session, SITE_A_EDITOR).token_epoch)
    old_token = create_access_token(str(SITE_A_EDITOR), epoch_before)

    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))
    asyncio.run(restore_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    restored = _row(db_session, SITE_A_EDITOR)
    assert restored.deleted_at is None, "復原 did not put the account back"
    assert restored.token_epoch > epoch_before
    with pytest.raises(HTTPException) as raised:
        asyncio.run(get_current_admin(request=None, authorization=f"Bearer {old_token}", session=db_session))
    assert raised.value.status_code == 401
    # And the restored account can sign in again, which is the point of 復原.
    restored.password_hash = hash_password(PASSWORD)
    asyncio.run(db_session.commit())
    asyncio.run(
        login(LoginRequest(email=restored.email, password=PASSWORD), _login_request("203.0.113.13"), db_session)
    )


# ── the bin behaves like every other bin ────────────────────────────────────


def test_a_deleted_account_refuses_a_status_change(db_session) -> None:
    """The rule test_status_verbs_reject_deleted_rows sets for the six content
    lists, applied to an account: 400, because the row exists and can be named
    — which is how 復原 still reaches it."""
    _seed(db_session)
    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            update_admin_user_status(
                SITE_A_EDITOR, AdminUserStatusUpdate(status="active"), _caller(db_session, ROOT), db_session
            )
        )

    assert raised.value.status_code == 400
    assert _row(db_session, SITE_A_EDITOR).deleted_at is not None, "the refused call emptied the bin"


def test_deleting_twice_is_refused(db_session) -> None:
    _seed(db_session)
    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))
    first = _row(db_session, SITE_A_EDITOR).deleted_at

    with pytest.raises(HTTPException) as raised:
        asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    assert raised.value.status_code == 400
    assert _row(db_session, SITE_A_EDITOR).deleted_at == first, "the second delete re-stamped the row"


def test_a_live_account_cannot_be_purged(db_session) -> None:
    """Deleting twice is what makes a deletion permanent — the rule
    test_purge_requires_bin holds for the other six lists."""
    _seed(db_session)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(purge_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    assert raised.value.status_code == 404
    assert _row(db_session, SITE_A_EDITOR) is not None, "a live account was destroyed by one press"


def test_purging_removes_the_row_and_what_hangs_off_it(db_session) -> None:
    """Three tables point at `admin_users` and none of them cascades.

    The sign-in history stays — it carries the email the attempt was made with,
    and removing an account must not erase the record of how it was used. The
    site links and any unused reset tokens go: their FKs are NOT NULL, so
    leaving either behind is a foreign-key violation rather than a tidy-up.
    """
    _seed(db_session)
    db_session.add_all([
        make(LoginAudit, admin_user_id=SITE_A_EDITOR, email="u5@example.com", success=True),
        make(
            PasswordResetToken,
            admin_user_id=SITE_A_EDITOR,
            token_hash="deadbeef",
            expires_at=datetime.now(UTC),
        ),
    ])
    asyncio.run(db_session.commit())
    asyncio.run(delete_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    asyncio.run(purge_admin_user(SITE_A_EDITOR, _caller(db_session, ROOT), SITE_A, db_session))

    assert _row(db_session, SITE_A_EDITOR) is None
    links = asyncio.run(
        db_session.execute(select(AdminUserSite).where(AdminUserSite.admin_user_id == SITE_A_EDITOR))
    ).scalars().all()
    assert links == []
    tokens = asyncio.run(
        db_session.execute(select(PasswordResetToken).where(PasswordResetToken.admin_user_id == SITE_A_EDITOR))
    ).scalars().all()
    assert tokens == []
    audits = asyncio.run(
        db_session.execute(select(LoginAudit).where(LoginAudit.email == "u5@example.com"))
    ).scalars().all()
    assert len(audits) == 1, "the sign-in history went with the account"
    assert audits[0].admin_user_id is None, "the audit row still points at an account that is gone"
