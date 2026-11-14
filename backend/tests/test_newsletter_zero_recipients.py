from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.modules.admin.routes import (
    NewsletterScheduleRequest,
    process_newsletter_campaign,
    queue_newsletter_campaign,
    schedule_newsletter_campaign,
)
from app.modules.email.models import NewsletterCampaign, NewsletterDelivery, NewsletterSubscriber
from app.modules.sites.models import Site


def test_queueing_campaign_without_matching_subscribers_keeps_it_as_draft(db_session) -> None:
    site = Site(id=1, name="Local QA", slug="local-qa", parent_site_id=None, status="active")
    campaign = NewsletterCampaign(
        id=1,
        site_id=1,
        subject="Local QA no recipients",
        body="<p>Local fixture only</p>",
        status="draft",
        target_groups=["LOCAL QA"],
        recipient_scope="self",
        deleted_at=None,
    )
    db_session.sync.add_all([site, campaign])
    db_session.sync.commit()

    with pytest.raises(HTTPException) as raised:
        asyncio.run(queue_newsletter_campaign(campaign.id, site, db_session))

    assert raised.value.status_code == 400
    db_session.sync.refresh(campaign)
    assert campaign.status == "draft"
    deliveries = db_session.sync.execute(
        select(NewsletterDelivery).where(NewsletterDelivery.campaign_id == campaign.id)
    ).scalars().all()
    assert deliveries == []


def test_queueing_campaign_with_matching_subscriber_creates_one_delivery(db_session) -> None:
    site = Site(id=1, name="Local QA", slug="local-qa", parent_site_id=None, status="active")
    campaign = NewsletterCampaign(
        id=1, site_id=1, subject="Local QA recipient", body="Hello", status="draft",
        target_groups=["LOCAL QA"], recipient_scope="self", deleted_at=None,
    )
    subscriber = NewsletterSubscriber(
        id=10, site_id=1, email="qa-recipient@example.test", status="subscribed",
        groups=["LOCAL QA"], unsubscribe_token="local-qa-token", deleted_at=None,
    )
    db_session.sync.add_all([site, campaign, subscriber])
    db_session.sync.commit()

    result = asyncio.run(queue_newsletter_campaign(campaign.id, site, db_session))

    assert result == {"id": 1, "queued": 1, "status": "queued"}
    db_session.sync.refresh(campaign)
    assert campaign.status == "queued"
    deliveries = db_session.sync.execute(
        select(NewsletterDelivery).where(NewsletterDelivery.campaign_id == campaign.id)
    ).scalars().all()
    assert len(deliveries) == 1
    assert deliveries[0].email == subscriber.email


def test_scheduling_campaign_without_pending_recipients_is_rejected(db_session) -> None:
    site = Site(id=1, name="Local QA", slug="local-qa", parent_site_id=None, status="active")
    campaign = NewsletterCampaign(
        id=1, site_id=1, subject="Local QA empty schedule", body="Hello", status="queued",
        target_groups=[], recipient_scope="self", deleted_at=None,
    )
    db_session.sync.add_all([site, campaign])
    db_session.sync.commit()
    payload = NewsletterScheduleRequest(scheduled_at=datetime.now(UTC) + timedelta(days=1))

    with pytest.raises(HTTPException) as raised:
        asyncio.run(schedule_newsletter_campaign(campaign.id, payload, site, db_session))

    assert raised.value.status_code == 400
    db_session.sync.refresh(campaign)
    assert campaign.status == "queued"


def test_processing_campaign_without_pending_recipients_is_rejected(db_session) -> None:
    site = Site(id=1, name="Local QA", slug="local-qa", parent_site_id=None, status="active")
    campaign = NewsletterCampaign(
        id=1, site_id=1, subject="Local QA empty send", body="Hello", status="queued",
        target_groups=[], recipient_scope="self", deleted_at=None,
    )
    db_session.sync.add_all([site, campaign])
    db_session.sync.commit()

    with pytest.raises(HTTPException) as raised:
        asyncio.run(process_newsletter_campaign(campaign.id, site, db_session))

    assert raised.value.status_code == 400
    db_session.sync.refresh(campaign)
    assert campaign.status == "queued"
