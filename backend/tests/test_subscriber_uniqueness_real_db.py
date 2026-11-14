"""One live subscription per (site, address), and what the merge does to history.

`newsletter_subscribers` had no uniqueness beyond the primary key. The three
consequences, in the order a real list hits them:

  * the address gets every newsletter once per duplicate row;
  * the unsubscribe token belongs to ONE row, so clicking it leaves the other
    copies sending -- mail after an explicit opt-out;
  * `subscribe()` read the row with `scalar_one_or_none()`, which raises on two,
    so once an address was duplicated it could never sign up again.

Run against the real-database fixture: the point is what the index does and what
the merge leaves behind, and a session that discards the statement can show
neither.
"""

from __future__ import annotations

import asyncio
import importlib.util
from datetime import UTC, datetime
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from app.modules.email.models import NewsletterSubscriber
from app.modules.newsletter.routes import _live_subscriber, _unsubscribe_address
from app.modules.sites.models import Site

from conftest import make

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic" / "versions" / "202608300003_unique_subscriber_per_site.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("subscriber_unique_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _table_with(rows):
    """A throwaway table holding just the columns the merge reads and writes."""
    engine = sa.create_engine("sqlite://")
    conn = engine.connect()
    conn.execute(
        sa.text(
            "CREATE TABLE newsletter_subscribers ("
            "id INTEGER PRIMARY KEY, site_id INTEGER, email TEXT, status TEXT, deleted_at TIMESTAMP)"
        )
    )
    for row in rows:
        conn.execute(
            sa.text(
                "INSERT INTO newsletter_subscribers (id, site_id, email, status, deleted_at) "
                "VALUES (:i, :s, :e, :st, :d)"
            ),
            {
                "i": row[0],
                "s": row[1],
                "e": row[2],
                "st": row[3],
                "d": row[4] if len(row) > 4 else None,
            },
        )
    return conn


def _read(conn):
    return {
        r[0]: (r[1], r[2], r[3], r[4])
        for r in conn.execute(
            sa.text("SELECT id, site_id, email, status, deleted_at FROM newsletter_subscribers")
        ).fetchall()
    }


# -- the merge --------------------------------------------------------------


def test_the_oldest_row_survives_and_the_rest_are_soft_deleted() -> None:
    conn = _table_with([
        (1, 1, "guest@example.com", "subscribed"),
        (2, 1, "guest@example.com", "subscribed"),
        (3, 1, "guest@example.com", "subscribed"),
    ])
    merged = _load_migration()._merge_duplicates(conn)

    rows = _read(conn)
    assert merged == 2
    assert rows[1][3] is None, "the oldest row was not kept live"
    assert rows[2][3] is not None and rows[3][3] is not None, "duplicates were left live"
    # Nothing is destroyed: the rows and their delivery history remain readable.
    assert len(rows) == 3


def test_an_opt_out_anywhere_in_the_group_wins() -> None:
    """The survivor must not resurrect consent.

    There is no `updated_at` on this table, so a subscribed copy and an
    unsubscribed copy cannot be ordered in time. The two mistakes are not
    symmetric -- keeping someone on the list mails a person who opted out, while
    removing them means they sign up again -- so opt-out wins.
    """
    conn = _table_with([
        (1, 1, "guest@example.com", "subscribed"),
        (2, 1, "guest@example.com", "unsubscribed"),
    ])
    _load_migration()._merge_duplicates(conn)

    rows = _read(conn)
    assert rows[1][2] == "unsubscribed", (
        "the surviving row is subscribed even though a copy of this address had "
        "opted out -- the merge would start mailing someone who unsubscribed"
    )


def test_a_subscribed_only_group_stays_subscribed() -> None:
    """The other direction: the rule must not unsubscribe everyone."""
    conn = _table_with([
        (1, 1, "guest@example.com", "subscribed"),
        (2, 1, "guest@example.com", "subscribed"),
    ])
    _load_migration()._merge_duplicates(conn)
    assert _read(conn)[1][2] == "subscribed"


def test_case_differences_are_the_same_address() -> None:
    """A mixed-case row was invisible to a lookup that lowercases its input,
    which is one of the ways a duplicate got created in the first place."""
    conn = _table_with([
        (1, 1, "Guest@Example.com", "subscribed"),
        (2, 1, "guest@example.com", "unsubscribed"),
    ])
    merged = _load_migration()._merge_duplicates(conn)

    rows = _read(conn)
    assert merged == 1, "two spellings of one address were treated as two people"
    assert rows[1][1] == "guest@example.com", "the survivor's address was not normalised"
    assert rows[1][2] == "unsubscribed"


def test_different_sites_are_different_subscriptions() -> None:
    """A villa and its parent brand are separate lists; the same person may be
    on both, and the merge must not collapse them."""
    conn = _table_with([
        (1, 1, "guest@example.com", "subscribed"),
        (2, 2, "guest@example.com", "subscribed"),
    ])
    merged = _load_migration()._merge_duplicates(conn)

    rows = _read(conn)
    assert merged == 0
    assert rows[1][3] is None and rows[2][3] is None


def test_rows_already_erased_are_left_alone() -> None:
    """A soft-deleted row is a record of an erasure, not a duplicate to merge."""
    conn = _table_with([
        (1, 1, "guest@example.com", "subscribed", datetime(2026, 1, 1)),
        (2, 1, "guest@example.com", "subscribed", None),
    ])
    merged = _load_migration()._merge_duplicates(conn)

    rows = _read(conn)
    assert merged == 0, "an already-erased row was counted as a live duplicate"
    assert rows[2][3] is None, "the one live row was soft-deleted"


def test_the_migration_and_the_model_declare_the_same_index() -> None:
    """Two declarations of one constraint; they have to agree.

    The migration creates it on the deployed database, the model creates it in
    any schema built from metadata. If they drift, the tests below pass against
    an index production does not have.
    """
    module = _load_migration()
    # By name, not "the unique one" -- `unsubscribe_token` is unique as well, and
    # picking the first match found that instead.
    by_name = {ix.name: ix for ix in NewsletterSubscriber.__table__.indexes}
    model_index = by_name.get(module.INDEX_NAME)
    assert model_index is not None, (
        f"the model declares no {module.INDEX_NAME}, so a schema built from "
        f"metadata lacks the constraint production has: {sorted(by_name)}"
    )
    assert model_index.unique, "the index exists but does not enforce uniqueness"
    expressions = [str(e) for e in model_index.expressions]
    assert module.SITE_KEY in expressions, expressions
    assert "lower(email)" in expressions, expressions


# -- the index --------------------------------------------------------------


def _seed_site(db):
    db.sync.add(Site(id=1, name="Parent", slug="parent", domain="parent.example"))
    db.sync.commit()


def test_a_second_live_row_for_the_same_address_is_rejected(db_session) -> None:
    _seed_site(db_session)
    db_session.sync.add(
        make(NewsletterSubscriber, site_id=1, email="guest@example.com",
             status="subscribed", unsubscribe_token="tok-1")
    )
    db_session.sync.commit()

    db_session.sync.add(
        make(NewsletterSubscriber, site_id=1, email="guest@example.com",
             status="subscribed", unsubscribe_token="tok-2")
    )
    with pytest.raises(IntegrityError):
        db_session.sync.commit()


def test_signing_up_again_after_an_erasure_is_allowed(db_session) -> None:
    """The index is partial on purpose: an erased row must not lock the address
    out for ever."""
    _seed_site(db_session)
    db_session.sync.add(
        make(NewsletterSubscriber, site_id=1, email="guest@example.com",
             status="unsubscribed", unsubscribe_token="tok-old",
             deleted_at=datetime.now(UTC))
    )
    db_session.sync.commit()

    db_session.sync.add(
        make(NewsletterSubscriber, site_id=1, email="guest@example.com",
             status="subscribed", unsubscribe_token="tok-new")
    )
    db_session.sync.commit()  # must not raise

    live = asyncio.run(_live_subscriber(db_session, 1, "guest@example.com"))
    assert live is not None and live.unsubscribe_token == "tok-new", (
        "the lookup returned the erased row, so a fresh signup revives an erasure"
    )


# -- unsubscribe reaches the address, not one row ---------------------------


def test_an_old_token_unsubscribes_the_surviving_row_too(db_session) -> None:
    """The links already in inboxes carry the merged rows' tokens.

    After the merge those rows are soft-deleted and send nothing, so an
    unsubscribe that only touched the row its token names would stop nothing and
    leave the survivor mailing someone who just asked it not to.
    """
    _seed_site(db_session)
    survivor = make(NewsletterSubscriber, site_id=1, email="guest@example.com",
                    status="subscribed", unsubscribe_token="tok-keep")
    old_copy = make(NewsletterSubscriber, site_id=1, email="guest@example.com",
                    status="subscribed", unsubscribe_token="tok-old",
                    deleted_at=datetime.now(UTC))
    db_session.sync.add_all([survivor, old_copy])
    db_session.sync.commit()

    changed = asyncio.run(_unsubscribe_address(db_session, old_copy))
    db_session.sync.commit()

    assert old_copy.status == "unsubscribed"
    assert survivor.status == "unsubscribed", (
        "the token's own row was opted out and the row that actually sends was not"
    )
    assert changed == 2


def test_unsubscribing_does_not_reach_another_site(db_session) -> None:
    _seed_site(db_session)
    db_session.sync.add(Site(id=2, name="Villa", slug="villa", domain="villa.example"))
    here = make(NewsletterSubscriber, site_id=1, email="guest@example.com",
                status="subscribed", unsubscribe_token="tok-1")
    elsewhere = make(NewsletterSubscriber, site_id=2, email="guest@example.com",
                     status="subscribed", unsubscribe_token="tok-2")
    db_session.sync.add_all([here, elsewhere])
    db_session.sync.commit()

    asyncio.run(_unsubscribe_address(db_session, here))
    db_session.sync.commit()

    assert elsewhere.status == "subscribed", (
        "leaving one site's list also removed the person from another site's"
    )
