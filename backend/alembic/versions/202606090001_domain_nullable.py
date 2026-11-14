"""make site domain nullable so child sites don't need one

Revision ID: 202606090001
Revises: 202606020001
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa


revision = "202606090001"
down_revision = "202606020001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make domain nullable (PostgreSQL allows multiple NULLs with unique constraint)
    op.alter_column("sites", "domain", existing_type=sa.String(255), nullable=True)
    # Convert empty domain strings to NULL first
    op.execute("UPDATE sites SET domain = NULL WHERE domain = ''")

def downgrade() -> None:
    # ix_sites_domain (202605150002) is UNIQUE, and this migration exists so that
    # child sites can go without a domain — so on any real database there are
    # several NULLs. Collapsing them all to '' violated that index on the second
    # row, aborting the rollback partway through an incident. The row id gives
    # each one a distinct value instead.
    #
    # .invalid is reserved by RFC 2606 and can never resolve, so a placeholder
    # cannot start matching live traffic in resolve_site the way a plausible
    # hostname could.
    op.execute("UPDATE sites SET domain = 'unset-' || id || '.invalid' WHERE domain IS NULL")
    op.alter_column("sites", "domain", existing_type=sa.String(255), nullable=False)
