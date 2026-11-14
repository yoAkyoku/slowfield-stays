"""Exercise inbox contact search predicates against authored SQLite rows."""
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.db.base import Base
from app.modules.admin.routes import _inquiry_keyword_filter, _booking_keyword_filter
from app.modules.inquiries.models import Inquiry
from app.modules.bookings.models import BookingRequest

@pytest.mark.parametrize("model,predicate", [(Inquiry, _inquiry_keyword_filter), (BookingRequest, _booking_keyword_filter)])
def test_phone_and_line_match_records_without_matching_name_or_message(model, predicate):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(model(name="Contact QA", email="contact@example.com", phone="0912345678", line_id="qa_line_1013", message="Other words"))
        session.add(model(name="Unrelated QA", email="other@example.com", phone="0988888888", line_id="qaXlineX1013", message="Other words"))
        session.commit()
        for term in ("0912345678", "qa_line_1013"):
            matches = session.scalars(select(model).where(predicate(term))).all()
            assert [row.name for row in matches] == ["Contact QA"]
    engine.dispose()
