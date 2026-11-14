"""add admin_users.token_epoch

A JWT carried only ``sub`` and ``exp``, and ``get_current_admin`` checked only
that the account was still active — so changing a password did nothing to
sessions already open with the old one. A stolen token stayed valid for its full
lifetime (``access_token_expire_minutes`` is 7 days), and the only way to end it
was to deactivate the whole account, which locks the owner out as well.

Every token now carries the account's epoch and is rejected once the account's
epoch moves past it. Changing or resetting a password bumps it.

Existing tokens have no ``epc`` claim and are read as epoch 0, which matches the
default here — so nobody is signed out by the deploy itself, and the first
password change after it invalidates them like any other.

Revision ID: 202608300002
Revises: 202608300001
Create Date: 2026-08-30
"""

from alembic import op
import sqlalchemy as sa


revision = "202608300002"
down_revision = "202608300001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "admin_users",
        sa.Column("token_epoch", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("admin_users", "token_epoch")
