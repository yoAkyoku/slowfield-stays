"""A row in 已刪除 is not a row you file.

Every status verb in the admin already refused a soft-deleted row — stay, page,
banner, campaign all answer 400 — except the two the 表單聯絡 inbox is built
from. Those two committed the change: the status moved while the row stayed in
the bin.

It was reached by a stale button. The inbox is one list over two tables whose
ids overlap, React was given the same key twice, and a leftover row from an
earlier render kept offering 已聯繫 for a record that had just been deleted.
Pressing it filed the deleted enquiry.

The rendering bug is fixed separately, and this is the half that does not depend
on that: the admin hides these buttons on a deleted row, which is exactly the
reason the API must not be the thing relying on it. Anything holding a stale
page, a replayed request, or a script gets the same answer.

400 rather than 404, matching the four verbs that already had the rule — the row
exists and can be named, which is why 復原 can still reach it; what is refused is
this particular verb on it. 404 stays for a row that is not there at all, or
belongs to another site.

Run against the real-database fixture: the assertion is that nothing was
committed, and a session that discards the statement cannot show that.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.modules.admin.routes import (
    BookingStatusUpdate,
    InquiryStatusUpdate,
    restore_booking_request,
    restore_inquiry,
    update_booking_request_status,
    update_inquiry_status,
)
from app.modules.bookings.models import BookingRequest
from app.modules.inquiries.models import Inquiry
from app.modules.sites.models import Site

from conftest import make

SITE = make(Site, id=1, slug="slowfield", name="Slowfield Stays")
# The number both tables hold at once, which is how the stale button reached the
# wrong record in the first place.
SHARED_ID = 3


def _seed(db_session, *, inquiry_deleted=False, booking_deleted=False):
    """One enquiry and one booking sharing an id, each live or binned."""
    stamp = datetime.now(UTC)
    inquiry = make(
        Inquiry,
        id=SHARED_ID,
        site_id=1,
        name="訪客",
        email="guest@example.com",
        guests=2,
        status="new",
        deleted_at=stamp if inquiry_deleted else None,
    )
    booking = make(
        BookingRequest,
        id=SHARED_ID,
        site_id=1,
        name="訪客",
        email="guest@example.com",
        status="new",
        deleted_at=stamp if booking_deleted else None,
    )
    db_session.add_all([inquiry, booking])
    asyncio.run(db_session.commit())


def _reread(db_session, model):
    """The row as the database holds it, not as the session remembers it."""
    db_session.sync.expire_all()
    return asyncio.run(
        db_session.execute(select(model).where(model.id == SHARED_ID))
    ).scalars().one_or_none()


# ── the refusal ─────────────────────────────────────────────────────────────


def test_a_deleted_enquiry_refuses_a_status_change(db_session) -> None:
    _seed(db_session, inquiry_deleted=True)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(update_inquiry_status(SHARED_ID, InquiryStatusUpdate(status="contacted"), SITE, db_session))

    assert raised.value.status_code == 400, "a binned row exists and can be named; 404 would say it does not"
    row = _reread(db_session, Inquiry)
    assert row.status == "new", "the status was committed on a row sitting in 已刪除"
    assert row.deleted_at is not None, "the refused call moved the row out of the bin"


def test_a_deleted_booking_refuses_a_status_change(db_session) -> None:
    """Both tables, or the gap simply moves to the other one."""
    _seed(db_session, booking_deleted=True)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            update_booking_request_status(SHARED_ID, BookingStatusUpdate(status="contacted"), SITE, db_session)
        )

    assert raised.value.status_code == 400
    row = _reread(db_session, BookingRequest)
    assert row.status == "new"
    assert row.deleted_at is not None


# ── and only that ───────────────────────────────────────────────────────────


def test_a_live_enquiry_still_accepts_one(db_session) -> None:
    """The guard has to be about the bin, not about the verb."""
    _seed(db_session)

    asyncio.run(update_inquiry_status(SHARED_ID, InquiryStatusUpdate(status="contacted"), SITE, db_session))

    assert _reread(db_session, Inquiry).status == "contacted"


def test_a_live_booking_still_accepts_one(db_session) -> None:
    _seed(db_session)

    asyncio.run(
        update_booking_request_status(SHARED_ID, BookingStatusUpdate(status="contacted"), SITE, db_session)
    )

    assert _reread(db_session, BookingRequest).status == "contacted"


def test_binning_the_enquiry_does_not_freeze_the_booking_of_the_same_number(db_session) -> None:
    """The guard reads its own row.

    Both tables number from 1, so a check that fetched by id alone — or that
    consulted whichever row the session happened to hold — would refuse a live
    booking because an unrelated enquiry with the same number is in the bin.
    """
    _seed(db_session, inquiry_deleted=True)

    asyncio.run(
        update_booking_request_status(SHARED_ID, BookingStatusUpdate(status="contacted"), SITE, db_session)
    )

    assert _reread(db_session, BookingRequest).status == "contacted"
    assert _reread(db_session, Inquiry).status == "new", "the enquiry in the bin was filed after all"


def test_the_row_can_still_be_restored(db_session) -> None:
    """復原 is the verb a binned row does answer — the refusal must not reach it,
    or a deleted enquiry would be stuck in the bin for good."""
    _seed(db_session, inquiry_deleted=True, booking_deleted=True)

    asyncio.run(restore_inquiry(SHARED_ID, SITE, db_session))
    asyncio.run(restore_booking_request(SHARED_ID, SITE, db_session))

    assert _reread(db_session, Inquiry).deleted_at is None
    assert _reread(db_session, BookingRequest).deleted_at is None


def test_a_row_from_another_site_is_still_404_not_400(db_session) -> None:
    """The two refusals say different things and must not be collapsed: 404 is
    'no such row here', 400 is 'that row is in the bin'. Tenant scoping is
    checked first, so another site's row never reveals its deleted state."""
    _seed(db_session, inquiry_deleted=True)
    other = make(Site, id=2, slug="hejing", name="Hejing Villa")

    with pytest.raises(HTTPException) as raised:
        asyncio.run(update_inquiry_status(SHARED_ID, InquiryStatusUpdate(status="contacted"), other, db_session))

    assert raised.value.status_code == 404
