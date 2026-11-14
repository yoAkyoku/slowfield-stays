"""Deleting a site must take its image files with it, not just their rows.

`/storage/media` is mounted as static files and serves by `storage_key`, so a
MediaAsset row is only the record — the file is what the public actually reads.
delete_site removed the rows and left every file in place, which meant the
images of a deleted site stayed readable at their original URLs indefinitely,
with no row left in the database to find them by afterwards.

The confirm dialog tells the operator "媒體…都會一併移除，且無法復原". This is
the test that keeps that sentence true.
"""

import asyncio

import pytest
from fastapi import HTTPException

from app.modules.admin import routes as admin_routes
from app.modules.media.models import MediaAsset
from app.modules.sites.models import Site

CHILD_SITE_ID = 7


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return list(self._rows)


class _FakeSession:
    """Answers each select with the rows registered for that model."""

    def __init__(self, by_model):
        self.by_model = by_model
        self.deleted = []
        self.committed = False

    async def get(self, model, item_id):
        return self.by_model.get(("get", model, item_id))

    async def execute(self, statement):
        model = statement.column_descriptions[0]["entity"]
        return _Result(self.by_model.get(model, []))

    async def delete(self, item):
        self.deleted.append(item)

    async def commit(self):
        self.committed = True


def _setup(monkeypatch, assets, tmp_path):
    site = Site(id=CHILD_SITE_ID, slug="child", name="Child", parent_site_id=1)
    session = _FakeSession({("get", Site, CHILD_SITE_ID): site, MediaAsset: assets})

    async def _role(*_args, **_kwargs):
        return "owner"

    monkeypatch.setattr(admin_routes, "_site_role", _role)
    monkeypatch.setattr(admin_routes, "media_path", lambda key: tmp_path / key)
    return session


def test_the_files_are_unlinked_with_the_rows(monkeypatch, tmp_path) -> None:
    kept = tmp_path / "someone-elses.jpg"
    kept.write_bytes(b"x")
    doomed = [tmp_path / "a.jpg", tmp_path / "b.jpg"]
    for f in doomed:
        f.write_bytes(b"x")

    assets = [
        MediaAsset(id=1, site_id=CHILD_SITE_ID, url="/storage/media/a.jpg", storage_key="a.jpg"),
        MediaAsset(id=2, site_id=CHILD_SITE_ID, url="/storage/media/b.jpg", storage_key="b.jpg"),
    ]
    session = _setup(monkeypatch, assets, tmp_path)

    asyncio.run(admin_routes.delete_site(CHILD_SITE_ID, admin=object(), session=session))

    assert session.committed
    assert [f.exists() for f in doomed] == [False, False]
    assert kept.exists(), "only this site's media should go"


def test_a_missing_file_does_not_fail_the_deletion(monkeypatch, tmp_path) -> None:
    """The row can outlive the file; that is not a reason to keep the site."""
    assets = [
        MediaAsset(id=1, site_id=CHILD_SITE_ID, url="/storage/media/gone.jpg", storage_key="gone.jpg"),
    ]
    session = _setup(monkeypatch, assets, tmp_path)

    result = asyncio.run(admin_routes.delete_site(CHILD_SITE_ID, admin=object(), session=session))

    assert result == {"ok": "true"}
    assert session.committed


def test_an_asset_with_no_storage_key_falls_back_to_the_url(monkeypatch, tmp_path) -> None:
    """Older rows predate storage_key; the filename is still in the url."""
    legacy = tmp_path / "legacy.jpg"
    legacy.write_bytes(b"x")
    assets = [MediaAsset(id=1, site_id=CHILD_SITE_ID, url="/storage/media/legacy.jpg", storage_key="")]
    session = _setup(monkeypatch, assets, tmp_path)

    asyncio.run(admin_routes.delete_site(CHILD_SITE_ID, admin=object(), session=session))

    assert not legacy.exists()


def test_the_root_site_is_still_refused(monkeypatch, tmp_path) -> None:
    """The guard has to survive the change around it."""
    root = Site(id=1, slug="root", name="Root", parent_site_id=None)
    session = _FakeSession({("get", Site, 1): root, MediaAsset: []})

    async def _role(*_args, **_kwargs):
        return "owner"

    monkeypatch.setattr(admin_routes, "_site_role", _role)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(admin_routes.delete_site(1, admin=object(), session=session))

    assert raised.value.status_code == 400
    assert not session.committed
