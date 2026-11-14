"""What the public CMS listing does when one row will not serialise.

The listing has a deliberate degraded mode: if the database will not answer, it
serves the two seeded demo pages rather than an error page. What it must not do
is enter that mode for any other reason, because it is invisible — a 200 with
somebody else's content in it.
"""

import logging

import pytest
from sqlalchemy.exc import OperationalError

from app.modules.cms import routes as cms_routes
from app.modules.cms.models import Page
from app.modules.cms.seed import PUBLIC_PAGES

_DEMO_SLUGS = {page.slug for page in PUBLIC_PAGES.values()}


class _Site:
    id = 1
    slug = "hejing"
    parent_site_id = None


class _Request:
    headers: dict[str, str] = {}


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _ExecuteResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return _ScalarResult(self._items)

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None


class _FakeSession:
    """Answers every select with the same rows, and records the statements."""

    def __init__(self, rows, *, fail=None):
        self.rows = rows
        self.fail = fail
        self.statements: list[object] = []

    async def execute(self, statement):
        self.statements.append(statement)
        if self.fail is not None:
            raise self.fail
        return _ExecuteResult(self.rows)


def _page(**overrides) -> Page:
    values = {
        "id": 1,
        "site_id": 1,
        "slug": "one",
        "title": "One",
        "summary": "",
        "body": "Body",
        "body_blocks": [],
        "content_type": "journal",
        "layout": "page",
        "cover_image_url": "",
        "sort_order": 0,
        "tags": [],
        "related_stay_ids": [],
        "status": "published",
        "seo": {},
        "translations": {},
        "published_at": None,
    }
    values.update(overrides)
    return Page(**values)


@pytest.fixture(autouse=True)
def _site_resolved(monkeypatch):
    async def _resolve(session, host=None, site_slug=None):
        return _Site()

    monkeypatch.setattr(cms_routes, "resolve_site", _resolve)


async def _list(session, **kwargs):
    params = {"content_type": None, "site": None, "stay": None, "ids": None}
    params.update(kwargs)
    return await cms_routes.list_pages(_Request(), session=session, **params)


async def test_a_malformed_seo_blob_does_not_collapse_the_public_page_list(caplog) -> None:
    """One unreadable row must cost one row, not the whole site's content.

    PageAdminUpsert.seo is a loose dict and PageRead.seo is a strict SeoMeta, so
    `{"title": 123}` saves through the admin and then cannot be read back. With
    the serialisation inside the query's try, that single row aborted the listing
    and every visitor got the two seeded demo pages behind a 200.
    """
    good = _page(id=2, slug="good", title="Good")
    bad = _page(id=3, slug="bad", title="Bad", seo={"title": 123})
    session = _FakeSession([bad, good])

    with caplog.at_level(logging.ERROR):
        rows = await _list(session)

    slugs = [row.slug for row in rows]
    assert "good" in slugs, "the readable rows still have to be served"
    assert not _DEMO_SLUGS.intersection(slugs), (
        "a bad row must never swap the site's content for the seeded demo pages"
    )
    assert "bad" not in slugs, "the row that cannot be read is the only thing dropped"
    assert [r for r in caplog.records if r.levelno >= logging.ERROR], (
        "a page that cannot be served is only visible if it is logged"
    )


async def test_only_a_database_fault_falls_back_to_the_demo_pages(caplog) -> None:
    """The fallback is for the database being unavailable and nothing else."""
    session = _FakeSession([], fail=OperationalError("select 1", {}, Exception("connection reset")))

    with caplog.at_level(logging.ERROR):
        rows = await _list(session)

    assert {row.slug for row in rows} == _DEMO_SLUGS
    assert [r for r in caplog.records if r.levelno >= logging.ERROR], (
        "serving demo content in place of a site is an outage, not a notice"
    )


async def test_a_bug_in_the_query_path_is_not_disguised_as_a_db_outage() -> None:
    """`except Exception` swallowed programming errors into the same quiet 200."""
    session = _FakeSession([], fail=TypeError("unhashable type"))

    with pytest.raises(TypeError):
        await _list(session)


async def test_category_listing_includes_additional_page_membership() -> None:
    primary = _page(id=2, slug="primary", content_type="news", categories=["news"])
    additional = _page(
        id=3,
        slug="also-news",
        content_type="journal",
        categories=["journal", "news"],
    )
    unrelated = _page(id=4, slug="media", content_type="media", categories=["media"])

    rows = await _list(_FakeSession([primary, additional, unrelated]), content_type="news")

    assert {row.slug for row in rows} == {"primary", "also-news"}


async def test_the_ids_filter_reaches_the_shared_parent_pages() -> None:
    """`ids=` is the whole point of the parameter, on both halves of the merge.

    Parent-site posts are appended by a second select of their own, which was
    left unfiltered, so a request for a stay's two related articles came back
    with every parent post naming that villa as well.
    """

    class _ChildSite:
        id = 2
        slug = "villa"
        parent_site_id = 1

    class _StayThenPages(_FakeSession):
        async def execute(self, statement):
            self.statements.append(statement)
            # The first select resolves the stay id; the rest select pages.
            return _ExecuteResult([7] if len(self.statements) == 1 else self.rows)

    async def _shared_query_for(wanted_ids):
        session = _StayThenPages([_page(id=5, related_stay_ids=[7])])
        await cms_routes._shared_parent_pages(session, _ChildSite(), None, "a-villa", wanted_ids)
        return str(session.statements[-1])

    assert "pages.id IN" in await _shared_query_for([5, 9])
    assert "pages.id IN" not in await _shared_query_for(None), (
        "an unfiltered request must not grow an id filter"
    )
