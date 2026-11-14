"""give site-scoped admins an empty global role

A role sits in one of two slots. ``AdminUser.role_id`` decides GLOBAL
permissions (``sites:*``, ``global_users:*``, ``roles:*``) and
``AdminUserSite.role_id`` decides SITE ones — that split is the multi-tenant
boundary, and ``admin.deps.require_permission`` enforces it slot by slot.

``create_admin_user`` put the SAME Role row in both slots for a site-scoped
user, so every villa admin's *global* role is the row named "admin". Harmless
while that row holds only site permissions, and a trap the moment anyone ticks
``sites:write`` on it in the roles screen: the picker offers network permissions
beside content ones with nothing to say the two have different blast radii, and
one tick would have handed that power to every site admin on the network at
once, through a slot nobody was looking at.

This repoints those users' global slot at ``site_member``, a role with no
permissions at all. Their site slot is untouched, so what they can do is
unchanged: the row being vacated contributes nothing to a global check today,
which is exactly what makes this safe to run.

If a site role has ALREADY been given a global permission, this stops instead of
guessing. Removing it would revoke something an operator is using; leaving it
silently would leave the hole open. That case needs a person: move the grant to
a purpose-made role, then run the migration again.

Revision ID: 202608300001
Revises: 202608230001
Create Date: 2026-08-30
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "202608300001"
down_revision = "202608230001"
branch_labels = None
depends_on = None

SITE_ROLE_NAMES = ("admin", "editor")
SITE_MEMBER_ROLE = "site_member"
GLOBAL_PERMISSIONS = {
    "sites:read", "sites:write",
    "global_users:read", "global_users:write",
    "roles:read", "roles:write",
}


def _permissions(raw) -> list[str]:
    """`permissions` is JSON; psycopg may hand it back decoded or as text."""
    if isinstance(raw, list):
        return raw
    if isinstance(raw, (str, bytes)):
        try:
            value = json.loads(raw)
        except ValueError:
            return []
        return value if isinstance(value, list) else []
    return []


def upgrade() -> None:
    conn = op.get_bind()

    # Expanding bindparams rather than Postgres' `= ANY(:names)`: the same SQL
    # then runs on SQLite, which is what lets this migration be tested at all.
    site_roles = conn.execute(
        sa.text("SELECT id, name, permissions FROM roles WHERE name IN :names").bindparams(
            sa.bindparam("names", expanding=True)
        ),
        {"names": list(SITE_ROLE_NAMES)},
    ).fetchall()
    if not site_roles:
        return

    # Refuse to decide an authorization question on an operator's behalf.
    contaminated = {
        row.name: sorted(set(_permissions(row.permissions)) & GLOBAL_PERMISSIONS)
        for row in site_roles
        if set(_permissions(row.permissions)) & GLOBAL_PERMISSIONS
    }
    if contaminated:
        detail = "; ".join(f"{name}: {', '.join(perms)}" for name, perms in contaminated.items())
        raise RuntimeError(
            "Cannot split the role slots while a site role carries network-wide "
            f"permissions ({detail}). Those grants reach every site admin through "
            "their global slot. Move them to a purpose-made role, remove them from "
            "the site role, then re-run this migration."
        )

    member_id = conn.execute(
        sa.text("SELECT id FROM roles WHERE name = :name"), {"name": SITE_MEMBER_ROLE}
    ).scalar()
    if member_id is None:
        conn.execute(
            sa.text("INSERT INTO roles (name, permissions) VALUES (:name, :perms)"),
            {"name": SITE_MEMBER_ROLE, "perms": json.dumps([])},
        )
        member_id = conn.execute(
            sa.text("SELECT id FROM roles WHERE name = :name"), {"name": SITE_MEMBER_ROLE}
        ).scalar()

    # Only users who actually have a site link: someone whose sole role is
    # "admin" with no AdminUserSite row is not a site-scoped user and moving
    # them would change what they are.
    conn.execute(
        sa.text(
            """
            UPDATE admin_users
               SET role_id = :member_id
             WHERE role_id IN :site_role_ids
               AND EXISTS (
                     SELECT 1 FROM admin_user_sites
                      WHERE admin_user_sites.admin_user_id = admin_users.id
               )
            """
        ).bindparams(sa.bindparam("site_role_ids", expanding=True)),
        {"member_id": member_id, "site_role_ids": [row.id for row in site_roles]},
    )


def downgrade() -> None:
    """Put the site-scoped users back on the "admin" role globally.

    This restores the shared-row arrangement, which is the defect — but a
    downgrade has to be able to reach the previous state, and the previous state
    was that. Nothing else referenced site_member, so it goes with them.
    """
    conn = op.get_bind()
    member_id = conn.execute(
        sa.text("SELECT id FROM roles WHERE name = :name"), {"name": SITE_MEMBER_ROLE}
    ).scalar()
    if member_id is None:
        return
    admin_id = conn.execute(
        sa.text("SELECT id FROM roles WHERE name = 'admin'")
    ).scalar()
    if admin_id is not None:
        conn.execute(
            sa.text("UPDATE admin_users SET role_id = :admin_id WHERE role_id = :member_id"),
            {"admin_id": admin_id, "member_id": member_id},
        )
    conn.execute(sa.text("DELETE FROM roles WHERE id = :member_id"), {"member_id": member_id})
