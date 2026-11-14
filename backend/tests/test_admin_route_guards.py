"""Three regressions in the admin router, each of which returned 200/201.

  * `PATCH /roles/{id}/permissions` accepted "*" from the request body, so
    anyone holding `roles:write` could write themselves a super-admin role;
  * a site seeded without a template got pages whose `content_type` was a copy
    of the slug, which no public category route knows, so the site's own menu
    404'd on nine of its twelve pages;
  * `PUT /newsletter/campaigns/{id}` dropped `recipient_scope`, so an admin who
    switched a draft from "self" to "self+children" got a 200 and no change.
"""

import asyncio

import pytest
from fastapi import HTTPException

from app.modules.admin.routes import (
    _seed_site_cms,
    update_newsletter_campaign,
    update_role_permissions,
)
from app.modules.auth.models import AdminUser, Role
from app.modules.cms.models import Page
from app.modules.cms.routes import CONTENT_TYPE_TO_CATEGORY
from app.modules.email.models import NewsletterCampaign
from app.modules.sites.models import Site


class _FakeSession:
    """Enough AsyncSession surface for the three handlers under test."""

    def __init__(self, rows=None):
        self.rows = rows or {}
        self.added = []
        self.committed = False

    async def get(self, model, item_id):
        return self.rows.get((model, item_id))

    def add(self, item):
        self.added.append(item)

    def add_all(self, items):
        self.added.extend(items)

    async def commit(self):
        self.committed = True


class _Permissions:
    def __init__(self, permissions):
        self.permissions = permissions


# update_role_permissions gained an `admin` parameter so it can refuse an edit to
# the caller's own role (a `roles:write` holder could otherwise grant themselves
# global_users:write). These tests are about the permission *values*, not about
# who is editing, so the caller is a super-admin — exempt from that rule because
# they already hold "*".
def _as_super_admin(call):
    import app.modules.admin.routes as routes

    async def _stub(_admin, _session):
        return True

    original = routes._is_super_admin
    routes._is_super_admin = _stub
    try:
        return call()
    finally:
        routes._is_super_admin = original

def test_the_super_admin_wildcard_cannot_be_granted_through_the_api() -> None:
    role = Role(id=4, name="editor", permissions=["cms:read"])
    session = _FakeSession({(Role, 4): role})

    # "not-a-permission" used to ride along here, asserting that an unknown
    # name was dropped as quietly as the wildcard. Those are different things —
    # one is policy, the other is a typo — and unknown names are now a 422 (see
    # test_role_permission_validation.py). The wildcard guard below is unchanged
    # and still the subject of this test.
    result = _as_super_admin(lambda: asyncio.run(
        update_role_permissions(
            role_id=4,
            payload=_Permissions(["*", "cms:write"]),
            admin=AdminUser(id=1, email="a@b.co", name="A", role_id=99),
            session=session,
        )
    ))

    assert "*" not in result["permissions"]
    assert "*" not in role.permissions
    assert result["permissions"] == ["cms:write"]


def test_the_super_admin_role_still_has_to_keep_full_access() -> None:
    role = Role(id=1, name="super_admin", permissions=["*"])
    session = _FakeSession({(Role, 1): role})

    with pytest.raises(HTTPException) as raised:
        _as_super_admin(lambda: asyncio.run(update_role_permissions(
            role_id=1,
            payload=_Permissions(["cms:read"]),
            admin=AdminUser(id=1, email="a@b.co", name="A", role_id=99),
            session=session,
        )))

    assert raised.value.status_code == 422
    assert role.permissions == ["*"]


def test_every_seeded_page_has_a_routable_content_type() -> None:
    session = _FakeSession()
    asyncio.run(_seed_site_cms(session, Site(id=7, name="八代町", slug="yashirocho")))

    pages = [item for item in session.added if isinstance(item, Page)]
    assert pages, "the seed is expected to create CMS pages"
    unroutable = sorted(
        {page.content_type for page in pages if page.content_type not in CONTENT_TYPE_TO_CATEGORY}
    )
    assert unroutable == []


def test_editing_a_draft_campaign_persists_its_recipient_scope() -> None:
    campaign = NewsletterCampaign(
        id=3, site_id=1, subject="Old", body="", status="draft",
        target_groups=[], recipient_scope="self", deleted_at=None,
    )
    session = _FakeSession({(NewsletterCampaign, 3): campaign})
    parent = Site(id=1, name="Select", slug="select", parent_site_id=None)

    asyncio.run(
        update_newsletter_campaign(3, _upsert(recipient_scope="self+children"), parent, session)
    )

    assert campaign.recipient_scope == "self+children"
    assert session.committed


def test_a_child_site_cannot_edit_a_draft_into_the_network_wide_scope() -> None:
    campaign = NewsletterCampaign(
        id=3, site_id=2, subject="Old", body="", status="draft",
        target_groups=[], recipient_scope="self", deleted_at=None,
    )
    session = _FakeSession({(NewsletterCampaign, 3): campaign})
    child = Site(id=2, name="八代町", slug="yashirocho", parent_site_id=1)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(
            update_newsletter_campaign(3, _upsert(recipient_scope="self+children"), child, session)
        )

    assert raised.value.status_code == 400
    assert campaign.recipient_scope == "self"


def _upsert(**overrides):
    from app.modules.admin.routes import NewsletterCampaignUpsert

    return NewsletterCampaignUpsert(subject="New", body="hello", **overrides)
