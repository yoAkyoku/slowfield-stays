"""Creating a child site from an existing one as a template.

The client's ask is "a villa template we can copy". The picker and the clone
already existed; what was never covered is the part that makes a copy look like
its template rather than like a blank site, and the part that keeps the copy's
own identity.

Two failures this guards against, both of which read as "the template picker was
ignored":

  * settings not copied, so the new villa arrives with no pages, no homepage
    blocks, no fonts and no colours;
  * settings copied by reference, so editing the new villa's homepage silently
    rewrites the template's as well (they are JSON columns, and a shared dict
    is one object with two rows pointing at it).
"""

from app.modules.admin.routes import SiteCreate, _apply_explicit_site_create_overrides, _clone_site_settings
from app.modules.sites.models import Site


def _template() -> Site:
    return Site(
        id=2,
        name="禾境",
        slug="hejing",
        default_locale="zh",
        settings={
            "pages": {
                "space": {"label": {"zh": "房型與特色"}, "sort_order": 0, "blocks": [{"type": "flow"}]},
                "faq": {"label": {"zh": "入住須知FAQ"}, "sort_order": 5},
            },
            "layout": {"gutter": "wide", "ui_scale": 1.1},
        },
        theme_config={"primaryColor": "#0f0f0d", "accentColor": "#8a6b42"},
        contact_config={"email": "hi@example.com", "line": "@example"},
        seo_defaults={"title": "禾境", "description": "宜蘭冬山泳池包棟"},
    )


def _blank(name: str, slug: str) -> Site:
    return Site(id=9, name=name, slug=slug, parent_site_id=1, template_site_id=2, default_locale="en")


def test_the_copy_inherits_what_makes_the_template_look_like_itself() -> None:
    source, target = _template(), _blank("八代町", "yashirocho")
    _clone_site_settings(source, target)

    assert target.settings["pages"]["space"]["label"]["zh"] == "房型與特色"
    assert target.settings["pages"]["faq"]["sort_order"] == 5
    assert target.settings["layout"] == {"gutter": "wide", "ui_scale": 1.1}
    assert target.theme_config["accentColor"] == "#8a6b42"
    assert target.contact_config["line"] == "@example"
    assert target.default_locale == "zh"


def test_the_copy_keeps_its_own_identity() -> None:
    source, target = _template(), _blank("八代町", "yashirocho")
    _clone_site_settings(source, target)

    assert target.name == "八代町"
    assert target.slug == "yashirocho"
    assert target.parent_site_id == 1
    assert target.template_site_id == 2
    # SEO defaults name the template and would be actively wrong on the copy.
    assert target.seo_defaults != source.seo_defaults


def test_editing_the_copy_does_not_reach_back_into_the_template() -> None:
    source, target = _template(), _blank("八代町", "yashirocho")
    _clone_site_settings(source, target)

    target.settings["pages"]["space"]["label"]["zh"] = "四座 Villa"
    target.settings["pages"]["space"]["blocks"].append({"type": "image_gallery"})
    target.theme_config["accentColor"] = "#b78b58"

    assert source.settings["pages"]["space"]["label"]["zh"] == "房型與特色"
    assert len(source.settings["pages"]["space"]["blocks"]) == 1
    assert source.theme_config["accentColor"] == "#8a6b42"


def test_a_template_with_nothing_set_up_does_not_crash_the_copy() -> None:
    source = Site(id=3, name="Bare", slug="bare", default_locale="zh")
    target = _blank("New", "new")
    _clone_site_settings(source, target)

    assert target.settings == {}
    assert target.theme_config == {}
    assert target.contact_config == {}


def test_explicit_create_values_win_over_the_template() -> None:
    source, target = _template(), _blank("八代町", "yashirocho")
    payload = SiteCreate(
        name="八代町",
        slug="yashirocho",
        default_locale="en",
        accent_color="#123456",
        contact_email="new@example.com",
        settings={"layout": {"gutter": "compact"}},
    )

    _clone_site_settings(source, target)
    _apply_explicit_site_create_overrides(target, payload)

    assert target.default_locale == "en"
    assert target.theme_config["primaryColor"] == "#0f0f0d"
    assert target.theme_config["accentColor"] == "#123456"
    assert target.contact_config == {"email": "new@example.com", "line": "@example"}
    assert target.settings["layout"] == {"gutter": "compact"}
    assert "pages" in target.settings


def test_omitted_create_values_keep_the_template_values() -> None:
    source, target = _template(), _blank("八代町", "yashirocho")
    payload = SiteCreate(name="八代町", slug="yashirocho")

    _clone_site_settings(source, target)
    _apply_explicit_site_create_overrides(target, payload)

    assert target.default_locale == "zh"
    assert target.theme_config == source.theme_config
    assert target.contact_config == source.contact_config
    assert target.settings == source.settings


def test_a_site_created_as_a_draft_is_not_created_live() -> None:
    """The status the admin picks on the "new site" form must survive the schema.

    SiteCreate had no `status` field at all — only SiteUpdate declared one — so
    pydantic dropped the value the form sent and the endpoint hard-coded
    "active". A villa set up as a draft was therefore public from the moment it
    was created, serving the template villa's photos and copy under the new
    brand's name until somebody noticed and edited it back to draft.
    """
    from app.modules.admin.routes import SiteCreate

    assert SiteCreate(name="X", slug="x", status="draft").status == "draft"
    assert SiteCreate(name="X", slug="x").status == "active", "unspecified still means live"


def test_a_site_status_outside_the_known_set_is_refused() -> None:
    """The pattern moved with the field; without it "drafft" would silently
    create a site no listing query matches and no admin screen explains."""
    import pytest
    from pydantic import ValidationError

    from app.modules.admin.routes import SiteCreate

    for bad in ["drafft", "published", "", "ACTIVE"]:
        with pytest.raises(ValidationError):
            SiteCreate(name="X", slug="x", status=bad)


def test_a_site_read_from_the_api_can_be_written_back_unchanged() -> None:
    """GET output must be valid PUT input.

    `_site_payload` returns `domain: null` for a site that has none — every
    child site created without one — while the field was typed `str`, so a
    read-modify-write of any such site died with "Input should be a valid
    string" on a field the caller never touched. The admin UI was shielded by a
    `site.domain || ""` in its payload builder; no other client was.
    """
    from app.modules.admin.routes import SiteUpdate

    from_api = {"name": "八代町", "slug": "yashirocho", "domain": None, "status": "draft"}
    assert SiteUpdate(**from_api).domain == ""

    # Omitted and empty behave the same, and a real host still round-trips.
    assert SiteUpdate(name="X", slug="x").domain == ""
    assert SiteUpdate(name="X", slug="x", domain="villa.example.com").domain == "villa.example.com"


def test_a_malformed_domain_is_still_refused() -> None:
    """Accepting null must not have opened the field to anything else."""
    import pytest
    from pydantic import ValidationError

    from app.modules.admin.routes import SiteUpdate

    for bad in ["NOT A HOST", "http://x.com", "a..b", "-leading.com", "space here.com"]:
        with pytest.raises(ValidationError):
            SiteUpdate(name="X", slug="x", domain=bad)


def test_the_copy_leaves_deleted_content_deleted() -> None:
    """Cloning read the content tables raw while every other read of them
    filters `deleted_at`, so pages, banners and stays the client had deleted
    reappeared on the new site as fresh drafts."""
    import asyncio

    from app.modules.admin.routes import _clone_site_content

    session = _RecordingSession()
    asyncio.run(_clone_site_content(session, _template(), _blank("八代町", "yashirocho")))

    from app.modules.cms.models import Banner, Page
    from app.modules.stays.models import Stay

    for model in (Banner, Page, Stay):
        statement = session.statements[model]
        assert "deleted_at IS NULL" in str(statement), f"{model.__name__} clone ignores soft deletes"


def test_the_copy_does_not_share_json_columns_with_its_template() -> None:
    """Same failure `_clone_site_settings` deep-copies against, one level down:
    a JSON column assigned by reference is one dict with two rows pointing at
    it, so editing the new site's page rewrites the template's."""
    import asyncio

    from app.modules.admin.routes import _clone_site_content
    from app.modules.cms.models import Page
    from app.modules.stays.models import Stay

    source_page = Page(
        id=1, site_id=2, slug="brand-intro", title="品牌介紹", summary="", body="",
        body_blocks=[{"type": "flow", "items": ["a"]}], content_type="brand", layout="",
        cover_image_url="", sort_order=0, tags=["villa"], status="published",
        seo={"title": "品牌介紹", "description": ""}, translations={"en": {"title": "Brand"}},
    )
    source_stay = Stay(
        id=1, site_id=2, slug="hejing", name="禾境", destination="宜蘭", region="冬山",
        summary="", story="", hero_image_url="", base_price=0, max_guests=2, status="published",
        seo={"title": "雅禾境"}, detail_config={"hero": {"style": "wide"}}, faq=[{"q": "checkin"}],
        house_rules=["no smoking"], location_config={"lat": 24.6}, social_links={"ig": "@hejing"},
        tags=["pool"], facilities=["pool"], translations={"en": {"name": "Hejing"}},
    )
    source_stay.amenities, source_stay.room_types, source_stay.images = [], [], []

    session = _RecordingSession(pages=[source_page], stays=[source_stay])
    asyncio.run(_clone_site_content(session, _template(), _blank("八代町", "yashirocho")))

    page = next(item for item in session.added if isinstance(item, Page))
    stay = next(item for item in session.added if isinstance(item, Stay))

    page.seo["title"] = "changed"
    page.tags.append("changed")
    page.body_blocks[0]["items"].append("changed")
    page.translations["en"]["title"] = "changed"
    stay.detail_config["hero"]["style"] = "changed"
    stay.faq[0]["q"] = "changed"
    stay.house_rules.append("changed")
    stay.location_config["lat"] = 0
    stay.social_links["ig"] = "changed"
    stay.seo["title"] = "changed"
    stay.tags.append("changed")
    stay.translations["en"]["name"] = "changed"

    assert source_page.seo == {"title": "品牌介紹", "description": ""}
    assert source_page.tags == ["villa"]
    assert source_page.body_blocks == [{"type": "flow", "items": ["a"]}]
    assert source_page.translations == {"en": {"title": "Brand"}}
    assert source_stay.detail_config == {"hero": {"style": "wide"}}
    assert source_stay.faq == [{"q": "checkin"}]
    assert source_stay.house_rules == ["no smoking"]
    assert source_stay.location_config == {"lat": 24.6}
    assert source_stay.social_links == {"ig": "@hejing"}
    assert source_stay.seo == {"title": "雅禾境"}
    assert source_stay.tags == ["pool"]
    assert source_stay.translations == {"en": {"name": "Hejing"}}


class _RecordingSession:
    """Keeps the SELECT it was handed for each table, and returns the rows the
    test supplies for it — enough to inspect what `_clone_site_content` reads
    and what it writes, without a database."""

    def __init__(self, *, banners=None, pages=None, announcements=None, stays=None):
        from app.modules.cms.models import Announcement, Banner, Page
        from app.modules.stays.models import Stay

        self.rows = {
            Banner: banners or [], Page: pages or [],
            Announcement: announcements or [], Stay: stays or [],
        }
        self.statements: dict[type, object] = {}
        self.added: list[object] = []

    async def execute(self, statement):
        model = statement.column_descriptions[0]["entity"]
        self.statements[model] = statement
        return _Result(self.rows.get(model, []))

    def add(self, item):
        self.added.append(item)


class _Result:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items
