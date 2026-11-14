"""Keyword search over booking requests.

The booking inbox and the enquiry inbox are one screen now (表單聯絡), under one
search box, but only the enquiry side had ever been given a server-side search.
The booking list simply returned its newest `limit` rows and let the client
narrow them — so past 200 bookings a keyword found any enquiry in the table and
only the recent bookings, with nothing on screen to say the second half of the
answer was missing.

Escaping is shared with the enquiry filter (`like_pattern`, covered in
test_inquiry_keyword_filter.py); what is pinned here is that the booking filter
exists, uses it, and looks in the fields a booking is actually searched by.
"""

from app.modules.admin.routes import _booking_keyword_filter, _inquiry_keyword_filter


def test_filter_covers_every_field_staff_would_look_in() -> None:
    sql = str(_booking_keyword_filter("wedding"))
    for column in ("name", "email", "message", "room_type"):
        assert f"booking_requests.{column}" in sql, column


def test_room_type_is_searched_here_and_not_on_enquiries() -> None:
    """The one column a booking has and an enquiry does not."""
    assert "booking_requests.room_type" in str(_booking_keyword_filter("suite"))
    assert "room_type" not in str(_inquiry_keyword_filter("suite"))


def test_wildcards_a_visitor_typed_stay_literal() -> None:
    # Without the escape, "100%" matches every booking and "a_b" matches "axb".
    sql = str(_booking_keyword_filter("100%"))
    assert "ESCAPE" in sql.upper()


def test_the_term_is_bound_not_interpolated() -> None:
    """The pattern must ride as a parameter, never spliced into the SQL text."""
    sql = str(_booking_keyword_filter("'; DROP TABLE booking_requests; --"))
    assert "DROP TABLE" not in sql
