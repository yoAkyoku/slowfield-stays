"""List-Unsubscribe, per-site unsubscribe domains, and the localised footer.

Nothing here sends mail: the SMTP class is replaced with a recorder, and the
queue tests run against in-memory session doubles. What they check is the
message that *would* have gone out, and the promise its headers make.
"""

import smtplib
from datetime import UTC, datetime

import pytest

from app.core.config import settings as app_settings
from app.modules.email import service
from app.modules.email.models import EmailSettings, NewsletterCampaign, NewsletterDelivery, NewsletterSubscriber
from app.modules.newsletter import routes as newsletter_routes
from app.modules.sites.models import Site


# ---------------------------------------------------------------------------
# doubles
# ---------------------------------------------------------------------------

class _RecordingSMTP:
    """Stands in for smtplib.SMTP and keeps the messages handed to it."""

    sent: list = []

    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        pass

    def login(self, username, password):  # pragma: no cover - not reached in these tests
        raise AssertionError("these tests never configure credentials")

    def send_message(self, message):
        type(self).sent.append(message)


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


class _QueueSession:
    """Enough AsyncSession for process_newsletter_queue: settings, then rows."""

    def __init__(self, *, settings, deliveries, subscribers=None, campaigns=None, sites=None):
        self.settings = settings
        self.deliveries = deliveries
        self.subscribers = subscribers or {}
        self.campaigns = campaigns or {}
        self.sites = sites or {}
        self.execute_calls = 0
        self.committed = False

    async def execute(self, statement):
        self.execute_calls += 1
        # The campaign-drain aggregate returns (campaign_id, outstanding,
        # delivered) tuples, so it is answered from the rows this fake holds
        # rather than by call order — handing it the delivery list would make
        # the caller unpack a model as a 3-tuple.
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
        if model is Site:
            return self.sites.get(item_id)
        return None

    async def commit(self):
        self.committed = True


class _TokenSession:
    """Token lookup only — what the unsubscribe routes need."""

    def __init__(self, subscriber=None, site=None):
        self.subscriber = subscriber
        self.site = site
        self.committed = False

    async def execute(self, _statement):
        return _ExecuteResult([self.subscriber] if self.subscriber else [])

    async def get(self, _model, _item_id):
        return self.site

    async def commit(self):
        self.committed = True


class _Request:
    def __init__(self, body: bytes = b"", headers=None):
        self._body = body
        self.headers = headers or {}
        self.client = type("C", (), {"host": "209.85.220.41"})()

    async def body(self):
        return self._body


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


def _run_queue(monkeypatch, *, site, token="token-123", body="<p>Hello</p>", subscriber=None):
    """Drain a one-delivery queue and hand back the captured send arguments."""
    captured = {}

    def fake_send(settings, to_email, subject, message_body, html=False):
        captured.update({"body": message_body, "html": html, "to_email": to_email})
        captured["headers"] = dict(service._extra_headers.get())
        return True

    monkeypatch.setattr(service, "_send_email_sync", fake_send)
    subscriber = subscriber or NewsletterSubscriber(
        id=20,
        site_id=site.id if site is not None else None,
        email="guest@example.com",
        status="subscribed",
        unsubscribe_token=token,
    )
    delivery = NewsletterDelivery(
        id=1, site_id=1, campaign_id=10, subscriber_id=20, email="guest@example.com", status="pending"
    )
    campaign = NewsletterCampaign(id=10, site_id=1, subject="八月", body=body, status="queued")
    session = _QueueSession(
        settings=_settings(),
        deliveries=[delivery],
        subscribers={20: subscriber},
        campaigns={10: campaign},
        sites={site.id: site} if site is not None else {},
    )
    return captured, session, delivery


def _site(**over) -> Site:
    fields = {"id": 7, "name": "Hejing Villa", "slug": "hejing", "default_locale": "zh"}
    fields.update(over)
    return Site(**fields)


# ---------------------------------------------------------------------------
# 1. List-Unsubscribe / List-Unsubscribe-Post reach the wire
# ---------------------------------------------------------------------------

def test_extra_headers_land_on_the_built_message(monkeypatch):
    """The pair has to be on the MIME message, not merely computed somewhere."""
    _RecordingSMTP.sent = []
    monkeypatch.setattr(smtplib, "SMTP", _RecordingSMTP)
    url = "https://hejing.com/api/v1/newsletter/unsubscribe/one-click?token=abc"

    with service.outbound_headers(service.unsubscribe_headers(url)):
        assert service._send_email_sync(_settings(), "guest@example.com", "八月", "<p>hi</p>", html=True)

    message = _RecordingSMTP.sent[-1]
    assert message["List-Unsubscribe"] == f"<{url}>"
    assert message["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"


def test_a_long_uri_is_written_verbatim_not_as_encoded_words(monkeypatch):
    """The failure this guards is silent and total.

    `email.policy.default` folds an unrecognised header at 78 columns; a URI has
    no whitespace to fold at, so the folder reaches for RFC 2047 and emits
    `List-Unsubscribe: =?utf-8?q?=3Chttps=3A//…?=`. That is not a URI, it is
    illegal in a structured header, and no provider parses it — the header is
    present and does nothing. Every real unsubscribe URL is long enough.
    """
    _RecordingSMTP.sent = []
    monkeypatch.setattr(smtplib, "SMTP", _RecordingSMTP)
    url = service.one_click_unsubscribe_url("https://hejing.com", "u4Xr-9QaZ_2bT7kLmN0pVwSyD")
    assert len(url) > 78, "this test is pointless unless the header needs folding"

    with service.outbound_headers(service.unsubscribe_headers(url)):
        # A non-ASCII subject as well, so the message really does need encoding
        # somewhere and we are not just observing an all-ASCII shortcut.
        service._send_email_sync(_settings(), "guest@example.com", "八月訊息", "<p>hi</p>", html=True)

    raw = _RecordingSMTP.sent[-1].as_string()
    assert f"List-Unsubscribe: <{url}>" in raw
    header_line = next(line for line in raw.splitlines() if line.startswith("List-Unsubscribe:"))
    assert "=?" not in header_line
    # …while the headers that are supposed to be encoded still are.
    assert any(line.startswith("Subject: =?") for line in raw.splitlines())


def test_headers_do_not_leak_into_the_next_message(monkeypatch):
    """The block is per-message; a transactional mail must not inherit them."""
    _RecordingSMTP.sent = []
    monkeypatch.setattr(smtplib, "SMTP", _RecordingSMTP)

    with service.outbound_headers(service.unsubscribe_headers("https://x.test/u?token=a")):
        service._send_email_sync(_settings(), "a@example.com", "s", "b")
    service._send_email_sync(_settings(), "b@example.com", "s", "b")

    assert _RecordingSMTP.sent[0]["List-Unsubscribe"] is not None
    assert _RecordingSMTP.sent[1]["List-Unsubscribe"] is None


def test_a_header_value_cannot_forge_another_header(monkeypatch):
    """Site.domain is free text an admin types; CR/LF in it must not survive."""
    _RecordingSMTP.sent = []
    monkeypatch.setattr(smtplib, "SMTP", _RecordingSMTP)

    with service.outbound_headers({"List-Unsubscribe": "<https://x.test>\r\nBcc: leak@evil.test"}):
        assert service._send_email_sync(_settings(), "guest@example.com", "s", "b")

    message = _RecordingSMTP.sent[-1]
    assert message["Bcc"] is None
    assert "\r" not in message["List-Unsubscribe"] and "\n" not in message["List-Unsubscribe"]


@pytest.mark.asyncio
async def test_queue_sends_both_headers(monkeypatch):
    captured, session, delivery = _run_queue(monkeypatch, site=_site(domain="hejing.com"))

    result = await service.process_newsletter_queue(session, site_id=1)

    assert result["sent"] == 1
    assert delivery.status == "sent"
    assert captured["headers"]["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert captured["headers"]["List-Unsubscribe"] == (
        "<https://hejing.com/api/v1/newsletter/unsubscribe/one-click?token=token-123>"
    )


def test_the_advertised_one_click_uri_is_a_route_that_accepts_post():
    """The promise and the endpoint must not drift apart.

    List-Unsubscribe-Post says "POST here and it unsubscribes". If the path in
    the header ever stops matching a real POST route, providers get a 404/405
    and read it as a broken sender — invisibly, because nothing in this app
    would notice.
    """
    url = service.one_click_unsubscribe_url("https://hejing.com", "token-123")

    path = url.split("?")[0].removeprefix("https://hejing.com")
    path = path.removeprefix(app_settings.api_v1_prefix.rstrip("/"))
    path = path.removeprefix("/newsletter")
    registered = {
        (route.path, method)
        for route in newsletter_routes.router.routes
        for method in getattr(route, "methods", ())
    }
    assert (path, "POST") in registered


# ---------------------------------------------------------------------------
# 2. the link carries the subscriber's own site domain
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_child_site_subscriber_gets_their_own_domain(monkeypatch):
    captured, session, _ = _run_queue(monkeypatch, site=_site(domain="hejing.com"))

    await service.process_newsletter_queue(session, site_id=1)

    assert "https://hejing.com/newsletter/unsubscribe?token=token-123" in captured["body"]
    assert app_settings.frontend_url not in captured["body"]


@pytest.mark.asyncio
async def test_a_site_without_a_usable_domain_falls_back_to_frontend_url(monkeypatch):
    """`localhost`, and the child sites served as a path under the parent."""
    captured, session, _ = _run_queue(monkeypatch, site=_site(domain="localhost"))

    await service.process_newsletter_queue(session, site_id=1)

    expected = f"{app_settings.frontend_url.rstrip('/')}/newsletter/unsubscribe?token=token-123"
    assert expected in captured["body"]


@pytest.mark.asyncio
async def test_a_site_row_that_cannot_be_loaded_falls_back(monkeypatch):
    captured, session, _ = _run_queue(monkeypatch, site=None)

    await service.process_newsletter_queue(session, site_id=1)

    assert app_settings.frontend_url.rstrip("/") in captured["body"]


@pytest.mark.parametrize(
    "domain",
    ["", "   ", "localhost", "app.localhost", "127.0.0.1", "villa.local", "not a domain", "-bad.com"],
)
def test_domains_that_are_not_public_hostnames_are_refused(domain):
    assert service.site_public_base_url(_site(domain=domain)) is None


@pytest.mark.parametrize(
    "domain,expected",
    [
        ("hejing.com", "https://hejing.com"),
        ("WWW.SlowfieldStays.com", "https://www.slowfieldstays.com"),
        ("stay.hejing.co.uk", "https://stay.hejing.co.uk"),
    ],
)
def test_public_domains_become_https_origins(domain, expected):
    assert service.site_public_base_url(_site(domain=domain)) == expected


# ---------------------------------------------------------------------------
# 3. the footer follows the site's language
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize(
    "locale,expected,unexpected",
    [("zh", "取消訂閱", "Unsubscribe"), ("en", "Unsubscribe", "取消訂閱")],
)
async def test_footer_uses_the_sites_locale(monkeypatch, locale, expected, unexpected):
    captured, session, _ = _run_queue(
        monkeypatch, site=_site(domain="hejing.com", default_locale=locale)
    )

    await service.process_newsletter_queue(session, site_id=1)

    assert f">{expected}</a>" in captured["body"]
    assert unexpected not in captured["body"]


@pytest.mark.asyncio
async def test_footer_stays_bilingual_when_the_locale_is_unusable(monkeypatch):
    """No site, no locale — say both rather than guess at the reader."""
    captured, session, _ = _run_queue(monkeypatch, site=None)

    await service.process_newsletter_queue(session, site_id=1)

    assert "Unsubscribe / 取消訂閱" in captured["body"]


def test_an_unrecognised_locale_is_not_silently_treated_as_english():
    assert service._unsubscribe_label(_site(default_locale="ja")) == service.BILINGUAL_UNSUBSCRIBE_LABEL
    assert service._unsubscribe_label(None) == service.BILINGUAL_UNSUBSCRIBE_LABEL


# ---------------------------------------------------------------------------
# 4. the one-click endpoint the header promises
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_one_click_post_unsubscribes_without_confirmation():
    subscriber = NewsletterSubscriber(id=20, site_id=7, email="g@example.com", status="subscribed")
    session = _TokenSession(subscriber)

    result = await newsletter_routes.one_click_unsubscribe(
        _Request(b"List-Unsubscribe=One-Click"), token="token-123", session=session
    )

    assert (result.ok, result.status) == (True, "unsubscribed")
    assert subscriber.status == "unsubscribed"
    assert session.committed is True


@pytest.mark.asyncio
async def test_one_click_post_still_works_without_the_rfc_body():
    """The header is a promise; a body we did not like is no reason to break it."""
    subscriber = NewsletterSubscriber(id=21, site_id=7, email="g@example.com", status="subscribed")
    session = _TokenSession(subscriber)

    result = await newsletter_routes.one_click_unsubscribe(
        _Request(b""), token="token-123", session=session
    )

    assert result.status == "unsubscribed"
    assert subscriber.status == "unsubscribed"


@pytest.mark.asyncio
async def test_one_click_post_is_idempotent():
    subscriber = NewsletterSubscriber(id=22, site_id=7, email="g@example.com", status="unsubscribed")
    session = _TokenSession(subscriber)

    result = await newsletter_routes.one_click_unsubscribe(
        _Request(b"List-Unsubscribe=One-Click"), token="token-123", session=session
    )

    assert result.status == "unsubscribed"


@pytest.mark.asyncio
async def test_one_click_post_rejects_an_unknown_token():
    from fastapi import HTTPException

    session = _TokenSession(None)
    with pytest.raises(HTTPException) as excinfo:
        await newsletter_routes.one_click_unsubscribe(
            _Request(b"List-Unsubscribe=One-Click"), token="nope", session=session
        )

    assert excinfo.value.status_code == 404
    assert session.committed is False


@pytest.mark.asyncio
async def test_a_get_on_the_one_click_uri_writes_nothing():
    """Scanners and preview fetchers follow GETs. This one must only redirect."""
    subscriber = NewsletterSubscriber(id=23, site_id=7, email="g@example.com", status="subscribed")
    session = _TokenSession(subscriber, site=_site(domain="hejing.com"))

    response = await newsletter_routes.one_click_unsubscribe_landing(
        token="token-123", session=session
    )

    assert response.status_code == 302
    assert response.headers["location"] == (
        "https://hejing.com/newsletter/unsubscribe?token=token-123"
    )
    assert subscriber.status == "subscribed"
    assert session.committed is False


def test_the_confirmation_page_has_no_get_route_that_writes():
    """The public unsubscribe endpoint stays POST-only, on purpose."""
    methods = {
        method
        for route in newsletter_routes.router.routes
        if getattr(route, "path", None) == "/unsubscribe"
        for method in getattr(route, "methods", ())
    }
    assert methods == {"POST"}


# ---------------------------------------------------------------------------
# 5. plain-text alternative
# ---------------------------------------------------------------------------

def test_plain_text_keeps_the_unsubscribe_target():
    """Stripping <a> tags left the text/plain part with no link to act on."""
    text = service._html_to_text(
        '<p>Hi</p><a href="https://hejing.com/newsletter/unsubscribe?token=t">取消訂閱</a>'
    )

    assert "https://hejing.com/newsletter/unsubscribe?token=t" in text
    assert "<a" not in text


def test_plain_text_drops_style_and_script_contents():
    text = service._html_to_text(
        "<style>.x{color:red}</style><script>alert(1)</script><p>Hello</p>"
    )

    assert text == "Hello"


@pytest.mark.asyncio
async def test_the_text_part_of_a_real_send_carries_the_link(monkeypatch):
    _RecordingSMTP.sent = []
    monkeypatch.setattr(smtplib, "SMTP", _RecordingSMTP)
    url = service.one_click_unsubscribe_url("https://hejing.com", "token-123")
    page = service.unsubscribe_page_url("https://hejing.com", "token-123")

    await service.send_email_async(
        _settings(),
        "guest@example.com",
        "八月",
        f'<p>Hello</p><br><br><a href="{page}">取消訂閱</a>',
        html=True,
        extra_headers=service.unsubscribe_headers(url),
    )

    message = _RecordingSMTP.sent[-1]
    plain = message.get_body(preferencelist=("plain",)).get_content()
    assert page in plain
    assert message["List-Unsubscribe"] == f"<{url}>"


# ---------------------------------------------------------------------------
# 6. never send bulk mail nobody can stop
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_a_recipient_with_no_token_is_skipped_not_mailed(monkeypatch):
    """`purge_subscriber` clears subscriber_id and leaves the delivery row."""
    sends = []

    def fake_send(settings, to_email, subject, body, html=False):
        sends.append(to_email)
        return True

    monkeypatch.setattr(service, "_send_email_sync", fake_send)
    delivery = NewsletterDelivery(
        id=1, site_id=1, campaign_id=10, subscriber_id=None, email="ghost@example.com", status="pending"
    )
    campaign = NewsletterCampaign(id=10, site_id=1, subject="八月", body="<p>x</p>", status="queued")
    session = _QueueSession(
        settings=_settings(), deliveries=[delivery], campaigns={10: campaign}
    )

    result = await service.process_newsletter_queue(session, site_id=1)

    assert sends == []
    assert (result["sent"], result["skipped"]) == (0, 1)
    assert delivery.status == "skipped"
    assert delivery.error == "No unsubscribe token for this recipient"


@pytest.mark.asyncio
async def test_a_sent_delivery_is_still_stamped(monkeypatch):
    """Guard the happy path against the skip above swallowing real recipients."""
    _, session, delivery = _run_queue(monkeypatch, site=_site(domain="hejing.com"))

    result = await service.process_newsletter_queue(session, site_id=1)

    assert result["sent"] == 1
    assert delivery.status == "sent"
    assert isinstance(delivery.sent_at, datetime)
    assert delivery.sent_at.tzinfo is not None
    assert delivery.sent_at <= datetime.now(UTC)
