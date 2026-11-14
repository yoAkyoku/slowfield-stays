from datetime import datetime
import pytest
from pydantic import ValidationError
from app.modules.inquiries.schemas import InquiryCreate, InquiryRead
from app.modules.bookings.schemas import BookingRequestCreate, BookingRequestRead

@pytest.mark.parametrize("schema", [InquiryCreate, BookingRequestCreate])
@pytest.mark.parametrize("checkout", ["2026-11-01", "2026-11-02"])
def test_new_request_rejects_nonpositive_stay(schema, checkout):
    with pytest.raises(ValidationError, match="Check-out must be after check-in"):
        schema(name="Date QA", email="date@example.com", check_in="2026-11-02", check_out=checkout)

@pytest.mark.parametrize("schema", [InquiryCreate, BookingRequestCreate])
def test_optional_and_valid_dates_are_accepted(schema):
    assert schema(name="Date QA", email="date@example.com").check_in is None
    assert schema(name="Date QA", email="date@example.com", check_in="2026-11-02", check_out="2026-11-03").check_out.isoformat() == "2026-11-03"

@pytest.mark.parametrize("schema", [InquiryRead, BookingRequestRead])
def test_legacy_bad_dates_remain_readable_for_staff(schema):
    row = schema(id=1, name="Legacy QA", email="legacy@example.com", status="new", created_at=datetime(2026, 10, 13), check_in="2026-11-02", check_out="2026-11-01")
    assert row.check_out.isoformat() == "2026-11-01"
