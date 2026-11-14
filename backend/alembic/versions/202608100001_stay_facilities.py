"""add stays.facilities

The search bar's 服務設施 filter matched its canonical values (戲水池, KTV…)
against each villa's `amenities`. But amenities is the copy shown on the villa
page, which the client writes in their own voice — "14 米中庭泳池 · Courtyard
Pool" — so no needle ever matched and every facility option returned nothing.

One field could not be both a controlled vocabulary and marketing prose.
`facilities` holds the ticked canonical values; `amenities` keeps the copy.

Revision ID: 202608100001
Revises: 202608090002
Create Date: 2026-08-10
"""

from alembic import op
import sqlalchemy as sa


revision = "202608100001"
down_revision = "202608090002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "stays",
        sa.Column("facilities", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("stays", "facilities")
