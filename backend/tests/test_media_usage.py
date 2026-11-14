"""What still points at an image, asked before it is permanently deleted.

Media deletion removes the row AND unlinks the file, and nothing checked
whether anything referenced it. Deleting a stay's hero image, or one sitting
inside a published article's block config, broke those pages silently: the
admin reported success, the visitor got a broken image, and there was no way
to find out first.

The hard part is that a url can hide in two different shapes — a scalar column
like Stay.hero_image_url, and anywhere inside the JSON the block editors write.
The JSON side is matched as text against the serialised document, because a
block may store the url under any key and no schema enumerates them.
"""

import asyncio

import pytest
from fastapi import HTTPException

from app.modules.admin.routes import media_usage
from app.modules.media.models import MediaAsset
from app.modules.sites.models import Site

URL = "/storage/media/in-use.jpg"
SITE = Site(id=1, slug="root", name="Root")


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return list(self._rows)

    def all(self):
        return list(self._rows)


class _FakeSession:
    """Returns rows keyed by the entity the statement selects from."""

    def __init__(self, asset, by_entity=None, joined=None):
        self.asset = asset
        self.by_entity = by_entity or {}
        self.joined = joined or []
        self.statements = []

    async def get(self, _model, _item_id):
        return self.asset

    async def execute(self, statement):
        # The WHERE clause, not the whole statement: str(select(Page)) lists
        # every column of the table, so "body_blocks" appears in it whether or
        # not the search actually looks inside the JSON.
        self.statements.append(str(statement.whereclause))
        descriptions = statement.column_descriptions
        if len(descriptions) > 1:
            return _Result(self.joined)
        entity = descriptions[0]["entity"]
        return _Result(self.by_entity.get(entity, []))


def _asset():
    return MediaAsset(id=3, site_id=SITE.id, url=URL, storage_key="in-use.jpg")


def test_an_unused_image_reports_zero() -> None:
    result = asyncio.run(media_usage(3, SITE, _FakeSession(_asset())))

    assert result["total"] == 0
    assert result["usages"] == []


def test_a_scalar_reference_is_found() -> None:
    from app.modules.stays.models import Stay

    stay = Stay(id=9, site_id=SITE.id, name="禾境", hero_image_url=URL)
    session = _FakeSession(_asset(), {Stay: [stay]})

    result = asyncio.run(media_usage(3, SITE, session))

    assert result["total"] == 1
    assert result["usages"][0] == {"kind": "stay", "id": 9, "title": "禾境"}


def test_a_reference_buried_in_json_is_found() -> None:
    """The block editors keep urls inside body_blocks, not in a column."""
    from app.modules.cms.models import Page

    page = Page(id=4, site_id=SITE.id, title="秋季專題", slug="autumn")
    session = _FakeSession(_asset(), {Page: [page]})

    result = asyncio.run(media_usage(3, SITE, session))

    assert {"kind": "page", "id": 4, "title": "秋季專題"} in result["usages"]
    # The filter has to reach into the JSON, not just compare the column.
    assert any("body_blocks" in where for where in session.statements), (
        "no WHERE clause searches body_blocks: " + " | ".join(session.statements)
    )


def test_the_gallery_is_matched_through_its_parent_stay() -> None:
    """StayImage has no site_id of its own, so it joins through the stay."""
    from app.modules.stays.models import StayImage

    image = StayImage(id=2, stay_id=9, image_url=URL)
    session = _FakeSession(_asset(), joined=[(image, "禾境")])

    result = asyncio.run(media_usage(3, SITE, session))

    assert {"kind": "stay_gallery", "id": 9, "title": "禾境"} in result["usages"]


def test_another_site_cannot_probe_this_asset() -> None:
    other = MediaAsset(id=3, site_id=99, url=URL, storage_key="in-use.jpg")

    with pytest.raises(HTTPException) as raised:
        asyncio.run(media_usage(3, SITE, _FakeSession(other)))

    assert raised.value.status_code == 404


def test_a_missing_asset_is_a_404() -> None:
    with pytest.raises(HTTPException) as raised:
        asyncio.run(media_usage(3, SITE, _FakeSession(None)))

    assert raised.value.status_code == 404


def test_an_asset_with_no_url_is_not_searched_for_everywhere() -> None:
    """An empty url would LIKE-match every row; answer zero instead."""
    blank = MediaAsset(id=3, site_id=SITE.id, url="", storage_key="")
    session = _FakeSession(blank)

    result = asyncio.run(media_usage(3, SITE, session))

    assert result["total"] == 0
    assert session.statements == [], "no query should run for a blank url"
