"""A campaign whose queue drains exactly on a batch boundary still finishes.

Promotion to "sent" used to be decided by what a single batch happened to send:

    if not cap_hit and len(deliveries) < limit:
        for campaign_id, campaign_sent in sent_by_campaign.items():
            ...

Both halves have to hold in the same call, and for a campaign whose delivery
count is an exact multiple of `limit` they never can. The last full batch sends
every remaining row but is `== limit`, so it does not promote; the next tick
finds nothing to send, so it has no campaign to promote. The campaign sits in
"queued" for good, showing in the admin as unsent mail that has in fact been
delivered — and the obvious operator response, sending it again, mails the whole
list twice.

The default page size is 25, so any campaign with 25, 50, 75… recipients lands
on it. That is not an unusual number for a list this size.

These use the real-database fixture in conftest.py, because the point is what a
GROUP BY over the delivery table returns; a `_FakeSession` that discards the
statement cannot show it.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

import app.modules.email.service as service
from app.modules.email.models import (
    EmailSettings,
    NewsletterCampaign,
    NewsletterDelivery,
    NewsletterSubscriber,
)
from app.modules.sites.models import Site

from conftest import make


def _seed(db, recipients: int, campaign_id: int = 10):
    s = db.sync
    s.add(Site(id=1, name="Parent", slug="parent", domain="parent.example"))
    s.add(make(EmailSettings, site_id=1, is_enabled=True, smtp_host="smtp.example.com",
               smtp_port=587, from_email="hello@example.com", from_name="Slowfield Stays"))
    s.add(make(NewsletterCampaign, id=campaign_id, site_id=1, subject="May", body="Hello",
               status="queued"))
    for n in range(recipients):
        s.add(make(NewsletterSubscriber, id=100 + n, site_id=1, email=f"g{n}@example.com",
                   status="subscribed", unsubscribe_token=f"tok-{n}"))
        s.add(make(NewsletterDelivery, id=200 + n, site_id=1, campaign_id=campaign_id,
                   subscriber_id=100 + n, email=f"g{n}@example.com", status="pending"))
    s.commit()
    return s.get(NewsletterCampaign, campaign_id)


@pytest.fixture()
def sends_succeed(monkeypatch):
    monkeypatch.setattr(service, "_send_email_sync", lambda *a, **k: True)


def test_a_campaign_that_drains_exactly_on_the_batch_boundary_is_marked_sent(
    db_session, sends_succeed
) -> None:
    """The mutation this file exists for: recipients == limit."""
    campaign = _seed(db_session, recipients=3)

    result = asyncio.run(service.process_newsletter_queue(db_session, site_id=1, limit=3))

    assert result["sent"] == 3, f"the batch did not send everything: {result}"
    assert campaign.status == "sent", (
        "every delivery went out, but the campaign is still queued — the admin "
        "shows it as unsent and sending it again mails the whole list twice"
    )
    assert campaign.sent_at is not None


def test_a_campaign_left_stranded_by_the_old_rule_is_picked_up_later(
    db_session, sends_succeed
) -> None:
    """Reading the queue rather than the batch also repairs the existing rows.

    Campaigns already stuck this way are in the database now; a fix that only
    covers new sends would leave them stuck for ever.
    """
    campaign = _seed(db_session, recipients=2)
    for delivery in db_session.sync.query(NewsletterDelivery).all():
        delivery.status = "sent"
    db_session.sync.commit()
    assert campaign.status == "queued"

    # Nothing at all to send on this tick.
    result = asyncio.run(service.process_newsletter_queue(db_session, site_id=1, limit=25))

    assert result["sent"] == 0
    assert campaign.status == "sent", "a fully-delivered campaign was left queued"


def test_a_campaign_with_deliveries_still_waiting_is_not_marked_sent(
    db_session, sends_succeed
) -> None:
    """The other direction: promotion must wait for the queue to actually empty."""
    campaign = _seed(db_session, recipients=4)

    result = asyncio.run(service.process_newsletter_queue(db_session, site_id=1, limit=2))

    assert result["sent"] == 2
    assert campaign.status == "queued", "promoted while two recipients had not been mailed"


def test_a_campaign_whose_sends_all_failed_stays_queued(db_session, monkeypatch) -> None:
    """Preserved from the old rule: retry-failed has to stay reachable."""
    monkeypatch.setattr(service, "_send_email_sync", lambda *a, **k: False)
    campaign = _seed(db_session, recipients=2)

    result = asyncio.run(service.process_newsletter_queue(db_session, site_id=1, limit=2))

    assert result["failed"] == 2
    assert campaign.status == "queued", "a campaign nobody received was reported as sent"


def test_one_campaign_finishing_does_not_finish_another(db_session, sends_succeed) -> None:
    """Grouped by campaign, so a drained one does not carry an undrained one with it."""
    done = _seed(db_session, recipients=1, campaign_id=10)
    s = db_session.sync
    s.add(make(NewsletterCampaign, id=11, site_id=1, subject="June", body="Hi", status="queued"))
    s.add(make(NewsletterSubscriber, id=300, site_id=1, email="later@example.com",
               status="subscribed", unsubscribe_token="tok-later"))
    s.add(make(NewsletterDelivery, id=400, site_id=1, campaign_id=11, subscriber_id=300,
               email="later@example.com", status="pending"))
    s.commit()

    # Only the first campaign's row is inside this page.
    asyncio.run(service.process_newsletter_queue(db_session, site_id=1, limit=1))

    assert done.status == "sent"
    assert s.get(NewsletterCampaign, 11).status == "queued", "an unsent campaign was promoted too"

def test_a_scheduled_campaign_keeps_draining_after_the_tick_that_promoted_it(
    db_session, sends_succeed, monkeypatch
) -> None:
    """The sweep has to revisit sites it promoted nothing for.

    `tick_scheduled_newsletters` fanned out to the sites returned by
    `promote_due_scheduled_campaigns`, i.e. the sites with a campaign coming due
    ON THIS TICK. A scheduled campaign was therefore mailed exactly one page —
    the default 25 — because the tick that promoted it drained one batch and
    every tick after it promoted nothing, had no site to visit, and sent
    nothing. The rest of the list stayed `pending` until an admin noticed and
    pressed 立即處理.

    Two ticks here, with nothing due on the second. What matters is that the
    second one still sends.
    """
    # More than one page: the default limit is 25, so 30 recipients guarantee
    # the promoting tick cannot finish the job. With a list that fits in one
    # batch this test passes either way — which it did, until the mutation said
    # so.
    campaign = _seed(db_session, recipients=30)
    campaign.status = "scheduled"
    campaign.scheduled_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.sync.commit()

    class _Factory:
        """Hands back the one test session; the tick opens its own normally."""

        def __call__(self):
            return self

        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *exc):
            return False

    factory = _Factory()

    first = asyncio.run(service.tick_scheduled_newsletters(factory))
    assert first["promoted"] == 1, first
    assert first["sent"] == 25, f"the promoting tick did not drain one full page: {first}"

    # Second sweep: the campaign is already `queued`, so nothing comes due — and
    # that is exactly when the old code stopped sending.
    remaining = [d for d in db_session.sync.query(NewsletterDelivery).all() if d.status == "pending"]
    assert len(remaining) == 5, f"the fixture did not straddle a batch boundary: {len(remaining)}"

    second = asyncio.run(service.tick_scheduled_newsletters(factory))
    assert second["promoted"] == 0, "the campaign was promoted twice"
    assert second["sent"] == 5, (
        f"5 recipients were still waiting and the next sweep mailed {second['sent']} of "
        f"them — a scheduled campaign stops after the first batch"
    )
    assert campaign.status == "sent"


def test_a_site_with_nothing_waiting_is_not_visited(db_session, sends_succeed) -> None:
    """The sweep must not widen into every site on every tick."""
    _seed(db_session, recipients=1)
    for delivery in db_session.sync.query(NewsletterDelivery).all():
        delivery.status = "sent"
    db_session.sync.commit()

    assert asyncio.run(service.sites_with_unsent_deliveries(db_session)) == []


class _Died(BaseException):
    """Not an Exception, so the send loop's `except Exception` cannot swallow it.

    Stands in for the process going away mid-batch — SIGKILL, OOM, a container
    restart. What matters is that the loop stops without reaching the end.
    """


def test_a_crash_mid_batch_does_not_re_mail_the_people_already_reached(
    db_session, monkeypatch
) -> None:
    """Each send's outcome is committed before the next one starts.

    The statuses used to be written to the session and committed once, after the
    whole page. A process that died partway therefore left every row it had
    ALREADY DELIVERED sitting in "sending" — and the stale sweep at the top of
    process_newsletter_queue hands those back to "pending", so the next run
    mails the same people again. With the default page of 25 that is up to 24
    duplicate newsletters per crash, to real subscribers.

    Durability is asserted by rolling the session back afterwards: what survives
    a rollback is what was committed, which is exactly the question.
    """
    _seed(db_session, recipients=4)
    calls = {"n": 0}

    def send(*_args, **_kwargs):
        calls["n"] += 1
        if calls["n"] == 3:
            raise _Died()
        return True

    monkeypatch.setattr(service, "_send_email_sync", send)

    with pytest.raises(_Died):
        asyncio.run(service.process_newsletter_queue(db_session, site_id=1, limit=4))

    # Anything not committed reverts here.
    db_session.sync.rollback()
    statuses = [
        d.status
        for d in db_session.sync.query(NewsletterDelivery).order_by(NewsletterDelivery.id).all()
    ]
    assert statuses[:2] == ["sent", "sent"], (
        f"two newsletters had gone out and neither was recorded as sent: {statuses} — "
        "the stale sweep will hand these back and mail those people a second time"
    )
    assert statuses[2] == "sending", f"the row being sent when it died is not claimed: {statuses}"


def test_the_daily_cap_sees_what_the_other_worker_sent(db_session, monkeypatch) -> None:
    """The ceiling is re-read per send, not once per batch.

    Production runs two uvicorn workers, each ticking its own loop. Both used to
    read the day's total once and then count locally, so neither could see the
    other's sends and together they overshot `daily_cap` by up to a full batch.

    Here the count jumps after the first read, standing in for the other worker
    committing its own sends. A batch that reads once cannot notice.
    """
    _seed(db_session, recipients=4)
    db_session.sync.query(EmailSettings).one().daily_cap = 10
    db_session.sync.commit()
    monkeypatch.setattr(service, "_send_email_sync", lambda *a, **k: True)

    reads = {"n": 0}
    real = service.count_sent_today

    async def creeping_count(session, site_id):
        reads["n"] += 1
        actual = await real(session, site_id)
        # From the second read on, the other worker has "already" filled the day.
        return actual if reads["n"] <= 1 else 10

    monkeypatch.setattr(service, "count_sent_today", creeping_count)

    result = asyncio.run(service.process_newsletter_queue(db_session, site_id=1, limit=4))

    assert reads["n"] > 1, "the daily total was read once for the whole batch"
    assert result["cap_hit"] is True, "the batch ran past a cap that was already full"
    assert result["sent"] == 0, (
        f"sent {result['sent']} messages after the cap was reached — two workers "
        "counting locally overshoot the provider's hard daily limit"
    )
    still_pending = [
        d for d in db_session.sync.query(NewsletterDelivery).all() if d.status == "pending"
    ]
    assert len(still_pending) == 4, "rows stopped by the cap were left claimed, not handed back"


def test_queued_mail_does_not_send_future_scheduled_mail(db_session, sends_succeed):
    queued = _seed(db_session, recipients=1)
    s = db_session.sync
    later = make(NewsletterCampaign, id=11, site_id=1, subject="Future", body="Later",
                 status="scheduled", scheduled_at=datetime.now(UTC) + timedelta(hours=1))
    s.add(later)
    s.add(make(NewsletterDelivery, id=400, site_id=1, campaign_id=11, subscriber_id=100,
               email="g0@example.com", status="pending"))
    s.commit()
    result = asyncio.run(service.process_newsletter_queue(db_session, site_id=1))
    assert result["sent"] == 1
    assert queued.status == "sent"
    assert later.status == "scheduled"
    assert s.get(NewsletterDelivery, 400).status == "pending"
    later.scheduled_at = datetime.now(UTC) - timedelta(minutes=1)
    s.commit()
    assert asyncio.run(service.promote_due_scheduled_campaigns(db_session)) == [1]
    result = asyncio.run(service.process_newsletter_queue(db_session, site_id=1))
    assert result["sent"] == 1
    assert later.status == "sent"
