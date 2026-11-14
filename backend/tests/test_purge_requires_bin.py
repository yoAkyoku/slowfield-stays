"""Deleting twice is what makes a deletion permanent.

Every admin list soft-deletes: the row moves to 已刪除 and stays in the
database. Nothing removed it from there, so the bin only ever grew, and the
`刪除所選` button shown inside the bin re-stamped `deleted_at` on rows that
were already deleted — a button that looked like it did something and did not.

The purge routes are that second delete. The rule they all share is that they
refuse a row which has not been deleted once already, so no single mis-click
anywhere in the admin can destroy live content; a live row answers 404 exactly
as a non-existent one does.

The two newsletter purges have one extra obligation: `NewsletterDelivery` is
the send log, it feeds the daily send cap, and its FKs to campaign and
subscriber are nullable with no cascade. Removing a subscriber must clear the
link, not take the log with it.
"""

import asyncio
from datetime import UTC, datetime

import pytest
from fastapi import HTTPException

from app.modules.admin.routes import (
    purge_banner,
    purge_booking_request,
    purge_campaign,
    purge_inquiry,
    purge_page,
    purge_stay,
    purge_subscriber,
)
from app.modules.bookings.models import BookingRequest
from app.modules.cms.models import Banner, Page
from app.modules.email.models import NewsletterCampaign, NewsletterSubscriber
from app.modules.inquiries.models import Inquiry
from app.modules.sites.models import Site
from app.modules.stays.models import Stay

DELETED_AT = datetime(2026, 8, 20, 3, 0, tzinfo=UTC)
SITE = Site(id=1, slug="hejing", name="Hejing Villa")
OTHER_SITE_ID = 2


class _FakeSession:
    """Enough AsyncSession surface for a purge handler."""

    def __init__(self, rows=None):
        self.rows = rows or {}
        self.deleted = []
        self.executed = []
        self.committed = False
        # what a count(*) asks for, e.g. booking requests still pointing at a stay
        self.count = 0

    async def scalar(self, statement):
        return self.count

    async def get(self, model, item_id):
        return self.rows.get((model, item_id))

    async def delete(self, item):
        self.deleted.append(item)

    async def execute(self, statement):
        self.executed.append(statement)

    async def commit(self):
        self.committed = True


def _rows(model, **kwargs):
    row = model(id=7, site_id=SITE.id, **kwargs)
    return row, _FakeSession({(model, 7): row})


# (handler, model, the fields the model needs beyond id/site_id)
CASES = [
    (purge_stay, Stay, {"name": "Villa", "slug": "villa", "base_price": 1000}),
    (purge_page, Page, {"title": "About", "slug": "about"}),
    (purge_banner, Banner, {"title": "Hero"}),
    (purge_inquiry, Inquiry, {"name": "訪客", "email": "g@example.com", "guests": 2}),
    (purge_booking_request, BookingRequest, {"name": "訪客", "email": "g@example.com"}),
    (purge_subscriber, NewsletterSubscriber, {"email": "g@example.com"}),
    (purge_campaign, NewsletterCampaign, {"subject": "秋季", "body": "…"}),
]
IDS = [model.__name__ for _, model, _ in CASES]


@pytest.mark.parametrize(("handler", "model", "fields"), CASES, ids=IDS)
def test_a_row_still_in_the_list_is_never_purged(handler, model, fields) -> None:
    """The first delete has not happened, so the second one is not offered."""
    row, session = _rows(model, deleted_at=None, **fields)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(handler(7, SITE, session))

    assert raised.value.status_code == 404
    assert session.deleted == []
    assert not session.committed


@pytest.mark.parametrize(("handler", "model", "fields"), CASES, ids=IDS)
def test_a_row_in_the_bin_is_removed(handler, model, fields) -> None:
    row, session = _rows(model, deleted_at=DELETED_AT, **fields)

    result = asyncio.run(handler(7, SITE, session))

    assert session.deleted == [row]
    assert session.committed
    assert result == {"id": 7, "purged": True}


@pytest.mark.parametrize(("handler", "model", "fields"), CASES, ids=IDS)
def test_another_site_cannot_purge_this_row(handler, model, fields) -> None:
    """Site scoping is checked before the bin, as on delete and restore."""
    row, session = _rows(model, deleted_at=DELETED_AT, **fields)
    row.site_id = OTHER_SITE_ID

    with pytest.raises(HTTPException) as raised:
        asyncio.run(handler(7, SITE, session))

    assert raised.value.status_code == 404
    assert session.deleted == []


@pytest.mark.parametrize(("handler", "model", "fields"), CASES, ids=IDS)
def test_a_missing_row_is_a_404_not_a_crash(handler, model, fields) -> None:
    with pytest.raises(HTTPException) as raised:
        asyncio.run(handler(7, SITE, _FakeSession()))

    assert raised.value.status_code == 404


@pytest.mark.parametrize(
    ("handler", "model", "fields", "column"),
    [
        (purge_subscriber, NewsletterSubscriber, {"email": "g@example.com"}, "subscriber_id"),
        (purge_campaign, NewsletterCampaign, {"subject": "秋季", "body": "…"}, "campaign_id"),
    ],
    ids=["subscriber", "campaign"],
)
def test_the_send_log_survives_a_newsletter_purge(handler, model, fields, column) -> None:
    """The deliveries are not deleted — their link is set to NULL.

    They are the record that mail went out, and `count_sent_today` reads them
    to enforce the daily cap. A cascade here would quietly raise that cap.
    """
    _, session = _rows(model, deleted_at=DELETED_AT, **fields)

    asyncio.run(handler(7, SITE, session))

    assert len(session.executed) == 1
    compiled = str(session.executed[0].compile(compile_kwargs={"literal_binds": True}))
    assert compiled == (
        f"UPDATE newsletter_deliveries SET {column}=NULL "
        f"WHERE newsletter_deliveries.{column} = 7"
    )


def test_a_stay_with_booking_requests_is_a_409_not_a_500() -> None:
    """booking_requests.stay_id has no ON DELETE, so the delete would hit the
    foreign key at commit and the admin saw a bare 500. The stay stays in the
    bin and the reason is given."""
    row, session = _rows(Stay, deleted_at=DELETED_AT, name="Villa", slug="villa", base_price=1000)
    session.count = 2

    with pytest.raises(HTTPException) as raised:
        asyncio.run(purge_stay(7, SITE, session))

    assert raised.value.status_code == 409
    assert "booking request" in raised.value.detail
    assert session.deleted == []
    assert not session.committed
