"""When the public banner list falls back to the seeded demo banners.

The fallback exists for one case: the database will not answer, and a homepage
with stock slides beats an error page. A site whose banners are simply all
retired is not that case. Serving the demo set there put somebody else's
pictures on a real brand's homepage, with a 200, and nothing in the admin said
where they came from.
"""

import asyncio

import pytest
from sqlalchemy.exc import OperationalError

from app.modules.cms import routes as cms_routes
from app.modules.cms.seed import PUBLIC_BANNERS


class _Site:
    id = 1
    slug = "slowfield"
    parent_site_id = None


class _Request:
    headers: dict[str, str] = {}


class _Result:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _FakeSession:
    def __init__(self, rows, *, fail=None):
        self.rows = rows
        self.fail = fail

    async def execute(self, statement):
        if self.fail is not None:
            raise self.fail
        return _Result(self.rows)


@pytest.fixture(autouse=True)
def _site_resolved(monkeypatch):
    async def _resolve(session, host=None, site_slug=None):
        return _Site()

    monkeypatch.setattr(cms_routes, "resolve_site", _resolve)


def _list(session):
    return asyncio.run(cms_routes.list_banners(_Request(), site=None, session=session))


def test_a_site_with_no_banners_gets_none() -> None:
    assert _list(_FakeSession([])) == []


def test_the_demo_banners_cover_only_a_database_that_cannot_answer() -> None:
    down = _FakeSession([], fail=OperationalError("select", {}, Exception("db down")))
    assert _list(down) == PUBLIC_BANNERS
