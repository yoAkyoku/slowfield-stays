"""發送時間 has to come back from the API, not just be written to the row.

`process_newsletter_queue` stamps `campaign.sent_at` when a campaign's queue
drains, and the admin list has a 發送時間 column for it — but the campaign
serialiser never included the field. The column therefore showed "—" for every
campaign ever sent, which reads as "this never went out" rather than "we forgot
to send you the value".
"""

from datetime import UTC, datetime

from app.modules.admin.routes import _campaign_payload
from app.modules.email.models import NewsletterCampaign

SENT = datetime(2026, 8, 23, 2, 14, 56, tzinfo=UTC)


def _campaign(**over) -> NewsletterCampaign:
    fields = {
        "id": 15, "site_id": 1, "subject": "排程寄送", "body": "<p>x</p>",
        "status": "sent", "target_groups": [],
    }
    fields.update(over)
    return NewsletterCampaign(**fields)


def test_a_sent_campaign_reports_when_it_went_out() -> None:
    payload = _campaign_payload(_campaign(sent_at=SENT), deliveries=1)

    assert payload["sent_at"] == SENT


def test_an_unsent_campaign_carries_the_field_as_null() -> None:
    """Present-and-null, not absent: the column checks the key."""
    payload = _campaign_payload(_campaign(status="draft"), deliveries=0)

    assert "sent_at" in payload
    assert payload["sent_at"] is None


def test_the_other_timestamps_still_come_back() -> None:
    """Guard against fixing one field by disturbing its neighbours."""
    queued = datetime(2026, 8, 23, 2, 12, 56, tzinfo=UTC)
    scheduled = datetime(2026, 8, 23, 2, 14, 0, tzinfo=UTC)
    payload = _campaign_payload(
        _campaign(sent_at=SENT, queued_at=queued, scheduled_at=scheduled), deliveries=1
    )

    assert payload["queued_at"] == queued
    assert payload["scheduled_at"] == scheduled
    assert payload["sent_at"] == SENT
