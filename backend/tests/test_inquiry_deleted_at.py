"""The admin's 已刪除 view decides what to offer from `deleted_at`.

`_inquiry_payload` was the only admin serialiser that dropped the field
(`_booking_payload` next to it always carried it). The deleted list therefore
saw `deleted_at: undefined` on every row, took the not-deleted branch, and
rendered the status buttons plus another 刪除 instead of 復原 — so a
soft-deleted enquiry could not be restored from the admin at all, even though
POST /admin/inquiries/{id}/restore and the button that calls it both existed.
"""

from datetime import datetime, timezone

from app.modules.admin.routes import _inquiry_payload
from app.modules.inquiries.models import Inquiry


def _inquiry(**over) -> Inquiry:
    return Inquiry(
        id=1, site_id=1, name="訪客", email="guest@example.com", guests=2,
        status="contacted", **over,
    )


def test_a_deleted_enquiry_says_so() -> None:
    when = datetime(2026, 8, 22, 4, 35, tzinfo=timezone.utc)
    payload = _inquiry_payload(_inquiry(deleted_at=when))

    assert payload["deleted_at"] == when


def test_a_live_enquiry_carries_the_field_as_null() -> None:
    """Present-and-null, not absent: the client checks the key, not `in`."""
    payload = _inquiry_payload(_inquiry())

    assert "deleted_at" in payload
    assert payload["deleted_at"] is None
