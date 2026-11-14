"""Ceilings on how much a single public request can ask the database for.

The public list endpoints take no `limit` and return every published row. That
is deliberate — the front end builds its category facet counts from the whole
list, so a small default page size would silently produce wrong counts, which is
the failure mode this codebase keeps getting bitten by.

So these are ceilings, not page sizes: high enough that no realistic content set
reaches them, low enough that one request cannot be made to serialise the entire
table. Hitting one is logged rather than passed over, because a truncated list
looks exactly like a short one.
"""

import logging

logger = logging.getLogger(__name__)

# Roughly an order of magnitude above the largest site here (~62 pages).
MAX_PUBLIC_ROWS = 500
# `ids=` exists to fetch a stay's few related articles in one call. A few
# hundred is already far past that; the rest is someone probing.
MAX_ID_FILTER = 200


def cap_rows(rows: list, what: str) -> list:
    """Return at most MAX_PUBLIC_ROWS, saying so if it had to cut."""
    if len(rows) <= MAX_PUBLIC_ROWS:
        return rows
    logger.warning(
        "%s returned %d rows and was capped at %d — the list served to visitors is "
        "incomplete. Paginate this endpoint before the content set grows further.",
        what, len(rows), MAX_PUBLIC_ROWS,
    )
    return rows[:MAX_PUBLIC_ROWS]
