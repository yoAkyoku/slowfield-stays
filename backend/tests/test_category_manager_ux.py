import pytest
from fastapi import HTTPException
from app.modules.admin.routes import CategoryUpsert, WebsitePageCreate, create_category, create_website_page
from app.modules.sites.models import Site

class Session:
    async def commit(self): pass

def test_category_key_matches_postgres_content_type_capacity():
    from pydantic import ValidationError
    from app.modules.cms.models import Page
    assert Page.__table__.c.content_type.type.length == 40
    assert CategoryUpsert(key="a" * 40, name_zh="分類").key == "a" * 40
    with pytest.raises(ValidationError):
        CategoryUpsert(key="a" * 41, name_zh="分類")

@pytest.mark.asyncio
async def test_generated_long_category_key_and_collision_fit_postgres():
    site=target()
    first=await create_category(CategoryUpsert(name_zh="長名稱",name_en="a" * 120),site,Session())
    second=await create_category(CategoryUpsert(name_zh="同名稱",name_en="a" * 120),site,Session())
    assert len(first["key"]) <= 40 and len(second["key"]) <= 40
    assert first["key"] != second["key"]

def target():
    return Site(id=1,name="QA",slug="qa",parent_site_id=None,settings={"pages":{"news":{"label":{"zh":"最新消息","en":"News"}}}})

@pytest.mark.asyncio
async def test_category_can_be_created_with_only_chinese_name():
    site=target()
    result=await create_category(CategoryUpsert(name_zh="親子旅行"),site,Session())
    assert result["key"].startswith("category-")
    assert result["label"]["zh"]=="親子旅行"
    assert list(site.settings["pages"])==["news"]

@pytest.mark.asyncio
async def test_generated_english_category_key_does_not_overwrite_existing():
    site=target()
    first=await create_category(CategoryUpsert(name_zh="旅行",name_en="Travel"),site,Session())
    second=await create_category(CategoryUpsert(name_zh="旅行二",name_en="Travel"),site,Session())
    assert first["key"]=="travel"
    assert second["key"].startswith("travel-")
    assert len(site.settings["article_categories"])==3

@pytest.mark.asyncio
async def test_direct_general_page_creation_does_not_add_category_or_navigation():
    site=target()
    result=await create_website_page(WebsitePageCreate(name_zh="品牌故事"),site,Session())
    cfg=site.settings["pages"][result["page_key"]]
    assert cfg["page_type"]=="blocks"
    assert cfg["article_categories"]==[]
    assert cfg["nav_hidden"] is True and cfg["footer_hidden"] is True
    assert set(site.settings["article_categories"])=={"news"}

@pytest.mark.asyncio
async def test_direct_listing_page_can_select_existing_categories():
    site=target()
    result=await create_website_page(WebsitePageCreate(name_zh="最新優惠",name_en="Latest offers",categories=["news","news"]),site,Session())
    assert result["page_key"]=="latest-offers"
    cfg=site.settings["pages"]["latest-offers"]
    assert cfg["page_type"]=="cms_list" and cfg["show_cms_list"] is True
    assert cfg["article_categories"]==["news"]
    assert set(site.settings["article_categories"])=={"news"}

@pytest.mark.asyncio
async def test_duplicate_url_never_overwrites_existing_page():
    site=target()
    with pytest.raises(HTTPException) as exc:
        await create_website_page(WebsitePageCreate(name_zh="另一頁",slug="news"),site,Session())
    assert exc.value.status_code==409
    assert site.settings["pages"]["news"]["label"]["zh"]=="最新消息"

@pytest.mark.asyncio
@pytest.mark.parametrize("slug",["admin","stays","contact","privacy","api","home","about","about-us","blog","rooms","villas","media","press","jobs","faq","service"])
async def test_reserved_system_routes_cannot_be_overwritten(slug):
    site=target()
    with pytest.raises(HTTPException) as exc:
        await create_website_page(WebsitePageCreate(name_zh="測試",slug=slug),site,Session())
    assert exc.value.status_code==422
    assert list(site.settings["pages"])==["news"]

@pytest.mark.asyncio
async def test_unknown_or_other_site_category_cannot_be_bound():
    site=target()
    with pytest.raises(HTTPException) as exc:
        await create_website_page(WebsitePageCreate(name_zh="測試",categories=["other-site"]),site,Session())
    assert exc.value.status_code==422
    assert list(site.settings["pages"])==["news"]

@pytest.mark.asyncio
async def test_automatic_url_avoids_reserved_english_name():
    site=target()
    result=await create_website_page(WebsitePageCreate(name_zh="聯絡資訊",name_en="Contact"),site,Session())
    assert result["page_key"].startswith("contact-")
