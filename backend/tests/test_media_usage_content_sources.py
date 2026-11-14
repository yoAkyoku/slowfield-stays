import asyncio

from conftest import make
from app.modules.admin.routes import media_usage
from app.modules.cms.models import Page
from app.modules.email.models import NewsletterCampaign
from app.modules.media.models import MediaAsset
from app.modules.sites.models import Site


def test_usage_covers_newsletter_html_page_body_and_website_settings(db_session):
    db = db_session.sync
    url = "/storage/media/qa_image.jpg"
    site = Site(id=1, name="Root", slug="root", settings={"logo": url})
    db.add_all([site, Site(id=2, name="Child", slug="child", parent_site_id=1, settings={"logo": url}), Site(id=3, name="Other", slug="other", settings={"logo": url})])
    db.add(make(MediaAsset, id=1, site_id=1, url=url))
    db.add(make(NewsletterCampaign, site_id=1, subject="QA newsletter", body=f'<img src="http://localhost{url}">', status="draft"))
    db.add(make(Page, site_id=1, title="HTML page", slug="qa", body=f'<img src="{url}">'))
    db.add(make(Page, site_id=1, title="Not literal", slug="not-literal", body='<img src="/storage/media/qaXimage.jpg">'))
    db.add(make(NewsletterCampaign, site_id=3, subject="Other tenant", body=f'<img src="{url}">', status="draft"))
    db.commit()
    result = asyncio.run(media_usage(1, site, db_session))
    uses = {(item["kind"], item["title"]) for item in result["usages"]}
    assert uses == {("newsletter", "QA newsletter"), ("page", "HTML page"), ("site", "Root"), ("site", "Child")}
