"""The staff notification for a new booking is assembled from public form input.

It is sent with html=True, so every field on it is markup unless something makes
it text.
"""

from app.modules.bookings import routes as booking_routes
from app.modules.bookings.models import BookingRequest
from app.modules.email import service as email_service
from app.modules.email.models import EmailSettings


class _Site:
    id = 1
    name = "Hejing Villa"


def _capture(monkeypatch) -> dict:
    sent: dict = {}

    async def fake_get_email_settings(_session, _site_id):
        return EmailSettings(
            site_id=1,
            is_enabled=True,
            smtp_host="smtp.example.com",
            smtp_port=587,
            from_email="hello@example.com",
            reply_to="stay@example.com",
        )

    async def fake_send_email_async(settings, to_email, subject, body, html=False):
        sent.update({"to": to_email, "subject": subject, "body": body, "html": html})
        return True

    monkeypatch.setattr(email_service, "get_email_settings", fake_get_email_settings)
    monkeypatch.setattr(email_service, "send_email_async", fake_send_email_async)
    return sent


async def test_a_booking_notification_escapes_what_the_visitor_typed(monkeypatch) -> None:
    """The booking form is unauthenticated and the mail goes out as HTML.

    Interpolated raw, a visitor chooses what the managers' inbox renders — a
    phishing link inside a genuine notification from the brand's own domain,
    which is about as credible as a phish gets.
    """
    sent = _capture(monkeypatch)
    booking = BookingRequest(
        id=1,
        site_id=1,
        name='Guest<a href="https://evil.test">Claim your refund</a>',
        email="guest@example.com",
        phone="",
        line_id="",
        guests=2,
        message="<img src=x onerror=alert(1)>",
        status="new",
    )

    await booking_routes._notify_staff_of_booking(object(), _Site(), booking)

    assert sent["html"] is True, "the guard is only needed because this is HTML"
    body = sent["body"]
    assert "<a href=" not in body
    assert "<img" not in body
    assert "&lt;a href=&quot;https://evil.test&quot;&gt;" in body
    assert "&lt;img src=x onerror=alert(1)&gt;" in body
    # The table the values sit in is still markup, and still renders.
    assert "<table" in body and "<tr>" in body


async def test_an_ordinary_booking_still_reads_normally(monkeypatch) -> None:
    """Escaping must not mangle the common case into entities."""
    sent = _capture(monkeypatch)
    booking = BookingRequest(
        id=2,
        site_id=1,
        name="林小姐",
        email="lin@example.com",
        phone="0912-345-678",
        line_id="",
        guests=4,
        message="想訂三月的房間",
        status="new",
    )

    await booking_routes._notify_staff_of_booking(object(), _Site(), booking)

    body = sent["body"]
    assert "林小姐" in body
    assert "0912-345-678" in body
    assert "想訂三月的房間" in body
    assert sent["to"] == "stay@example.com"
