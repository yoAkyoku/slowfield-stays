from app.modules.admin.routes import _normalise_page_categories, _page_payload
from app.modules.cms.models import Page
from app.modules.cms.routes import page_has_content_type, page_to_read


def _page(**overrides) -> Page:
    values = {
        "id": 1,
        "site_id": 1,
        "slug": "multi-category",
        "title": "Multi category",
        "summary": "",
        "body": "Body",
        "body_blocks": [],
        "content_type": "journal",
        "categories": ["journal", "news", "media"],
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


def test_categories_are_deduplicated_and_always_include_primary() -> None:
    assert _normalise_page_categories("journal", ["news", "journal", "news", "bad value"]) == [
        "journal",
        "news",
    ]


def test_public_membership_matches_primary_or_additional_category() -> None:
    page = _page()
    assert page_has_content_type(page, "journal")
    assert page_has_content_type(page, "news")
    assert page_has_content_type(page, "media")
    assert not page_has_content_type(page, "activity")


def test_categories_round_trip_through_admin_and_public_payloads() -> None:
    page = _page()
    assert _page_payload(page)["categories"] == ["journal", "news", "media"]
    assert page_to_read(page).categories == ["journal", "news", "media"]
