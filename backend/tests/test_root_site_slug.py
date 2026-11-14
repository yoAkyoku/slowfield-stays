"""The root site's slug is an invariant, not a free-text field.

`ensure_default_site` finds the default site by the literal slug
"slowfield" and, failing to find it, creates it. `delete_site` already
refuses to remove the root row so that branch stays dead — but nothing stopped
`update_site` from *renaming* it, which reaches the same branch by another
door: the insert then collides with the still-present row on the domain unique
key, so every request whose host matches no site answers 500. The frontend has
the same literal as its own fallback slug, so its admin went blank at the same
moment.
"""

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import make_transient_to_detached

from app.modules.admin.routes import SiteUpdate, update_site
from app.modules.auth.models import AdminUser, Role
from app.modules.sites.context import DEFAULT_SITE_SLUG
from app.modules.sites.models import Site


class _FakeSession:
    """Enough surface to reach the guard, and no further.

    `execute` refuses: every query in `update_site` runs after the guard, so a
    test that expects a rejection and sees a query instead has caught the guard
    falling through.
    """

    def __init__(self, site: Site, role: Role):
        self.site = site
        self.role = role
        self.flushed = False
        self.committed = False

    async def get(self, model, item_id):
        if model is Site:
            return self.site if item_id == self.site.id else None
        if model is Role:
            return self.role
        return None

    async def execute(self, statement):
        raise AssertionError("the root-slug guard should have rejected before any query ran")

    async def flush(self):
        self.flushed = True

    async def commit(self):
        self.committed = True


def _super_admin() -> AdminUser:
    admin = AdminUser(id=1, email="root@example.com", name="Root", password_hash="x", role_id=1)
    make_transient_to_detached(admin)
    return admin


def _root_site() -> Site:
    return Site(id=1, name="Slowfield Stays", slug=DEFAULT_SITE_SLUG, domain="localhost", status="active")


def _payload(slug: str, **over) -> SiteUpdate:
    return SiteUpdate(name="Slowfield Stays", slug=slug, domain="localhost", **over)


def _run(site: Site, payload: SiteUpdate, session: _FakeSession):
    return asyncio.run(update_site(site.id, payload, _super_admin(), session))


def test_a_super_admin_cannot_rename_the_root_site() -> None:
    site = _root_site()
    session = _FakeSession(site, Role(id=1, name="super_admin", permissions=["*"]))

    with pytest.raises(HTTPException) as raised:
        _run(site, _payload("renamed-root"), session)

    assert raised.value.status_code == 400
    assert site.slug == DEFAULT_SITE_SLUG, "the in-memory row must be left untouched too"
    assert not session.flushed and not session.committed


def test_saving_the_root_site_without_touching_its_slug_still_works() -> None:
    """The guard keys on a *change*, so an ordinary save must pass through it.

    Without this, the fix would turn every edit of the root site — colours,
    contact details, SEO — into a 400.
    """
    site = _root_site()
    session = _FakeSession(site, Role(id=1, name="super_admin", permissions=["*"]))

    # Reaching the duplicate-check query is the proof the guard let it past;
    # _FakeSession raises there rather than exercising the rest of the handler.
    with pytest.raises(AssertionError, match="before any query ran"):
        _run(site, _payload(DEFAULT_SITE_SLUG, primary_color="#123456"), session)


def test_a_child_site_may_still_be_renamed() -> None:
    """Only the root slug is pinned; villas get renamed all the time."""
    child = Site(id=2, name="Hejing Villa", slug="hejing", domain="", status="active", parent_site_id=1)
    session = _FakeSession(child, Role(id=1, name="super_admin", permissions=["*"]))

    with pytest.raises(AssertionError, match="before any query ran"):
        _run(child, SiteUpdate(name="Hejing Villa", slug="hejing-2", domain=""), session)
