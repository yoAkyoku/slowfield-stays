"""Whose logins the dashboard's 近期登入 metric counts.

The metric scoped itself to admins holding an AdminUserSite row for the site.
Super-admins deliberately have none — `_site_role` grants them access from
their global "*" role instead — so the one account most worth watching was the
one excluded, and on a site administered only by super-admins (a fresh install)
the number read 0 however much the audit table filled up.

The first attempt at the fix expressed "role has *" as `Role.permissions
.contains(["*"])`. permissions is a plain JSON column, so that compiled to LIKE
and Postgres refused it. The dashboard wraps its queries in a broad `except`
that answers 0 for every metric, so a hard SQL error still came back as HTTP
200 with a plausible-looking zero. Hence the Python-side match, and hence this
test running against real model instances rather than a mocked query.
"""

import asyncio

from app.modules.admin.routes import _dashboard_login_user_ids
from app.modules.auth.models import AdminUser, Role
from app.modules.sites.models import Site


class _Result:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return self

    def all(self):
        return self._values


class _FakeSession:
    """Answers each of the helper's three queries by the entity it selects."""

    def __init__(self, links, roles, users):
        self.links = links
        self.roles = roles
        self.users = users
        self.queries = 0

    async def execute(self, statement):
        self.queries += 1
        target = str(statement).lower()
        if "admin_user_sites" in target:
            return _Result(self.links)
        if "from roles" in target:
            return _Result(self.roles)
        return _Result([u.id for u in self.users if u.role_id in self._wildcard_ids()])

    def _wildcard_ids(self):
        return {r.id for r in self.roles if "*" in (r.permissions or [])}


SUPER = Role(id=1, name="super_admin", permissions=["*"])
EDITOR = Role(id=3, name="editor", permissions=["stays:read"])
SITE = Site(id=1, name="Slowfield Stays", slug="slowfield", domain="localhost")


def _run(links, roles, users):
    return asyncio.run(_dashboard_login_user_ids(_FakeSession(links, roles, users), SITE))


def test_a_super_admin_counts_even_with_no_site_link() -> None:
    root = AdminUser(id=1, email="root@example.com", name="Root", password_hash="x", role_id=1)

    assert _run([], [SUPER, EDITOR], [root]) == {1}


def test_linked_admins_still_count() -> None:
    editor = AdminUser(id=2, email="ed@example.com", name="Ed", password_hash="x", role_id=3)

    assert _run([2], [SUPER, EDITOR], [editor]) == {2}


def test_both_are_counted_once() -> None:
    root = AdminUser(id=1, email="root@example.com", name="Root", password_hash="x", role_id=1)
    editor = AdminUser(id=2, email="ed@example.com", name="Ed", password_hash="x", role_id=3)

    assert _run([2], [SUPER, EDITOR], [root, editor]) == {1, 2}


def test_no_wildcard_role_means_no_extra_query() -> None:
    """With nothing to look up, the third query is skipped rather than run empty."""
    session = _FakeSession([2], [EDITOR], [])
    ids = asyncio.run(_dashboard_login_user_ids(session, SITE))

    assert ids == {2}
    assert session.queries == 2
