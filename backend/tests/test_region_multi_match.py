"""A county spelled two ways is still one county.

`region` and `destination` are free text typed per stay, and the catalogue has
stays filed under both "Yilan" and "宜蘭". The search bar builds its options from
those values, so it offered two chips that both read 宜蘭 and each returned half
the county:

    GET /stays              -> 2
    GET /stays?region=Yilan -> 1
    GET /stays?region=宜蘭   -> 1

The frontend now merges options that read the same and submits every raw value
behind them (frontend/tests/locationOptions.test.mts). This is the other half:
the filter has to match any one of a comma-separated list, while a single value
keeps behaving exactly as it did so old links still work.
"""

import re
from pathlib import Path

import pytest


def _any_match():
    """The filter helper, lifted out of the route so it can be exercised alone."""
    src = Path("app/modules/stays/routes.py").read_text(encoding="utf-8")
    block = re.search(r"    def _any_match.*?\n\n", src, re.S)
    assert block, "the multi-value filter helper is gone from list_stays"
    code = block.group(0).replace("    def", "def").replace("\n        ", "\n    ")
    ns: dict = {}
    exec(compile(code, "<lifted>", "exec"), ns)
    return ns["_any_match"]


@pytest.fixture(scope="module")
def match():
    return _any_match()


@pytest.mark.parametrize(
    ("stored", "query", "expected"),
    [
        # The defect: one chip has to reach both spellings.
        ("宜蘭", "宜蘭,Yilan", True),
        ("Yilan", "宜蘭,Yilan", True),
        ("Taipei", "宜蘭,Yilan", False),
        # A single value behaves exactly as before — old links keep working.
        ("宜蘭", "宜蘭", True),
        ("Yilan", "宜蘭", False),
        ("宜蘭縣", "宜蘭", True),  # still a substring match
        # Nothing surprising on the edges.
        (None, "宜蘭", False),
        ("", "宜蘭", False),
        ("宜蘭", " 宜蘭 , Yilan ", True),  # whitespace around the parts
        ("宜蘭", ",,", False),  # an all-empty list matches nothing
    ],
)
def test_region_matching(match, stored, query, expected) -> None:
    assert match(stored, query) is expected


def test_both_region_and_destination_use_it() -> None:
    src = Path("app/modules/stays/routes.py").read_text(encoding="utf-8")
    assert "_any_match(stay.region, region)" in src, "region no longer accepts a list"
    assert "_any_match(stay.destination, destination)" in src, "destination no longer accepts a list"
    # The single-value lowercase compares they replaced must not come back.
    assert "rneedle in (stay.region or \"\").lower()" not in src
