from copy import deepcopy
import pytest
from fastapi import HTTPException
from app.modules.admin.content_categories import category_registry, preserve_registry
from app.modules.admin.routes import CategoryUpsert, ListingCategoriesUpsert, create_category, update_category, bind_listing_categories
from app.modules.sites.models import Site

class Session:
    async def commit(self): pass

def site():
    return Site(id=1,name="QA",slug="qa",parent_site_id=None,settings={"pages":{"news":{"label":{"zh":"最新消息","en":"News"}}}})

def test_legacy_snapshot_preserves_categories_when_pages_are_added_removed_or_renamed():
    stored={"pages":{"news":{"label":{"zh":"新聞","en":"News"}}}}
    incoming={"pages":{"journal":{"label":{"zh":"一般介紹"}}},"article_categories":{"malicious":{}}}
    result=preserve_registry(stored,incoming)
    assert list(result["article_categories"])==["news"]
    assert result["article_categories"]["news"]["label"]["zh"]=="新聞"
    assert stored=={"pages":{"news":{"label":{"zh":"新聞","en":"News"}}}}

def test_explicit_empty_registry_recovers_implicit_public_listing():
    registry=category_registry({"article_categories":{},"pages":{"news":{"page_type":"blocks","content_type":"news"}}})
    assert list(registry)==["news"]

def test_partial_registry_recovers_legacy_listing_categories_without_writing_settings():
    settings={
        "article_categories":{"blog":{"label":{"zh":"部落格","en":"Blog"},"status":"active","sort_order":1}},
        "pages":{
            "news":{"page_type":"blocks","content_type":"news","label":{"zh":"最新消息","en":"News"}},
            "curation":{"page_type":"blocks","content_type":"curation","label":{"zh":"慢域選品","en":"Curation"}},
            "journal":{"page_type":"blocks","content_type":"journal","show_cms_list":False},
            "layout-only":{"page_type":"blocks","article_categories":[]},
            "contact":{"page_type":"blocks","content_type":"contact"},
            "stays":{"page_type":"blocks","content_type":"stays"},
        },
    }
    before=deepcopy(settings)
    registry=category_registry(settings)
    assert set(registry)=={"blog","news","curation"}
    assert registry["news"]["label"]["zh"]=="最新消息"
    assert settings==before

def test_child_legacy_only_imports_explicit_lists():
    assert category_registry({"pages":{"news":{}}},False)=={}
    assert list(category_registry({"pages":{"articles":{"page_type":"cms_list","content_type":"news"}}},False))==["news"]

@pytest.mark.asyncio
async def test_create_edit_archive_category_never_creates_or_renames_page():
    target=site(); before=dict(target.settings["pages"])
    await create_category(CategoryUpsert(key="travel",name_zh="旅遊"),target,Session())
    assert target.settings["pages"]==before
    assert set(target.settings["article_categories"])=={"news","travel"}
    await update_category("travel",CategoryUpsert(key="travel",name_zh="旅行",status="archived"),target,Session())
    assert target.settings["article_categories"]["travel"]["status"]=="archived"
    assert target.settings["pages"]==before
    with pytest.raises(HTTPException) as exc:
        await create_category(CategoryUpsert(key="travel",name_zh="重複"),target,Session())
    assert exc.value.status_code==409

@pytest.mark.asyncio
async def test_listing_binding_can_be_cleared_without_removing_category():
    target=site()
    await bind_listing_categories("news",ListingCategoriesUpsert(categories=["news","news"]),target,Session())
    assert target.settings["pages"]["news"]["article_categories"]==["news"]
    await bind_listing_categories("news",ListingCategoriesUpsert(categories=[]),target,Session())
    assert target.settings["pages"]["news"]["show_cms_list"] is False
    assert "news" in target.settings["article_categories"]

@pytest.mark.asyncio
async def test_binding_rejects_unknown_site_category():
    target=site()
    with pytest.raises(HTTPException) as exc:
        await bind_listing_categories("news",ListingCategoriesUpsert(categories=["other-site"]),target,Session())
    assert exc.value.status_code==422
    assert "article_categories" not in target.settings

def test_public_site_settings_recovers_legacy_list_labels_without_persisting_them():
    from app.modules.sites.routes import public_site_settings
    settings={
        "article_categories":{"blog":{"label":{"zh":"部落格","en":"Blog"},"status":"active"}},
        "pages":{"news":{"page_type":"blocks","content_type":"news","label":{"zh":"最新消息","en":"News"}}},
    }
    output=public_site_settings(settings)
    assert output["article_categories"]["news"]["label"]["zh"]=="最新消息"
    assert settings["article_categories"].keys()=={"blog"}
def test_public_registry_publishes_labels_without_admin_metadata():
    from app.modules.sites.routes import public_site_settings
    output=public_site_settings({"pages":{"news":{"label":{"zh":"最新消息","en":"News"}}},"article_categories":{"travel":{"label":{"zh":"旅遊","en":"Travel"},"status":"active","sort_order":0,"internal_note":"private"}},"qa_note":"private"})
    assert output["article_categories"]["travel"]["label"]["zh"]=="旅遊"
    assert "internal_note" not in output["article_categories"]["travel"]
    assert output["article_categories"]["news"]["label"]["zh"]=="最新消息"
    assert "qa_note" not in output
