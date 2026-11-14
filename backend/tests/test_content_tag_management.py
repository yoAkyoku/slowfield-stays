"""Regression coverage for the site-owned CMS tag catalogue."""

import asyncio

import pytest
from fastapi import HTTPException

from app.modules.admin.routes import (
    ContentTagAdminUpsert,
    _clone_site_content,
    create_content_tag,
    update_content_tag,
)
from app.modules.cms.models import ContentTag, Page
from app.modules.sites.models import Site


class _Session:
    def __init__(self, rows=None):
        self.rows = rows or {}
        self.added = []
        self.committed = False

    async def get(self, model, item_id):
        return self.rows.get((model, item_id))

    def add(self, item):
        self.added.append(item)

    async def commit(self):
        self.committed = True

    async def refresh(self, _item):
        return None


def test_editing_a_tag_from_another_site_is_refused() -> None:
    tag = ContentTag(id=4, site_id=1, slug="family", name_zh="親子", name_en="Family")
    session = _Session({(ContentTag, 4): tag})

    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            update_content_tag(
                4,
                ContentTagAdminUpsert(name_zh="改名", name_en="Renamed"),
                Site(id=2, slug="child", name="Child"),
                session,
            )
        )

    assert raised.value.status_code == 404
    assert tag.name_zh == "親子"
    assert not session.committed


def test_new_tag_is_owned_by_the_current_site() -> None:
    session = _Session()
    tag = asyncio.run(
        create_content_tag(
            ContentTagAdminUpsert(name_zh="親子同樂", name_en="Family fun"),
            Site(id=7, slug="child", name="Child"),
            session,
        )
    )

    assert session.committed
    created = session.added[0]
    assert isinstance(created, ContentTag)
    assert created.site_id == 7
    assert created.slug == "family-fun"
    assert tag["slug"] == "family-fun"


def test_site_clone_copies_the_tag_catalogue_without_reusing_rows() -> None:
    source = Site(id=1, slug="source", name="Source")
    target = Site(id=2, slug="target", name="Target")
    source_tag = ContentTag(
        id=3, site_id=source.id, slug="family", name_zh="親子同樂", name_en="Family fun",
        status="active", sort_order=2,
    )
    session = _CloneSession(tags=[source_tag])

    asyncio.run(_clone_site_content(session, source, target))

    copied = next(item for item in session.added if isinstance(item, ContentTag))
    assert copied is not source_tag
    assert copied.site_id == target.id
    assert copied.slug == source_tag.slug
    assert copied.name_en == source_tag.name_en


class _Result:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows


class _CloneSession(_Session):
    def __init__(self, *, tags=None):
        super().__init__()
        self.rows_by_model = {ContentTag: tags or [], Page: []}

    async def execute(self, statement):
        model = statement.column_descriptions[0]["entity"]
        return _Result(self.rows_by_model.get(model, []))
