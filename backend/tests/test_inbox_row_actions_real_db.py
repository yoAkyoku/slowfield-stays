"""表單聯絡 is one list over two tables, and their ids overlap.

A visitor fills in one form. Whether it lands in `inquiries` or in
`booking_requests` is decided by an invisible flag, and each table numbers
itself from 1 — so the merged list routinely holds an enquiry 3 and a booking 3
at the same time. The admin picks the endpoint per row from the row's own
`kind`, and everything downstream depends on the two numbering spaces staying
apart.

These are the four verbs each row offers (已聯繫 / 刪除 / 復原 / 永久刪除) as they
are reached from that list, asserted from the outside: that each one reaches its
own table and no other, that it really writes, and that the site scoping is the
same on all eight handlers — the last one because the two POST/PATCH verbs were
suspected of being scoped differently from DELETE when the buttons appeared to
do nothing.

Run against the real-database fixture. A `_FakeSession` answering from a dict
keyed by `(model, id)` cannot tell "booking 3" from "the enquiry with the same
number", which is precisely the confusion being ruled out here.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.modules.admin.routes import (
    BookingStatusUpdate,
    InquiryStatusUpdate,
    delete_booking_request,
    delete_inquiry,
    purge_booking_request,
    purge_inquiry,
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
OTHER_SITE_ID = 2
# The number both tables are holding at once.
SHARED_ID = 3


def _seed(db_session, *, deleted_at=None, site_id: int = 1):
    """One enquiry and one booking, same id, same site, same state."""
    inquiry = make(
        Inquiry,
        id=SHARED_ID,
        site_id=site_id,
        name="訪客",
        email="guest@example.com",
        guests=2,
        status="new",
        deleted_at=deleted_at,
    )
    booking = make(
        BookingRequest,
        id=SHARED_ID,
        site_id=site_id,
        name="訪客",
        email="guest@example.com",
        status="new",
        deleted_at=deleted_at,
    )
    db_session.add_all([inquiry, booking])
    asyncio.run(db_session.commit())
    return inquiry, booking


def _reread(db_session, model):
    """The row as the database now holds it, not as the session remembers it."""
    db_session.sync.expire_all()
    return asyncio.run(db_session.execute(select(model).where(model.id == SHARED_ID))).scalars().one_or_none()


def test_contacted_is_a_status_both_inboxes_accept() -> None:
    """The value the 已聯繫 button sends, against the pattern that admits it.

    Worth stating because it is the first thing suspected when the button looks
    inert, and because the two patterns are written out twice and could drift.
    """
    assert InquiryStatusUpdate(status="contacted").status == "contacted"
    assert BookingStatusUpdate(status="contacted").status == "contacted"
    for model in (InquiryStatusUpdate, BookingStatusUpdate):
        with pytest.raises(ValueError):
            model(status="deleted")


def test_a_booking_status_change_leaves_the_enquiry_of_the_same_number_alone(db_session) -> None:
    _seed(db_session)

    asyncio.run(update_booking_request_status(SHARED_ID, BookingStatusUpdate(status="contacted"), SITE, db_session))

    assert _reread(db_session, BookingRequest).status == "contacted"
    assert _reread(db_session, Inquiry).status == "new"


def test_an_enquiry_status_change_leaves_the_booking_of_the_same_number_alone(db_session) -> None:
    _seed(db_session)

    asyncio.run(update_inquiry_status(SHARED_ID, InquiryStatusUpdate(status="contacted"), SITE, db_session))

    assert _reread(db_session, Inquiry).status == "contacted"
    assert _reread(db_session, BookingRequest).status == "new"


def test_deleting_one_of_the_two_leaves_the_other_in_the_list(db_session) -> None:
    _seed(db_session)

    asyncio.run(delete_booking_request(SHARED_ID, SITE, db_session))

    assert _reread(db_session, BookingRequest).deleted_at is not None
    assert _reread(db_session, Inquiry).deleted_at is None


def test_restoring_one_of_the_two_leaves_the_other_in_the_bin(db_session) -> None:
    from datetime import UTC, datetime

    _seed(db_session, deleted_at=datetime(2026, 8, 20, 3, 0, tzinfo=UTC))

    asyncio.run(restore_booking_request(SHARED_ID, SITE, db_session))

    assert _reread(db_session, BookingRequest).deleted_at is None
    assert _reread(db_session, Inquiry).deleted_at is not None


def test_purging_one_of_the_two_leaves_the_other_row_in_place(db_session) -> None:
    from datetime import UTC, datetime

    _seed(db_session, deleted_at=datetime(2026, 8, 20, 3, 0, tzinfo=UTC))

    asyncio.run(purge_booking_request(SHARED_ID, SITE, db_session))

    assert _reread(db_session, BookingRequest) is None
    assert _reread(db_session, Inquiry) is not None


# Each verb as a callable of (row_id, site, session), so the site check below can
# be stated once for all eight rather than once per HTTP method.
VERBS = [
    ("booking 已聯繫", lambda i, s, db: update_booking_request_status(i, BookingStatusUpdate(status="contacted"), s, db)),
    ("booking 刪除", delete_booking_request),
    ("booking 復原", restore_booking_request),
    ("booking 永久刪除", purge_booking_request),
    ("enquiry 已聯繫", lambda i, s, db: update_inquiry_status(i, InquiryStatusUpdate(status="contacted"), s, db)),
    ("enquiry 刪除", delete_inquiry),
    ("enquiry 復原", restore_inquiry),
    ("enquiry 永久刪除", purge_inquiry),
]


@pytest.mark.parametrize(("label", "verb"), VERBS, ids=[label for label, _ in VERBS])
def test_every_verb_scopes_to_the_site_the_same_way(db_session, label, verb) -> None:
    """A row belonging to another site is a 404, whichever verb asks.

    PATCH and POST were suspected of being scoped differently from DELETE
    because two of these four buttons appeared to work and two did not. They are
    not: all eight resolve the site through the same dependency and compare the
    same column, and one that stopped would let a child-site admin edit the
    parent's inbox.
    """
    from datetime import UTC, datetime

    _seed(db_session, deleted_at=datetime(2026, 8, 20, 3, 0, tzinfo=UTC), site_id=OTHER_SITE_ID)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(verb(SHARED_ID, SITE, db_session))

    assert raised.value.status_code == 404
    assert _reread(db_session, Inquiry).status == "new"
    assert _reread(db_session, BookingRequest).status == "new"
