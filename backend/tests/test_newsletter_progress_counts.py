import asyncio

from conftest import make
from app.modules.admin.routes import manage_newsletter_campaigns
from app.modules.email.models import NewsletterCampaign, NewsletterDelivery
from app.modules.sites.models import Site
from app.modules.email import service


def test_campaign_list_counts_actual_delivery_states_and_keeps_site_scope(db_session):
    db = db_session.sync
    site = Site(id=1, name="QA", slug="qa")
    db.add_all([site, Site(id=2, name="Other", slug="other")])
    db.add(make(NewsletterCampaign, id=10, site_id=1, subject="QA", body="QA", status="queued"))
    db.add(make(NewsletterCampaign, id=20, site_id=2, subject="Other", body="QA", status="sent"))
    for ident, status in enumerate(["sent", "sent", "pending", "sending", "failed", "skipped"], 1):
        db.add(make(NewsletterDelivery, id=ident, site_id=1, campaign_id=10, email=f"qa-{ident}@example.com", status=status))
    db.add(make(NewsletterDelivery, id=20, site_id=2, campaign_id=20, email="other@example.com", status="sent"))
    db.commit()
    rows = asyncio.run(manage_newsletter_campaigns(skip=0, limit=500, site=site, visibility="active", session=db_session))
    assert len(rows) == 1
    row = rows[0]
    assert row["deliveries"] == 6
    assert row["sent_count"] == 2
    assert row["pending_count"] == 2
    assert row["failed_count"] == 1
    assert row["skipped_count"] == 1


def test_retry_reopens_a_completed_campaign_without_resending_successes(db_session, monkeypatch):
    from datetime import UTC, datetime
    from app.modules.email.models import EmailSettings, NewsletterSubscriber
    db = db_session.sync
    db.add(Site(id=1, name="QA", slug="qa"))
    db.add(make(EmailSettings, site_id=1, is_enabled=True, smtp_host="local", smtp_port=1, from_email="qa@example.com", from_name="QA", daily_cap=0))
    campaign = make(NewsletterCampaign, id=10, site_id=1, subject="QA", body="QA", status="sent", sent_at=datetime.now(UTC))
    db.add(campaign)
    for ident, status in enumerate(["sent", "sent", "failed"], 1):
        db.add(make(NewsletterSubscriber, id=ident, site_id=1, email=f"qa-{ident}@example.com", status="subscribed", unsubscribe_token=f"qa-{ident}"))
        db.add(make(NewsletterDelivery, id=ident, site_id=1, campaign_id=10, subscriber_id=ident, email=f"qa-{ident}@example.com", status=status))
    db.commit()
    sent_to = []
    def capture(settings, to_email, *args, **kwargs):
        sent_to.append(to_email)
        return True
    monkeypatch.setattr(service, "_send_email_sync", capture)
    assert asyncio.run(service.retry_failed_newsletter_deliveries(db_session, 1)) == {"retried": 1}
    assert campaign.status == "queued"
    assert campaign.sent_at is None
    result = asyncio.run(service.process_newsletter_queue(db_session, 1))
    assert result["sent"] == 1
    assert sent_to == ["qa-3@example.com"]
    assert campaign.status == "sent"
