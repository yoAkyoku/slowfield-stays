"""Tenant isolation, tested against a database that runs the query.

An audit of this suite removed the `WHERE site_id == …` from seven tenant-scoped
queries at once — including the cascade in `delete_site`, which then deletes
every stay, page, banner, inquiry and subscriber belonging to **every other
site** — and all 293 tests stayed green. Verified independently before writing
this file: that single mutation passes the whole suite.

The reason is uniform. Every `_FakeSession` in this directory has the shape

    async def execute(self, _statement): return canned_rows

so the statement, and therefore the filter that is the entire multi-tenant
boundary, is discarded. A test written against one of those can assert anything
it likes about isolation and never be able to fail.

These tests use the real-database fixture in conftest.py. Two sites are
populated, a handler is called for one of them, and the assertion is about what
is still there afterwards for the other.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

import app.modules.admin.routes as routes
from app.modules.admin.routes import delete_site, media_usage
from app.modules.auth.models import AdminUser, Role
from app.modules.bookings.models import BookingRequest
from app.modules.cms.models import Banner, Page
from app.modules.email.models import NewsletterSubscriber
from app.modules.inquiries.models import Inquiry
from app.modules.media.models import MediaAsset
from app.modules.sites.models import AdminUserSite, Site
from app.modules.stays.models import Stay

# pytest puts the test directory on sys.path (no __init__.py here), so the
# conftest module is importable by name.
from conftest import make


def _seed(db):
    """Two sites, each with one of everything the cascade touches."""
    s = db.sync
    keep = Site(id=1, name="Parent", slug="parent", domain="parent.example")
    doomed = Site(id=2, name="Villa", slug="villa", domain="villa.example", parent_site_id=1)
    s.add_all([keep, doomed])

    # A real super-admin, not a monkeypatched one: deleting a site legitimately
    # requires it, and letting the actual authorization run means these tests
    # also prove the handler is reachable the way production reaches it.
    s.add_all([
        Role(id=1, name="admin", permissions=["cms:read"]),
        Role(id=2, name="super_admin", permissions=["*"]),
    ])
    s.add_all([
        make(AdminUser, id=1, email="a@x.co", name="A", password_hash="x", role_id=2),
        make(AdminUser, id=2, email="b@x.co", name="B", password_hash="x", role_id=1),
    ])
    s.flush()

    for site_id, tag in ((1, "keep"), (2, "doomed")):
        s.add_all([
            AdminUserSite(admin_user_id=site_id, site_id=site_id, role_id=1),
            make(Stay, site_id=site_id, name=f"stay-{tag}", slug=f"stay-{tag}",
                 hero_image_url=f"/storage/media/{tag}.jpg", base_price=1, max_guests=2),
            make(Page, site_id=site_id, title=f"page-{tag}", slug=f"page-{tag}",
                 content_type="journal", status="published"),
            make(Banner, site_id=site_id, title=f"banner-{tag}", image_url=f"/storage/media/{tag}.jpg"),
            make(Inquiry, site_id=site_id, name=f"inq-{tag}", email="i@x.co"),
            make(BookingRequest, site_id=site_id, name=f"bk-{tag}", email="b@x.co"),
            make(NewsletterSubscriber, site_id=site_id, email=f"{tag}@x.co",
                 status="subscribed", unsubscribe_token=f"tok-{tag}"),
            make(MediaAsset, site_id=site_id, url=f"/storage/media/{tag}.jpg",
                 storage_key=f"{tag}.jpg"),
        ])
    s.commit()
    return keep, doomed


def _count(db, model, site_id: int) -> int:
    return len(db.sync.execute(select(model).where(model.site_id == site_id)).scalars().all())


def test_deleting_a_site_leaves_every_other_site_intact(db_session, monkeypatch) -> None:
    """The mutation this file exists for.

    `delete_site` iterates twelve models and deletes their rows. With the site
    filter removed it empties the whole database, and the previous suite could
    not tell the difference.
    """
    _seed(db_session)

    # The handler unlinks files after committing; there is no storage in a test.
    monkeypatch.setattr(routes, "media_path", lambda _key: None)

    before = {m.__name__: _count(db_session, m, 1)
              for m in (Stay, Page, Banner, Inquiry, BookingRequest, NewsletterSubscriber, MediaAsset)}
    assert all(v == 1 for v in before.values()), f"seed is wrong: {before}"

    admin = db_session.sync.get(AdminUser, 1)  # persisted: _site_role reads its ORM identity
    asyncio.run(delete_site(site_id=2, admin=admin, session=db_session))

    # The target is gone …
    assert db_session.sync.get(Site, 2) is None, "the site itself was not deleted"
    for model in (Stay, Page, Banner, Inquiry, BookingRequest, NewsletterSubscriber, MediaAsset):
        assert _count(db_session, model, 2) == 0, f"{model.__name__} rows survived for the deleted site"

    # … and the other tenant is untouched. This is the assertion that fails when
    # the site filter is dropped.
    assert db_session.sync.get(Site, 1) is not None, "the surviving site was deleted"
    after = {m.__name__: _count(db_session, m, 1)
             for m in (Stay, Page, Banner, Inquiry, BookingRequest, NewsletterSubscriber, MediaAsset)}
    assert after == before, f"deleting site 2 destroyed another tenant's data: {after} != {before}"


def test_the_files_unlinked_are_only_the_deleted_sites(db_session, monkeypatch) -> None:
    """The media list is gathered by its own query, with its own filter."""
    _seed(db_session)
    unlinked: list[str] = []

    monkeypatch.setattr(routes, "media_path", lambda key: unlinked.append(key) or None)

    admin = db_session.sync.get(AdminUser, 1)  # persisted: _site_role reads its ORM identity
    asyncio.run(delete_site(site_id=2, admin=admin, session=db_session))

    assert "keep.jpg" not in unlinked, "deleting one site unlinked another site's media file"
    assert unlinked in ([], ["doomed.jpg"]), f"unexpected unlink set: {unlinked}"


def test_media_usage_does_not_report_another_tenants_pages(db_session, monkeypatch) -> None:
    """`media_usage` searches for a URL; the search must stay inside the tenant.

    Both sites here reference a file with the *same* name, which is what a
    cloned child site actually produces — so a scope bug shows up as the other
    site's page appearing in the answer.
    """
    _seed(db_session)
    # Give both sites a page whose body references the doomed site's URL.
    s = db_session.sync
    for site_id, tag in ((1, "keep"), (2, "doomed")):
        s.add(make(Page, site_id=site_id, title=f"uses-{tag}", slug=f"uses-{tag}",
                   content_type="journal", status="published",
                   body_blocks=[{"type": "image", "url": "/storage/media/doomed.jpg"}]))
    s.commit()

    asset = s.execute(
        select(MediaAsset).where(MediaAsset.site_id == 2)
    ).scalars().one()

    result = asyncio.run(media_usage(media_id=asset.id, site=s.get(Site, 2), session=db_session))

    titles = {u["title"] for u in result["usages"]}
    assert "uses-keep" not in titles, (
        "media_usage reported a page belonging to a different tenant — the scope "
        f"filter is not doing its job: {sorted(titles)}"
    )
    assert result["total"] >= 1, "the site's own references were not found at all"


def test_the_fixture_can_actually_fail(db_session) -> None:
    """Guard the guard.

    A fixture that silently returned nothing would make every assertion above
    vacuous — which is exactly the failure mode this whole file exists to
    correct. So: the filter must demonstrably change the result.
    """
    _seed(db_session)
    scoped = db_session.sync.execute(select(Stay).where(Stay.site_id == 2)).scalars().all()
    unscoped = db_session.sync.execute(select(Stay)).scalars().all()
    assert len(scoped) == 1, "the scoped query returned the wrong number of rows"
    assert len(unscoped) == 2, "the unscoped query returned the same as the scoped one — "
    assert {s.name for s in scoped} == {"stay-doomed"}
