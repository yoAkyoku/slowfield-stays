"""Keyword search over enquiries.

The meeting asked whether enquiries could be auto-routed to a person by type,
and settled on searching instead. Staff know a name, a subject line, or a phrase
from the message; they do not know which category the sender picked.

What is worth covering is the escaping. LIKE treats % and _ as wildcards, so
without an escape a search for "100%" matches every enquiry and "a_b" matches
"axb" — a search that looks like it works and quietly returns the wrong rows.
"""

from app.modules.admin.routes import _inquiry_keyword_filter, like_pattern


def test_term_is_wrapped_in_wildcards() -> None:
    assert like_pattern("wedding") == "%wedding%"


def test_a_typed_percent_is_escaped() -> None:
    assert like_pattern("100%") == "%100\\%%"


def test_a_typed_underscore_is_escaped() -> None:
    assert like_pattern("a_b") == "%a\\_b%"


def test_backslash_is_escaped_before_the_wildcards() -> None:
    # Escaping % first and the backslash second would double this function's own
    # escape characters and hand the wildcards back to the pattern.
    assert like_pattern("back\\slash") == "%back\\\\slash%"


def test_non_ascii_terms_are_untouched() -> None:
    assert like_pattern("林小姐") == "%林小姐%"


def test_filter_covers_every_field_staff_would_look_in() -> None:
    sql = str(_inquiry_keyword_filter("wedding"))
    for column in ("name", "email", "subject", "message"):
        assert f"inquiries.{column}" in sql, column
    # Matching any one of them is enough.
    assert " OR " in sql
