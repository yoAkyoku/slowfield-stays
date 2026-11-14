"""Four defects found in the module audit, each of which returned a 200.

  * `POST /newsletter/campaigns/{id}/queue` read the campaign's status forty
    lines before it wrote it, with no lock between, so two concurrent requests
    both queued a full set of deliveries and every subscriber was mailed twice;
  * `create_site` never got the script-settings guard that `update_site` has;
  * login skipped the KDF entirely for an unknown address, answering ~284ms
    faster and enumerating every administrator's email;
  * three public form fields had no length bound, so an unauthenticated POST
    could push 5,000 characters at a VARCHAR(80) column and get a 500.
"""

import asyncio
import time

import pytest

from app.modules.admin.routes import SCRIPT_SETTING_KEYS, _settings_without_script_keys
from app.modules.bookings.schemas import BookingRequestCreate
from app.modules.inquiries.schemas import InquiryCreate


# ── the queue claim ──────────────────────────────────────────────────────────

def test_queueing_a_campaign_twice_cannot_double_send() -> None:
    """The claim is a conditional UPDATE, so the second caller matches no row.

    Asserted against the source rather than a live database: the guarantee is
    that the status transition and the check are the same statement, and that
    is a property of the SQL, not of any value a fake session would return. A
    stubbed session would happily report whatever rowcount it was told to.
    """
    import inspect as _inspect

    from app.modules.admin.routes import queue_newsletter_campaign

    src = _inspect.getsource(queue_newsletter_campaign)
    claim = src[src.index("claimed = await session.execute"):src.index("for subscriber in recipients")]

    assert "update(NewsletterCampaign)" in claim, "the claim is no longer an UPDATE"
    assert 'NewsletterCampaign.status == "draft"' in claim, (
        "the UPDATE no longer filters on draft, so it cannot be the lock"
    )
    assert 'values(status="queued"' in claim, "the UPDATE no longer performs the transition"
    assert "if claimed.rowcount == 0:" in src, "a losing caller is no longer rejected"

    # The transition must not also happen later from the stale in-session copy.
    after = src[src.index("if claimed.rowcount == 0:"):]
    assert 'campaign.status = "queued"' not in after, (
        "the handler assigns status again after the claim, overwriting the claimed row"
    )
    # …and the claim has to come before any delivery row is built.
    assert src.index("claimed = await session.execute") < src.index("NewsletterDelivery("), (
        "deliveries are built before the campaign is claimed"
    )


# ── create_site ──────────────────────────────────────────────────────────────

def test_create_site_strips_the_script_settings() -> None:
    payload = {
        "head_code": "<script>x</script>",
        "body_code": "fetch(`/admin/api/proxy`)",
        "ads_code": "AW-123",
        "contact_phone": "0900",
        "ga_id": "G-ABC",
    }
    out = _settings_without_script_keys(payload)
    for key in SCRIPT_SETTING_KEYS:
        assert key not in out, f"{key} survived site creation"
    # Everything else is untouched — this is a filter, not a whitelist.
    assert out == {"contact_phone": "0900", "ga_id": "G-ABC"}
    assert _settings_without_script_keys(None) == {}


def test_create_site_actually_calls_the_filter() -> None:
    import inspect as _inspect

    from app.modules.admin.routes import create_site

    src = _inspect.getsource(create_site)
    assert "_settings_without_script_keys(payload.settings)" in src, (
        "create_site takes payload.settings raw again — the guard is only on update_site"
    )


# ── login timing ─────────────────────────────────────────────────────────────

def test_an_unknown_address_costs_the_same_as_a_real_one() -> None:
    """Both branches run the KDF, so the timing no longer reveals the account.

    Measured rather than read: the defect was an absence of work, and only a
    clock can show the work is now being done.
    """
    from app.modules.auth.routes import _DUMMY_PASSWORD_HASH
    from app.modules.auth.security import hash_password, verify_password_async

    real = hash_password("a-real-password")

    def elapsed(h: str) -> float:
        start = time.perf_counter()
        asyncio.run(verify_password_async("guess", h))
        return time.perf_counter() - start

    known = min(elapsed(real) for _ in range(3))
    unknown = min(elapsed(_DUMMY_PASSWORD_HASH) for _ in range(3))

    # Before the fix the unknown-address path did no hashing at all: microseconds
    # against ~284ms. Same order of magnitude is all that is claimed here; exact
    # parity is not achievable and not needed.
    assert unknown > known / 4, (
        f"the unknown-address path is far cheaper ({unknown:.4f}s vs {known:.4f}s) — "
        "it is skipping the KDF again"
    )


def test_login_verifies_before_deciding() -> None:
    import inspect as _inspect

    from app.modules.auth.routes import login

    src = _inspect.getsource(login)
    assert "_DUMMY_PASSWORD_HASH" in src, "the unknown-address branch no longer hashes anything"
    # The short-circuit that caused it must not come back.
    assert "user and user.is_active and await verify_password_async" not in src, (
        "the short-circuited check is back, so an unknown address skips the KDF"
    )


# ── public form bounds ───────────────────────────────────────────────────────

@pytest.mark.parametrize(
    ("model", "field"),
    [
        (InquiryCreate, "phone"),
        (InquiryCreate, "line_id"),
        (BookingRequestCreate, "phone"),
        (BookingRequestCreate, "line_id"),
        (BookingRequestCreate, "room_type"),
    ],
)
def test_public_form_fields_are_bounded_to_their_column(model, field) -> None:
    with pytest.raises(Exception):
        model(name="ab", email="a@b.co", **{field: "x" * 5000})


def test_ordinary_submissions_still_pass() -> None:
    # The bound must not be so tight that a real phone number or LINE id fails.
    assert InquiryCreate(name="王小明", email="a@b.co", phone="0912-345-678", line_id="@slowfield")
    assert BookingRequestCreate(name="王小明", email="a@b.co", room_type="四人房 Deluxe Twin")
