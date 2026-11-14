from datetime import UTC, datetime

import pytest

from app.modules.email import service
from app.modules.email.models import EmailSettings, NewsletterCampaign, NewsletterDelivery, NewsletterSubscriber


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _ExecuteResult:
    def __init__(self, items):
        self._items = items

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None

    def scalars(self):
        return _ScalarResult(self._items)

    def all(self):
        return self._items


def _selected_names(statement) -> set[str]:
    """The output column names of a select, for dispatching on the statement."""
    try:
        return {str(c.get("name")) for c in statement.column_descriptions}
    except Exception:  # pragma: no cover - not a select
        return set()


class _FakeSession:
    def __init__(self, *, settings, deliveries, subscribers=None, campaigns=None):
        self.settings = settings
        self.deliveries = deliveries
        self.subscribers = subscribers or {}
        self.campaigns = campaigns or {}
        self.execute_calls = 0
        self.committed = False

    async def execute(self, statement):
        self.execute_calls += 1
        # The campaign-drain aggregate is answered from the rows this fake
        # holds, dispatching on the STATEMENT rather than on call order. It
        # returns (campaign_id, outstanding, delivered) tuples, so handing it
        # the delivery list would make the caller unpack a model as a 3-tuple.
        if "outstanding" in _selected_names(statement):
            per_campaign: dict[int, list[int]] = {}
            for delivery in self.deliveries:
                slot = per_campaign.setdefault(delivery.campaign_id, [0, 0])
                if delivery.status in ("pending", "sending"):
                    slot[0] += 1
                elif delivery.status == "sent":
                    slot[1] += 1
            return _ExecuteResult([(cid, out, done) for cid, (out, done) in per_campaign.items()])
        if self.execute_calls == 1 and self.settings is not None:
            return _ExecuteResult([self.settings])
        return _ExecuteResult(self.deliveries)

    async def get(self, model, item_id):
        if model is NewsletterSubscriber:
            return self.subscribers.get(item_id)
        if model is NewsletterCampaign:
            return self.campaigns.get(item_id)
        return None

    async def commit(self):
        self.committed = True


def _settings(**overrides):
    values = {
        "site_id": 1,
        "is_enabled": True,
        "smtp_host": "smtp.example.com",
        "smtp_port": 587,
        "from_email": "hello@example.com",
        "from_name": "Slowfield Stays",
    }
    values.update(overrides)
    return EmailSettings(**values)


def _delivery(**overrides):
    values = {
        "id": 1,
        "site_id": 1,
        "campaign_id": 10,
        "subscriber_id": 20,
        "email": "guest@example.com",
        "status": "pending",
    }
    values.update(overrides)
    return NewsletterDelivery(**values)


def test_email_image_urls_are_absolute_for_html_messages():
    html = (
        '<p>Summer</p><img src="/storage/media/hero.jpg" alt="Hero">'
        '<img src="https://cdn.example/other.jpg" alt="Other">'
    )

    rendered = service._absolutize_email_image_urls(html, "https://villa.example")

    assert 'src="https://villa.example/storage/media/hero.jpg"' in rendered
    assert 'src="https://cdn.example/other.jpg"' in rendered


def test_clipboard_fragment_markers_are_removed_before_email_rendering():
    body = "<!--StartFragment--><p>Summer</p>&lt;!--EndFragment--&gt;"
    assert service.strip_clipboard_fragment_markers(body) == "<p>Summer</p>"
    assert "Fragment" not in service._html_to_text(body)
    assert "Fragment" not in service._absolutize_email_image_urls(body, "https://villa.example")


def test_newsletter_email_document_is_fluid_and_caps_authored_images():
    rendered = service._prepare_newsletter_email_body(
        '<p><!--EndFragment--></p><img loading="lazy" src="/storage/media/hero.jpg" alt="Hero">',
        "https://villa.example",
    )
    assert 'max-width:640px' in rendered
    assert 'src="https://villa.example/storage/media/hero.jpg"' in rendered
    assert "width: 100%" in rendered
    assert "height: auto" in rendered
    assert 'loading="lazy"' not in rendered
    assert "Fragment" not in rendered


@pytest.mark.asyncio
async def test_process_newsletter_queue_skips_unsubscribed_subscriber():
    delivery = _delivery()
    subscriber = NewsletterSubscriber(id=20, site_id=1, email="guest@example.com", status="unsubscribed")
    session = _FakeSession(settings=_settings(), deliveries=[delivery], subscribers={20: subscriber})

    result = await service.process_newsletter_queue(session, site_id=1)

    assert (result["sent"], result["failed"], result["skipped"]) == (0, 0, 1)
    assert delivery.status == "skipped"
    assert delivery.error == "Subscriber is unsubscribed"
    assert session.committed is True


@pytest.mark.asyncio
async def test_process_newsletter_queue_skips_deleted_subscriber():
    delivery = _delivery()
    subscriber = NewsletterSubscriber(
        id=20,
        site_id=1,
        email="guest@example.com",
        status="subscribed",
        deleted_at=datetime.now(UTC),
    )
    session = _FakeSession(settings=_settings(), deliveries=[delivery], subscribers={20: subscriber})

    result = await service.process_newsletter_queue(session, site_id=1)

    assert (result["sent"], result["failed"], result["skipped"]) == (0, 0, 1)
    assert delivery.status == "skipped"
    assert delivery.error == "Subscriber is deleted"


@pytest.mark.asyncio
async def test_process_newsletter_queue_marks_incomplete_smtp_as_failed():
    delivery = _delivery()
    subscriber = NewsletterSubscriber(
        id=20,
        site_id=1,
        email="guest@example.com",
        status="subscribed",
        unsubscribe_token="token-123",
    )
    campaign = NewsletterCampaign(
        id=10,
        site_id=1,
        subject="May edit",
        body="Hello",
        status="queued",
    )
    session = _FakeSession(
        settings=_settings(is_enabled=False),
        deliveries=[delivery],
        subscribers={20: subscriber},
        campaigns={10: campaign},
    )

    result = await service.process_newsletter_queue(session, site_id=1)

    assert (result["sent"], result["failed"], result["skipped"]) == (0, 1, 0)
    assert delivery.status == "failed"
    assert delivery.error == "Email settings are disabled or incomplete"


@pytest.mark.asyncio
async def test_process_newsletter_queue_skips_deleted_campaign():
    delivery = _delivery()
    subscriber = NewsletterSubscriber(
        id=20,
        site_id=1,
        email="guest@example.com",
        status="subscribed",
        unsubscribe_token="token-123",
    )
    campaign = NewsletterCampaign(
        id=10,
        site_id=1,
        subject="May edit",
        body="Hello",
        status="queued",
        deleted_at=datetime.now(UTC),
    )
    session = _FakeSession(
        settings=_settings(),
        deliveries=[delivery],
        subscribers={20: subscriber},
        campaigns={10: campaign},
    )

    result = await service.process_newsletter_queue(session, site_id=1)

    assert (result["sent"], result["failed"], result["skipped"]) == (0, 0, 1)
    assert delivery.status == "skipped"
    assert delivery.error == "Campaign is deleted"


@pytest.mark.asyncio
async def test_process_newsletter_queue_appends_absolute_unsubscribe_url(monkeypatch):
    captured = {}
    delivery = _delivery()
    subscriber = NewsletterSubscriber(
        id=20,
        site_id=1,
        email="guest@example.com",
        status="subscribed",
        unsubscribe_token="token-123",
    )
    campaign = NewsletterCampaign(
        id=10,
        site_id=1,
        subject="May edit",
        body='<p>Hello</p><img src="/storage/media/hero.jpg" alt="Hero">',
        status="queued",
    )
    session = _FakeSession(
        settings=_settings(),
        deliveries=[delivery],
        subscribers={20: subscriber},
        campaigns={10: campaign},
    )

    def fake_send_email(settings, to_email, subject, body, html=False):
        captured.update({"to_email": to_email, "subject": subject, "body": body, "settings": settings, "html": html})
        return True

    # send_email_async delegates to _send_email_sync via asyncio.to_thread,
    # so patch the sync core that both code paths funnel through.
    monkeypatch.setattr(service, "_send_email_sync", fake_send_email)

    result = await service.process_newsletter_queue(session, site_id=1)

    assert (result["sent"], result["failed"], result["skipped"]) == (1, 0, 0)
    assert delivery.status == "sent"
    assert delivery.sent_at is not None
    assert "http://localhost:3000/newsletter/unsubscribe?token=token-123" in captured["body"]
    assert 'src="http://localhost:3000/storage/media/hero.jpg"' in captured["body"]
    # Newsletters go out as HTML so <br> renders instead of showing literally.
    assert captured["html"] is True
    # All deliveries drained with a successful send -> campaign promoted to "sent".
    assert campaign.status == "sent"
    assert campaign.sent_at is not None


@pytest.mark.asyncio
async def test_process_newsletter_queue_leaves_campaign_queued_when_all_sends_fail(monkeypatch):
    delivery = _delivery()
    subscriber = NewsletterSubscriber(
        id=20,
        site_id=1,
        email="guest@example.com",
        status="subscribed",
        unsubscribe_token="token-123",
    )
    campaign = NewsletterCampaign(id=10, site_id=1, subject="May edit", body="Hello", status="queued")
    session = _FakeSession(
        settings=_settings(),
        deliveries=[delivery],
        subscribers={20: subscriber},
        campaigns={10: campaign},
    )

    def fail_send(settings, to_email, subject, body, html=False):
        return False

    monkeypatch.setattr(service, "_send_email_sync", fail_send)

    result = await service.process_newsletter_queue(session, site_id=1)

    assert (result["sent"], result["failed"], result["skipped"]) == (0, 1, 0)
    assert delivery.status == "failed"
    # No successful send -> campaign stays queued so retry-failed remains usable.
    assert campaign.status == "queued"


def test_html_to_text_converts_breaks_and_strips_tags():
    html = "Hello<br><br>World<br><a href=\"https://x.test\">Link</a> &amp; more"
    text = service._html_to_text(html)
    assert "<br>" not in text
    assert "<a" not in text
    assert "Hello\n\nWorld" in text
    assert "& more" in text  # entity unescaped


@pytest.mark.asyncio
async def test_retry_failed_newsletter_deliveries_moves_failed_items_to_pending():
    failed_delivery = _delivery(status="failed", error="SMTP timeout", sent_at=datetime.now(UTC))
    session = _FakeSession(settings=None, deliveries=[failed_delivery])

    result = await service.retry_failed_newsletter_deliveries(session, site_id=1)

    assert result == {"retried": 1}
    assert failed_delivery.status == "pending"
    assert failed_delivery.error == ""
    assert failed_delivery.sent_at is None
    assert session.committed is True
