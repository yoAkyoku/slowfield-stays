"""One live newsletter subscription per (site, email).

`newsletter_subscribers` had no uniqueness at all beyond the primary key, so the
same address could exist several times for one site. The consequences were not
theoretical:

  * **Duplicate mail.** Every copy gets its own delivery row, so a subscriber
    with three rows receives the newsletter three times.
  * **Unsubscribe that does not stick.** The unsubscribe token belongs to ONE
    row. Clicking it stops that copy and leaves the others sending — mail after
    an explicit opt-out, which is the one thing bulk mail must never do.
  * **A 500 on the signup form.** `subscribe()` reads the existing row with
    `scalar_one_or_none()`, which raises `MultipleResultsFound` as soon as there
    are two. Once an address is duplicated, that address can never subscribe
    again; the form just errors.

The duplicates come from a plain read-then-insert with no constraint underneath:
two concurrent submissions of the same address both find nothing and both
insert.

WHAT THIS DOES TO EXISTING DATA
-------------------------------
Nothing is deleted. Within each group of live rows for the same site and
address, the oldest row is kept and the rest are SOFT-deleted (`deleted_at` is
stamped); they stay readable, and their delivery history stays attached.

The surviving row's status follows the most cautious reading of consent: **if
any copy in the group was unsubscribed, the survivor is unsubscribed.** There is
no `updated_at` on this table, so "subscribed" and "unsubscribed" copies cannot
be ordered in time, and the two possible mistakes are not symmetric — wrongly
keeping someone on the list mails a person who opted out, while wrongly removing
them means they sign up again. Opt-out wins.

Addresses are also normalised to lowercase, which is what the application has
always written; a row stored with different case was invisible to the lookup and
is one of the ways a duplicate got created in the first place.

Revision ID: 202608300003
Revises: 202608300002
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa


revision = "202608300003"
down_revision = "202608300002"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_newsletter_subscriber_site_email"
# coalesce, because site_id is nullable and NULLs are distinct in a unique
# index on every version of Postgres this could land on — legacy rows with no
# site would otherwise be the one place duplicates could still be created.
# -1 is safe as the stand-in: site ids are positive.
SITE_KEY = "coalesce(site_id, -1)"


def _merge_duplicates(bind) -> int:
    rows = bind.execute(
        sa.text(
            "SELECT id, site_id, email, status FROM newsletter_subscribers "
            "WHERE deleted_at IS NULL ORDER BY id"
        )
    ).fetchall()

    groups: dict[tuple[int, str], list[tuple]] = {}
    for row in rows:
        key = (row[1] if row[1] is not None else -1, (row[2] or "").strip().lower())
        groups.setdefault(key, []).append(row)

    merged = 0
    for (_site, email), members in groups.items():
        keeper = members[0]
        # Normalise the survivor's address even when it is alone: the unique
        # index is on lower(email), but the application looks rows up by the
        # lowercase form directly, and a row stored with different case would
        # stay invisible to it.
        opted_out = any((m[3] or "") == "unsubscribed" for m in members)
        rewrite_email = (keeper[2] or "") != email
        opt_out_keeper = opted_out and (keeper[3] or "") != "unsubscribed"
        # Only touch rows that actually change. This runs inside
        # `alembic upgrade head`, which the backend executes before it starts
        # serving, so an unconditional UPDATE per subscriber would add the whole
        # list's write time to every deploy — for a list that is already tidy,
        # to achieve nothing.
        if rewrite_email or opt_out_keeper:
            assignments = []
            if rewrite_email:
                assignments.append("email = :email")
            if opt_out_keeper:
                assignments.append("status = 'unsubscribed'")
            bind.execute(
                sa.text(
                    "UPDATE newsletter_subscribers SET "
                    + ", ".join(assignments)
                    + " WHERE id = :id"
                ),
                {"email": email, "id": keeper[0]},
            )
        for duplicate in members[1:]:
            bind.execute(
                sa.text(
                    "UPDATE newsletter_subscribers SET deleted_at = CURRENT_TIMESTAMP "
                    "WHERE id = :id"
                ),
                {"id": duplicate[0]},
            )
            merged += 1
    return merged


def upgrade() -> None:
    bind = op.get_bind()
    _merge_duplicates(bind)
    op.create_index(
        INDEX_NAME,
        "newsletter_subscribers",
        [sa.text(SITE_KEY), sa.text("lower(email)")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    # The index goes; the merge does not come back. Un-merging would mean
    # re-creating duplicate live subscriptions — restoring a defect — and the
    # merge destroyed nothing, so there is nothing to recover. The soft-deleted
    # rows are still there to read.
    op.drop_index(INDEX_NAME, table_name="newsletter_subscribers")
