from __future__ import annotations

import asyncio
from types import SimpleNamespace

from app.modules.admin.routes import manage_media, media_overview, media_summary
from app.modules.media.models import MediaAsset
from app.modules.sites.models import Site
from app.modules.stays.models import Stay
from app.modules.stays.routes import list_stay_search_options
from conftest import make


def test_media_summary_and_page_are_site_scoped(db_session) -> None:
    site = Site(id=1, name="One", slug="one", domain="one.example")
    other = Site(id=2, name="Two", slug="two", domain="two.example")
    db_session.sync.add_all([site, other])
    db_session.sync.add_all([
        make(MediaAsset, site_id=1, url="/a.jpg", storage_key="a.jpg", mime_type="image/jpeg"),
        make(MediaAsset, site_id=1, url="/b.mp4", storage_key="b.mp4", mime_type="video/mp4"),
        make(MediaAsset, site_id=2, url="/c.jpg", storage_key="c.jpg", mime_type="image/jpeg"),
    ])
    db_session.sync.commit()

    summary = asyncio.run(media_summary(site=site, session=db_session))
    page = asyncio.run(manage_media(request=None, skip=0, limit=1, site=site, session=db_session))  # type: ignore[arg-type]

    assert summary == {"total": 2, "images": 1, "videos": 1}
    assert len(page) == 1
    assert page[0]["url"] == "/b.mp4"

    overview = asyncio.run(media_overview(request=None, limit=1, site=site, session=db_session))  # type: ignore[arg-type]
    assert overview["summary"] == {"total": 2, "images": 1, "videos": 1}
    assert len(overview["media"]) == 1
    assert overview["media"][0]["url"] == "/b.mp4"


def test_search_options_return_only_published_locations_for_current_site(db_session) -> None:
    site = Site(id=1, name="One", slug="one", domain="one.example")
    other = Site(id=2, name="Two", slug="two", domain="two.example")
    db_session.sync.add_all([site, other])
    db_session.sync.add_all([
        make(Stay, site_id=1, slug="shown", name="Shown", status="published", region="宜蘭", destination="礁溪"),
        make(Stay, site_id=1, slug="draft", name="Draft", status="draft", region="台北", destination="北投"),
        make(Stay, site_id=2, slug="other", name="Other", status="published", region="花蓮", destination="壽豐"),
    ])
    db_session.sync.commit()

    request = SimpleNamespace(headers={"host": "one.example"})
    options = asyncio.run(list_stay_search_options(request=request, site="one", session=db_session))  # type: ignore[arg-type]

    assert options == [{"region": "宜蘭", "destination": "礁溪"}]
