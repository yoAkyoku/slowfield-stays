"""Author-created records, real SQLite queries and real HTTP permission checks."""
from fastapi import FastAPI, Header
from fastapi.testclient import TestClient
from app.db.session import get_session
from app.modules.admin.routes import router
from app.modules.auth.routes import get_current_admin
from app.modules.auth.models import AdminUser, Role
from app.modules.cms.models import Page, ContentTag
from app.modules.sites.models import Site, AdminUserSite
from conftest import make


def client_for(db):
    db.sync.add_all([
        Role(id=1, name="global", permissions=[]),
        Role(id=2, name="editor", permissions=["cms:read", "cms:write"]),
        Role(id=3, name="reader", permissions=["cms:read"]),
        Site(id=1, name="QA Main", slug="qa-main", default_locale="zh", settings={}),
        Site(id=2, name="QA Child", slug="qa-child", default_locale="zh", settings={}),
        make(AdminUser, id=1, email="editor@example.test", role_id=1),
        make(AdminUser, id=2, email="reader@example.test", role_id=1),
        AdminUserSite(admin_user_id=1, site_id=1, role_id=2),
        AdminUserSite(admin_user_id=1, site_id=2, role_id=3),
        AdminUserSite(admin_user_id=2, site_id=1, role_id=3),
    ])
    db.sync.commit()
    app = FastAPI()
    app.include_router(router, prefix="/admin")
    async def session():
        yield db
    async def admin(x_qa_user: int = Header(default=1)):
        return db.sync.get(AdminUser, x_qa_user)
    app.dependency_overrides[get_session] = session
    app.dependency_overrides[get_current_admin] = admin
    return TestClient(app)


def test_article_save_publish_and_readonly_isolation(db_session):
    client = client_for(db_session)
    payload = dict(title="本地文章", slug="qa-article", content_type="news", categories=["news", "experience"],
                   tags=["親子", "宜蘭"], body="本地測試內容", status="draft", translations={"zh": {"card_tags": "宜蘭"}})
    saved = client.post("/admin/cms/pages?site=qa-main", json=payload)
    assert saved.status_code == 201, saved.text
    ident = saved.json()["id"]
    assert client.patch(f"/admin/cms/pages/{ident}/status?site=qa-main", json={"status": "published"}).status_code == 200
    article = client.get(f"/admin/cms/pages/{ident}?site=qa-main").json()
    assert article["status"] == "published"
    assert set(article["categories"]) == {"news", "experience"}
    assert article["translations"]["zh"]["card_tags"] == "宜蘭"
    assert client.put(f"/admin/cms/pages/{ident}?site=qa-main", headers={"X-QA-User": "2"}, json=payload).status_code == 403
    assert client.get(f"/admin/cms/pages/{ident}?site=qa-child").status_code == 404
    assert client.post("/admin/cms/pages?site=qa-child", json=payload).status_code == 403
    assert db_session.sync.get(Page, ident).site_id == 1
    assert db_session.sync.get(Page, ident).status == "published"


def test_tag_rename_updates_only_exact_own_site_references(db_session):
    client = client_for(db_session)
    site = db_session.sync.get(Site, 1)
    site.settings = {"pages": {"news": {"content_type": "news", "sub_tabs": [{"tag": "family", "label": {"zh": "親子", "en": "Family"}}]}}, "homepage": {"blocks": [{"type": "stays", "config": {"source": "news", "filter_tags": ["親子"]}}]}}
    db_session.sync.add_all([
        ContentTag(id=1, site_id=1, slug="family", name_zh="親子", name_en="Family"),
        make(Page, id=1, site_id=1, slug="first", tags=["親子", "非親子"], body="親子原文不改", translations={"en": {"tags": "Family", "card_tags": "Family"}}),
        make(Page, id=2, site_id=2, slug="other", tags=["親子"], translations={}),
    ])
    db_session.sync.commit()
    response = client.put("/admin/cms/tags/1?site=qa-main", json={"name_zh": "家庭", "name_en": "Families", "slug": "families", "status": "active", "sort_order": 0})
    assert response.status_code == 200, response.text
    page = db_session.sync.get(Page, 1)
    assert page.tags == ["家庭", "非親子"]
    assert page.body == "親子原文不改"
    assert page.translations["en"] == {"tags": "Families", "card_tags": "Families"}
    assert db_session.sync.get(Page, 2).tags == ["親子"]
    assert site.settings["homepage"]["blocks"][0]["config"]["filter_tags"] == ["家庭"]
    assert site.settings["pages"]["news"]["content_type"] == "news"
    assert site.settings["pages"]["news"]["sub_tabs"][0]["tag"] == "families"


def test_shared_legacy_tag_names_are_not_reassigned(db_session):
    client = client_for(db_session)
    db_session.sync.add_all([
        ContentTag(id=1, site_id=1, slug="family", name_zh="親子", name_en="Family"),
        ContentTag(id=2, site_id=1, slug="kids", name_zh="親子", name_en="Kids"),
        make(Page, id=1, site_id=1, slug="first", tags=["親子", "family"], translations={}),
    ])
    db_session.sync.commit()
    response = client.put("/admin/cms/tags/1?site=qa-main", json={"name_zh": "家庭", "name_en": "Families", "slug": "families", "status": "active", "sort_order": 0})
    assert response.status_code == 200, response.text
    assert db_session.sync.get(Page, 1).tags == ["親子", "families"]
    assert db_session.sync.get(ContentTag, 2).name_zh == "親子"

def test_tag_archive_restore_status_and_permissions(db_session):
    client = client_for(db_session)
    db_session.sync.add(ContentTag(id=1, site_id=1, slug="qa-tag", name_zh="QA", name_en="QA", status="active"))
    db_session.sync.commit()
    endpoint = "/admin/cms/tags/1/status?site=qa-main"
    for status in ("archived", "active"):
        response = client.patch(endpoint, json={"status": status})
        assert response.status_code == 200, response.text
        assert response.json()["status"] == status
        assert db_session.sync.get(ContentTag, 1).status == status
    assert client.patch(endpoint, json={"status": "published"}).status_code == 422
    assert client.patch(endpoint, headers={"X-QA-User": "2"}, json={"status": "archived"}).status_code == 403
    assert client.patch("/admin/cms/tags/1/status?site=qa-child", json={"status": "archived"}).status_code == 403

def test_duplicate_subscriber_create_preserves_existing_data(db_session):
    from app.modules.email.models import NewsletterSubscriber
    client = client_for(db_session)
    db_session.sync.get(Role, 2).permissions = ["cms:read", "cms:write", "newsletter:write"]
    db_session.sync.add(NewsletterSubscriber(id=1, site_id=1, email="qa@example.test", name="Keep name", groups=["QA"], status="unsubscribed", unsubscribe_token="qa-token"))
    db_session.sync.commit()
    response = client.post("/admin/newsletter/subscribers?site=qa-main", json={"email": " QA@example.test ", "name": "", "groups": [], "status": "subscribed"})
    assert response.status_code == 409, response.text
    stored = db_session.sync.get(NewsletterSubscriber, 1)
    assert (stored.name, stored.groups, stored.status) == ("Keep name", ["QA"], "unsubscribed")
