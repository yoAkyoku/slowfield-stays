"""Loopback-only UX QA: authored records and an ephemeral SQLite database.

Run from backend with .venv/Scripts/python.exe ../scripts/admin_ux_server.py.
No production DB or outbound messages. All writes and uploads are local QA only.
"""
import os
import re
import sys
from pathlib import Path
os.environ["DATABASE_URL"] = "postgresql+asyncpg://qa:qa@127.0.0.1:1/unused_ux_test"
os.environ["APP_ENV"] = "test"
os.environ["SECRET_KEY"] = "local-ux-only-do-not-use-in-production-2026"
root = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(root / "backend"), str(root / "backend/tests")]
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from conftest import AsyncSessionFacade
from app.db.base import Base
from app.db.session import get_session
from app.api import api_router
from app.modules.auth.models import AdminUser, Role
from app.modules.auth.security import hash_password
from app.modules.cms.models import Page, ContentTag, Banner
from app.modules.sites.models import Site, AdminUserSite

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Base.metadata.create_all(engine)
maker = sessionmaker(bind=engine, expire_on_commit=False)
blocks = [{"id":"news", "type":"stays", "enabled":True, "config":{"source":"news", "extra_sources":["experience"], "headline":{"zh":"最新消息", "en":"News"}, "filter_by":"tags", "show_tags":True, "limit":6}}]
with maker() as db:
    permissions = [f"{module}:{action}" for module in ["cms","stays","media","inquiries","newsletter","site_users"] for action in ["read","write"]]
    db.add_all([Role(id=1,name="global",permissions=["sites:read","sites:write","global_users:read","global_users:write","roles:read","roles:write"]), Role(id=2,name="manager",permissions=permissions), Role(id=3,name="editor",permissions=["cms:read","cms:write"]),Role(id=4,name="reader",permissions=["cms:read"])])
    db.add_all([Site(id=1,name="本地 QA 主站",slug="slowfield",domain="localhost",settings={"homepage":{"blocks":blocks}, "pages":{"homepage":{"blocks":blocks},"news":{"page_type":"cms_list","content_type":"news","label":{"zh":"最新消息","en":"News"}},"experience":{"page_type":"cms_list","content_type":"experience","label":{"zh":"慢域體驗","en":"Experiences"}}}}),Site(id=2,name="本地 QA 子站",slug="qa-child",parent_site_id=1,settings={"pages":{"news":{"page_type":"cms_list","content_type":"news","label":{"zh":"子站消息","en":"Child news"}}}})])
    password = hash_password("local-qa")
    for ident,name,role in [(1,"manager",2),(2,"editor",3),(3,"reader",4)]:
        db.add(AdminUser(id=ident,email=f"{name}@example.com",name=f"QA {name}",password_hash=password,role_id=1 if name == "manager" else role))
        db.add(AdminUserSite(admin_user_id=ident,site_id=1,role_id=role))
        db.add(AdminUserSite(admin_user_id=ident,site_id=2,role_id=4))
    for ident,zh,en,slug in [(1,"親子","Family","family"),(2,"宜蘭","Yilan","yilan"),(3,"夏天","Summer","summer"),(4,"123","123","123")]:
        db.add(ContentTag(id=ident,site_id=1,name_zh=zh,name_en=en,slug=slug))
    article_count = 205 if os.environ.get("LOCAL_QA_DEEP_REVIEW") == "1" else 12
    for ident in range(1, article_count + 1):
        db.add(Page(id=ident,site_id=1,title=f"本地測試文章 {ident}",slug=f"qa-{ident}",body="本地撰寫的 QA 內容",summary="驗證文章分類、主題和卡片標籤。",content_type="news",categories=["news","experience"] if ident%2 else ["news"],tags=["親子","宜蘭"],status="draft" if ident%4==0 else "published",translations={"zh":{"title":f"本地測試文章 {ident}","body":"本地撰寫的 QA 內容","tags":"親子, 宜蘭","card_tags":"宜蘭"}}))
    db.add(Banner(id=1,site_id=1,title="本地首頁橫幅",image_url="/qa-image.svg",status="draft"))
    if os.environ.get("LOCAL_QA_DEEP_REVIEW") == "1":
        child = db.get(Site, 2)
        child.settings = {"pages": {"news": {"page_type": "cms_list", "content_type": "news", "extra_content_types": ["experience"], "label": {"zh": "子站多分類 QA", "en": "Child multi-category QA"}}}}
        for ident in range(206, 209):
            db.add(Page(id=ident,site_id=2,title=f"子站重複分類 QA {ident}",slug=f"qa-child-{ident}",body="隔離本地 QA",content_type="news",categories=["news","experience"],status="draft" if ident == 208 else "published"))
    db.commit()

app = FastAPI()
app.include_router(api_router,prefix="/api/v1")
async def local_session():
    with maker() as session:
        yield AsyncSessionFacade(session)
app.dependency_overrides[get_session] = local_session

# Real CRUD routers, local storage; retain existing account permission scope.
from fastapi.staticfiles import StaticFiles
from app.modules.email import service as email_service
from app.modules.stays.models import Stay
from app.modules.email.models import NewsletterSubscriber
from app.modules.media import routes as media_routes
from fastapi.middleware.cors import CORSMiddleware
import json
qa_storage=root / "artifacts/local-crud-qa/media"
qa_storage.mkdir(parents=True,exist_ok=True)
media_routes.MEDIA_ROOT=qa_storage
app.mount("/storage/media",StaticFiles(directory=str(qa_storage)),name="qa-media")
app.add_middleware(CORSMiddleware,allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
def capture_email(settings,to_email,subject,body,html=False):
    # Optional loopback QA fault injection; never enables an SMTP connection.
    fail_marker = os.environ.get("LOCAL_QA_FAIL_ONCE_FILE")
    if fail_marker and Path(fail_marker).is_file():
        Path(fail_marker).unlink()
        return False
    mail_dir=Path(os.environ.get("LOCAL_QA_MAIL_DIR", str(root / "artifacts/local-crud-qa/mail")))
    mail_dir.mkdir(parents=True,exist_ok=True)
    with (mail_dir / "outbox.jsonl").open("a",encoding="utf-8") as f:
        f.write(json.dumps(dict(to=to_email,subject=subject,body=body,html=html),ensure_ascii=False)+"\n")
    return True
email_service._send_email_sync=capture_email
with maker() as db:
    db.add(Stay(id=1,site_id=1,slug="qa-villa",name="本地 QA 住宿",destination="冬山鄉",region="宜蘭縣",summary="本地測試住宿介紹",story="本地 QA 品牌故事",hero_image_url="",base_price=12000,max_guests=12,status="published",tags=["親子"],facilities=["泳池"]))
    db.add(NewsletterSubscriber(site_id=1,email="qa-recipient@example.com",name="本地測試收件人",groups=["QA"],unsubscribe_token="local-qa-unsubscribe-token"))
    db.commit()

# Extra volume fixtures run in a separate process, preserving interactive CRUD QA.
if os.environ.get("LOCAL_QA_FULL_VARIANTS") == "1":
    from datetime import datetime, timezone
    from app.modules.inquiries.models import Inquiry
    from app.modules.bookings.models import BookingRequest
    from app.modules.email.models import NewsletterCampaign
    with maker() as db:
        volume_count = min(2000, max(1, int(os.environ.get("LOCAL_QA_VOLUME_COUNT", "205"))))
        for ident in range(1, volume_count + 1):
            stamp = datetime(2026, 10, 17, 16, 30, tzinfo=timezone.utc) if ident == 1 else datetime(2026, 10, 18, 1, 0, tzinfo=timezone.utc)
            db.add(Inquiry(site_id=1, name=f"CRUD QA volume inquiry {ident:03}", email=f"volume-{ident}@example.com", subject="CRUD QA volume", message=f"Authored fixture {ident}", source="partnership", created_at=stamp))
            db.add(BookingRequest(site_id=1, stay_id=1, name=f"CRUD QA volume booking {ident:03}", email=f"booking-volume-{ident}@example.com", message="Authored local QA", created_at=stamp))
            db.add(Stay(site_id=1, slug=f"crud-qa-volume-{ident}", name=f"CRUD QA volume stay {ident:03}", destination="冬山鄉", region="宜蘭縣", summary="隔離本地大量資料", hero_image_url="", base_price=1000, max_guests=2, status="draft"))
            db.add(Banner(site_id=1, title=f"CRUD QA volume banner {ident:03}", image_url="/qa-image.svg", status="draft"))
            db.add(NewsletterSubscriber(site_id=1, email=f"subscriber-volume-{ident}@example.com", name=f"CRUD QA subscriber {ident:03}", groups=["volume"], unsubscribe_token=f"local-qa-volume-{ident}"))
            db.add(NewsletterCampaign(site_id=1, subject=f"CRUD QA campaign {ident:03}", body="Authored local QA", status="draft"))
        db.commit()

if os.environ.get("LOCAL_QA_MAIL_TESTS") == "1":
    from app.modules.email.models import EmailSettings
    with maker() as db:
        db.add(EmailSettings(site_id=1, smtp_host="127.0.0.1", smtp_port=1,
                             from_email="qa-sender@example.com", from_name="CRUD QA Mail",
                             is_enabled=True, use_tls=False, daily_cap=0 if os.environ.get("LOCAL_QA_MAIL_PROGRESS") == "failed" else 2))
        for ident in range(2, 4):
            db.add(NewsletterSubscriber(site_id=1, email=f"qa-mail-{ident}@example.com", name=f"CRUD QA mail {ident}", groups=["QA"], unsubscribe_token=f"local-qa-mail-{ident}"))
        db.commit()
        if os.environ.get("LOCAL_QA_MAIL_PROGRESS") in {"1", "failed"}:
            from datetime import datetime, timezone
            from app.modules.email.models import NewsletterCampaign, NewsletterDelivery
            failed_variant = os.environ.get("LOCAL_QA_MAIL_PROGRESS") == "failed"
            db.add(NewsletterCampaign(id=1, site_id=1, subject="CRUD QA 寄送進度1018", body="<p>隔離進度變體</p>", status="sent" if failed_variant else "queued", target_groups=["QA"], sent_at=datetime(2026, 10, 18, 4, 0, tzinfo=timezone.utc) if failed_variant else None))
            db.flush()
            for ident, address in enumerate(["qa-recipient@example.com", "qa-mail-2@example.com", "qa-mail-3@example.com"], 1):
                db.add(NewsletterDelivery(site_id=1, campaign_id=1, subscriber_id=ident, email=address,
                                          status="sent" if ident < 3 else ("failed" if failed_variant else "pending"),
                                          sent_at=datetime.now(timezone.utc) if ident < 3 else None))
            db.commit()

if os.environ.get("LOCAL_QA_MEDIA_REFERENCE_URL"):
    from app.modules.media.models import MediaAsset
    from app.modules.email.models import NewsletterCampaign
    media_url = os.environ["LOCAL_QA_MEDIA_REFERENCE_URL"]
    with maker() as db:
        db.add(MediaAsset(id=1, site_id=1, url=media_url, storage_key=Path(media_url).name, display_name="CRUD QA stays-hero.jpg", alt_text="CRUD QA 圖片", mime_type="image/jpeg"))
        db.add(NewsletterCampaign(id=3, site_id=1, subject="CRUD QA 編輯器圖片引用1018", body=f'<p>本地引用變體</p><img src="{media_url}">', target_groups=["QA"], status="draft"))
        db.add(Page(id=13, site_id=1, title="CRUD QA 圖片引用文章1018", slug="crud-qa-media-reference-1018", body=f'<img src="{media_url}">', content_type="news", status="draft"))
        site = db.get(Site, 1)
        site.settings = {**site.settings, "homepage": {"blocks": [{"id": "qa-media-hero", "type": "hero_banner", "enabled": True, "config": {"images": [{"url": media_url}]}}]}}
        db.commit()

# Opt-in scheduler integration for authored local fixtures only.
if os.environ.get("LOCAL_QA_SCHEDULER_ENABLE_FILE"):
    import asyncio
    from contextlib import asynccontextmanager
    @asynccontextmanager
    async def qa_scheduler_session():
        with maker() as session:
            yield AsyncSessionFacade(session)
    async def qa_scheduler_loop():
        while True:
            if Path(os.environ["LOCAL_QA_SCHEDULER_ENABLE_FILE"]).is_file():
                result = await email_service.tick_scheduled_newsletters(qa_scheduler_session)
                if result["drained"]:
                    print("LOCAL_QA_SCHEDULER", result, flush=True)
            await asyncio.sleep(1)
    @app.on_event("startup")
    async def start_qa_scheduler():
        app.state.qa_scheduler = asyncio.create_task(qa_scheduler_loop())
    @app.on_event("shutdown")
    async def stop_qa_scheduler():
        app.state.qa_scheduler.cancel()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app,host="127.0.0.1",port=int(os.environ.get("LOCAL_QA_BACKEND_PORT", "8313")))
