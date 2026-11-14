"""The role-slot migration, run against a real database.

This one changes who can do what across the whole network, so asserting on its
source would prove nothing. It runs on a throwaway SQLite database with the two
tables it touches, and the assertions are about the rows afterwards.

The claim being tested is that the migration is behaviour-preserving *today*:
the row it moves site-scoped users off contributes nothing to a global
permission check, so their access is identical before and after. What changes is
that a later edit to the "admin" role can no longer reach their global slot.
"""

import importlib.util
import json
from pathlib import Path

import pytest
import sqlalchemy as sa


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic" / "versions" / "202608300001_split_global_and_site_roles.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("role_slot_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _db(roles, users, links):
    engine = sa.create_engine("sqlite://")
    conn = engine.connect()
    conn.execute(sa.text("CREATE TABLE roles (id INTEGER PRIMARY KEY, name TEXT, permissions TEXT)"))
    conn.execute(sa.text("CREATE TABLE admin_users (id INTEGER PRIMARY KEY, email TEXT, role_id INTEGER)"))
    conn.execute(sa.text("CREATE TABLE admin_user_sites (admin_user_id INTEGER, site_id INTEGER, role_id INTEGER)"))
    for rid, name, perms in roles:
        conn.execute(
            sa.text("INSERT INTO roles (id, name, permissions) VALUES (:i, :n, :p)"),
            {"i": rid, "n": name, "p": json.dumps(perms)},
        )
    for uid, email, role_id in users:
        conn.execute(
            sa.text("INSERT INTO admin_users (id, email, role_id) VALUES (:i, :e, :r)"),
            {"i": uid, "e": email, "r": role_id},
        )
    for uid, site_id, role_id in links:
        conn.execute(
            sa.text("INSERT INTO admin_user_sites (admin_user_id, site_id, role_id) VALUES (:u, :s, :r)"),
            {"u": uid, "s": site_id, "r": role_id},
        )
    return conn


def _run(conn, direction="upgrade"):
    module = _load_migration()
    module.op = type("_Op", (), {"get_bind": staticmethod(lambda: conn)})()
    getattr(module, direction)()


ADMIN_PERMS = ["cms:read", "cms:write", "site_users:write"]
BASE_ROLES = [(1, "super_admin", ["*"]), (2, "admin", ADMIN_PERMS), (3, "editor", ["cms:read"])]


def _role_of(conn, user_id):
    return conn.execute(
        sa.text("SELECT role_id FROM admin_users WHERE id = :i"), {"i": user_id}
    ).scalar()


def test_a_site_admin_is_moved_off_the_shared_row() -> None:
    conn = _db(
        BASE_ROLES,
        users=[(10, "owner@x.co", 1), (11, "villa@x.co", 2), (12, "ed@x.co", 3)],
        links=[(11, 7, 2), (12, 7, 3)],
    )
    _run(conn)

    member_id = conn.execute(sa.text("SELECT id FROM roles WHERE name = 'site_member'")).scalar()
    assert member_id is not None, "the empty global role was not created"
    assert json.loads(
        conn.execute(sa.text("SELECT permissions FROM roles WHERE id = :i"), {"i": member_id}).scalar()
    ) == [], "site_member must grant nothing"

    assert _role_of(conn, 11) == member_id, "the villa admin still holds 'admin' globally"
    assert _role_of(conn, 12) == member_id, "the editor still holds 'editor' globally"
    # The super-admin is untouched — their global role is the point of them.
    assert _role_of(conn, 10) == 1, "the super-admin's global role was moved"

    # The site slot is what decides what they can do, and it is unchanged.
    site_roles = conn.execute(
        sa.text("SELECT admin_user_id, role_id FROM admin_user_sites ORDER BY admin_user_id")
    ).fetchall()
    assert [tuple(r) for r in site_roles] == [(11, 2), (12, 3)], "a site link was modified"
    # …and the roles themselves keep their permissions.
    assert json.loads(
        conn.execute(sa.text("SELECT permissions FROM roles WHERE id = 2")).scalar()
    ) == ADMIN_PERMS


def test_a_user_with_no_site_link_is_left_alone() -> None:
    # Someone whose only role is "admin" and who has no AdminUserSite row is not
    # a site-scoped user; moving them would change what they are.
    conn = _db(BASE_ROLES, users=[(20, "orphan@x.co", 2)], links=[])
    _run(conn)
    assert _role_of(conn, 20) == 2, "a user with no site link was moved anyway"


def test_it_refuses_when_a_site_role_already_holds_a_network_permission() -> None:
    """The one case a migration must not decide by itself.

    Dropping the grant would revoke something an operator is relying on; leaving
    it would carry the hole forward into the new arrangement. It stops and says
    what to do.
    """
    conn = _db(
        [(1, "super_admin", ["*"]), (2, "admin", ADMIN_PERMS + ["sites:write"]), (3, "editor", ["cms:read"])],
        users=[(11, "villa@x.co", 2)],
        links=[(11, 7, 2)],
    )
    with pytest.raises(RuntimeError) as exc:
        _run(conn)
    assert "sites:write" in str(exc.value)
    assert "admin" in str(exc.value)
    # Nothing was changed on the way to refusing.
    assert _role_of(conn, 11) == 2
    assert conn.execute(sa.text("SELECT id FROM roles WHERE name = 'site_member'")).scalar() is None


def test_running_it_twice_changes_nothing_further() -> None:
    conn = _db(BASE_ROLES, users=[(11, "villa@x.co", 2)], links=[(11, 7, 2)])
    _run(conn)
    first = _role_of(conn, 11)
    _run(conn)
    assert _role_of(conn, 11) == first, "a second run moved the user again"
    assert conn.execute(
        sa.text("SELECT COUNT(*) FROM roles WHERE name = 'site_member'")
    ).scalar() == 1, "a second site_member row was created"


def test_downgrade_restores_the_previous_arrangement() -> None:
    conn = _db(BASE_ROLES, users=[(11, "villa@x.co", 2)], links=[(11, 7, 2)])
    _run(conn)
    _run(conn, "downgrade")
    assert _role_of(conn, 11) == 2, "downgrade did not put the user back on 'admin'"
    assert conn.execute(sa.text("SELECT id FROM roles WHERE name = 'site_member'")).scalar() is None
