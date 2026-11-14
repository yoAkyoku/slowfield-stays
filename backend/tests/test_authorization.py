"""The tenant boundary itself: who may act, and on which site.

Two independent audits landed every finding in this code and none of it was
covered. `require_permission` returns a closure, so each case here calls the
inner dependency directly with fakes — no HTTP, no database, nothing between
the assertion and the rule being asserted.
"""

import pytest
from fastapi import HTTPException
from sqlalchemy import inspect as sa_inspect

from app.modules.admin import deps
from app.modules.auth.models import AdminUser, Role
from app.modules.sites.models import AdminUserSite, Site


class _Result:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _FakeSession:
    """Enough AsyncSession surface for require_permission and get_admin_site.

    Statements are dispatched on their selected entity rather than matched
    literally, so the fake keeps answering if the dependency's query changes
    shape but keeps asking the same question.
    """

    def __init__(self, *, roles=None, sites=None, links=None, stored_role_ids=None):
        self.roles = roles or {}
        self.sites = sites or {}
        self.links = links or {}  # (admin_user_id, site_id) -> AdminUserSite
        self.stored_role_ids = stored_role_ids or {}  # admin_user_id -> role_id
        self.link_lookups = []

    async def get(self, model, item_id):
        if model is Role:
            return self.roles.get(item_id)
        if model is Site:
            return self.sites.get(item_id)
        raise AssertionError(f"unexpected session.get({model!r})")

    async def execute(self, statement):
        entity = statement.column_descriptions[0]["entity"]
        params = statement.compile().params
        if entity is AdminUserSite:
            key = (params["admin_user_id_1"], params["site_id_1"])
            self.link_lookups.append(key)
            return _Result(self.links.get(key))
        if entity is AdminUser:
            return _Result(self.stored_role_ids.get(params["id_1"]))
        raise AssertionError(f"unexpected select of {entity!r}")


class _FakeRequest:
    def __init__(self, path_params=None):
        self.path_params = path_params or {}


class _RecordingResolver:
    """Stands in for resolve_site so a caller-supplied slug is traceable."""

    def __init__(self, by_slug):
        self.by_slug = by_slug
        self.calls = []
        # Whether the admin path asked to see unpublished sites. resolve_site
        # serves the public with active sites only — a draft site used to be
        # public from the moment it was created — and the admin has to keep
        # seeing them or a site could never be built before going live.
        self.include_unpublished = []

    async def __call__(self, session, host=None, site_slug=None, include_unpublished=False):
        self.calls.append(site_slug)
        self.include_unpublished.append(include_unpublished)
        site = self.by_slug.get(site_slug)
        if site is None:
            raise HTTPException(status_code=404, detail=f"Unknown site '{site_slug}'")
        return site


def _admin(admin_id: int, *, role_id: int | None = None) -> AdminUser:
    admin = AdminUser(email=f"admin{admin_id}@example.test", name="Admin", password_hash="x")
    if role_id is not None:
        admin.role_id = role_id
    # The dependency identifies the caller through the ORM identity key, which
    # only a real session assigns. Stamping it is what lets these tests exercise
    # the actual lookup instead of a stubbed-out copy of it.
    sa_inspect(admin).key = (AdminUser, (admin_id,), None)
    return admin


def _link(admin_id: int, site: Site, role: Role | None) -> AdminUserSite:
    link = AdminUserSite(admin_user_id=admin_id, site_id=site.id, role_id=role.id if role else 0)
    link.role = role
    return link


SITE_A = Site(id=1, name="Villa A", slug="villa-a", domain="a.example.test")
SITE_B = Site(id=2, name="Villa B", slug="villa-b", domain="b.example.test")

SUPER_ROLE = Role(id=1, name="super-admin", permissions=["*"])
SITE_OWNER_ROLE = Role(id=2, name="site-owner", permissions=["site_users:write", "cms:write"])
EDITOR_ROLE = Role(id=3, name="editor", permissions=["cms:read", "cms:write"])
GLOBAL_OPS_ROLE = Role(id=4, name="ops", permissions=["sites:read", "sites:write"])
NO_ACCESS_ROLE = Role(id=5, name="viewer", permissions=[])

ALL_ROLES = {r.id: r for r in (SUPER_ROLE, SITE_OWNER_ROLE, EDITOR_ROLE, GLOBAL_OPS_ROLE, NO_ACCESS_ROLE)}
ALL_SITES = {SITE_A.id: SITE_A, SITE_B.id: SITE_B}
SITES_BY_SLUG = {SITE_A.slug: SITE_A, SITE_B.slug: SITE_B}


@pytest.fixture
def resolver(monkeypatch):
    recorder = _RecordingResolver(SITES_BY_SLUG)
    monkeypatch.setattr(deps, "resolve_site", recorder)
    return recorder


async def _run(permission, admin, session, *, path_params=None, site=None, x_site_slug=None):
    dependency = deps.require_permission(permission)
    return await dependency(
        request=_FakeRequest(path_params),
        admin=admin,
        session=session,
        site=site,
        x_site_slug=x_site_slug,
    )


# --- the super-admin wildcard -------------------------------------------------

@pytest.mark.parametrize("permission", ["*", "sites:write", "cms:write", "newsletter:write"])
async def test_a_super_admin_passes_every_permission_without_any_site_link(permission, resolver):
    admin = _admin(1, role_id=SUPER_ROLE.id)
    session = _FakeSession(roles=ALL_ROLES, sites=ALL_SITES)

    assert await _run(permission, admin, session, x_site_slug="villa-a") is admin
    # The wildcard short-circuits before any site is resolved or any link read.
    assert session.link_lookups == []
    assert resolver.calls == []


async def test_an_admin_without_the_wildcard_is_refused_a_super_admin_only_endpoint(resolver):
    admin = _admin(2, role_id=SITE_OWNER_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(2, SITE_A.id): _link(2, SITE_A, SITE_OWNER_ROLE)},
    )

    with pytest.raises(HTTPException) as raised:
        await _run("*", admin, session, x_site_slug="villa-a")
    assert raised.value.status_code == 403


async def test_a_site_role_carrying_the_wildcard_does_not_make_its_holder_a_super_admin(resolver):
    # Only the global role grants "*"; a wildcard sitting on a per-site link
    # would otherwise promote a single villa's owner to the whole estate.
    admin = _admin(3, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(3, SITE_A.id): _link(3, SITE_A, SUPER_ROLE)},
    )

    with pytest.raises(HTTPException) as raised:
        await _run("*", admin, session, x_site_slug="villa-a")
    assert raised.value.status_code == 403


# --- global permissions are answered by the global role -----------------------

async def test_a_global_permission_is_granted_by_the_global_role_alone(resolver):
    admin = _admin(4, role_id=GLOBAL_OPS_ROLE.id)
    session = _FakeSession(roles=ALL_ROLES, sites=ALL_SITES)

    assert await _run("sites:write", admin, session, x_site_slug="villa-a") is admin
    assert session.link_lookups == []
    assert resolver.calls == []


async def test_a_global_permission_held_only_on_a_site_role_is_refused(resolver):
    # sites:write on a per-site link must not let a villa admin create or edit
    # sites; global permissions are never read off an AdminUserSite role.
    admin = _admin(5, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(5, SITE_A.id): _link(5, SITE_A, GLOBAL_OPS_ROLE)},
    )

    with pytest.raises(HTTPException) as raised:
        await _run("sites:write", admin, session, site="villa-a")
    assert raised.value.status_code == 403


# --- site permissions are answered by the AdminUserSite link ------------------

async def test_a_site_permission_is_granted_by_the_link_for_the_site_being_acted_on(resolver):
    admin = _admin(6, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(6, SITE_A.id): _link(6, SITE_A, EDITOR_ROLE)},
    )

    assert await _run("cms:write", admin, session, x_site_slug="villa-a") is admin
    assert session.link_lookups == [(6, SITE_A.id)]
    assert resolver.calls == ["villa-a"]


async def test_an_admin_with_a_role_on_one_site_is_refused_the_same_permission_on_another(resolver):
    admin = _admin(7, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(7, SITE_A.id): _link(7, SITE_A, EDITOR_ROLE)},
    )

    with pytest.raises(HTTPException) as raised:
        await _run("cms:write", admin, session, x_site_slug="villa-b")
    assert raised.value.status_code == 403
    assert session.link_lookups == [(7, SITE_B.id)]


# --- the path-site rule -------------------------------------------------------

async def test_a_permission_on_a_path_addressed_route_is_checked_against_the_path_site(resolver):
    # /sites/{site_id}/users acting on villa B, with a header naming villa A
    # where this admin does hold site_users:write. Reading the permission-site
    # from the header while the handler mutates the path-site is the escalation
    # the rule exists to stop.
    admin = _admin(8, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={
            (8, SITE_A.id): _link(8, SITE_A, SITE_OWNER_ROLE),
            (8, SITE_B.id): _link(8, SITE_B, EDITOR_ROLE),
        },
    )

    with pytest.raises(HTTPException) as raised:
        await _run(
            "site_users:write",
            admin,
            session,
            path_params={"site_id": "2"},
            site="villa-a",
            x_site_slug="villa-a",
        )
    assert raised.value.status_code == 403
    assert session.link_lookups == [(8, SITE_B.id)]
    # The supplied slug is never consulted once the path names a site.
    assert resolver.calls == []


async def test_a_path_addressed_route_still_passes_when_the_permission_is_held_on_the_path_site(resolver):
    admin = _admin(9, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(9, SITE_A.id): _link(9, SITE_A, SITE_OWNER_ROLE)},
    )

    result = await _run(
        "site_users:write",
        admin,
        session,
        path_params={"site_id": "1"},
        x_site_slug="villa-b",
    )
    assert result is admin
    assert session.link_lookups == [(9, SITE_A.id)]
    assert resolver.calls == []


async def test_a_path_site_id_that_names_no_site_is_a_404_not_a_fallback_to_the_header(resolver):
    admin = _admin(10, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(10, SITE_A.id): _link(10, SITE_A, SITE_OWNER_ROLE)},
    )

    with pytest.raises(HTTPException) as raised:
        await _run(
            "site_users:write",
            admin,
            session,
            path_params={"site_id": "999"},
            x_site_slug="villa-a",
        )
    assert raised.value.status_code == 404
    assert resolver.calls == []


# --- failing closed -----------------------------------------------------------

async def test_an_admin_with_no_role_at_all_is_refused(resolver):
    admin = _admin(11)
    session = _FakeSession(roles=ALL_ROLES, sites=ALL_SITES)

    with pytest.raises(HTTPException) as raised:
        await _run("cms:read", admin, session, x_site_slug="villa-a")
    assert raised.value.status_code == 403


async def test_a_role_id_pointing_at_a_deleted_role_is_refused_rather_than_treated_as_unrestricted(resolver):
    admin = _admin(12, role_id=404)
    session = _FakeSession(roles=ALL_ROLES, sites=ALL_SITES)

    with pytest.raises(HTTPException) as raised:
        await _run("cms:read", admin, session, x_site_slug="villa-a")
    assert raised.value.status_code == 403

    with pytest.raises(HTTPException) as raised:
        await _run("sites:read", admin, session, x_site_slug="villa-a")
    assert raised.value.status_code == 403


async def test_a_site_link_whose_role_is_missing_is_refused(resolver):
    admin = _admin(13, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(13, SITE_A.id): _link(13, SITE_A, None)},
    )

    with pytest.raises(HTTPException) as raised:
        await _run("cms:write", admin, session, x_site_slug="villa-a")
    assert raised.value.status_code == 403


async def test_an_admin_with_no_link_to_the_site_is_refused_every_site_permission(resolver):
    admin = _admin(14, role_id=EDITOR_ROLE.id)
    session = _FakeSession(roles=ALL_ROLES, sites=ALL_SITES)

    # cms:write on the *global* role is not a grant on any site.
    with pytest.raises(HTTPException) as raised:
        await _run("cms:write", admin, session, x_site_slug="villa-a")
    assert raised.value.status_code == 403


async def test_an_unrecognised_permission_string_is_refused(resolver):
    # Neither global nor site set — it must fall through to the deny, not to a
    # branch that happens to return the admin.
    admin = _admin(15, role_id=SITE_OWNER_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(15, SITE_A.id): _link(15, SITE_A, SITE_OWNER_ROLE)},
    )

    with pytest.raises(HTTPException) as raised:
        await _run("billing:write", admin, session, x_site_slug="villa-a")
    assert raised.value.status_code == 403


async def test_the_role_id_is_read_from_the_database_when_it_is_not_loaded_on_the_instance(resolver):
    # A caller arriving with an expired or deferred AdminUser must still be
    # resolved to their role, not silently treated as having none.
    admin = _admin(16)
    session = _FakeSession(roles=ALL_ROLES, sites=ALL_SITES, stored_role_ids={16: SUPER_ROLE.id})

    assert await _run("sites:write", admin, session) is admin


# --- get_admin_site -----------------------------------------------------------

async def test_get_admin_site_returns_the_site_when_an_explicit_link_exists(resolver):
    admin = _admin(17, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(17, SITE_A.id): _link(17, SITE_A, EDITOR_ROLE)},
    )

    assert await deps.get_admin_site(admin=admin, session=session, site="villa-a", x_site_slug=None) is SITE_A


async def test_get_admin_site_refuses_a_site_the_admin_has_no_link_to(resolver):
    # A child-site admin naming the parent's slug by hand gets 403, not the
    # parent site — the SiteSwitcher hiding it is not the control.
    admin = _admin(18, role_id=NO_ACCESS_ROLE.id)
    session = _FakeSession(
        roles=ALL_ROLES,
        sites=ALL_SITES,
        links={(18, SITE_A.id): _link(18, SITE_A, EDITOR_ROLE)},
    )

    with pytest.raises(HTTPException) as raised:
        await deps.get_admin_site(admin=admin, session=session, site=None, x_site_slug="villa-b")
    assert raised.value.status_code == 403


async def test_get_admin_site_lets_a_super_admin_reach_a_site_with_no_link(resolver):
    admin = _admin(19, role_id=SUPER_ROLE.id)
    session = _FakeSession(roles=ALL_ROLES, sites=ALL_SITES)

    assert await deps.get_admin_site(admin=admin, session=session, site="villa-b", x_site_slug=None) is SITE_B


async def test_get_admin_site_refuses_an_admin_whose_only_role_is_global(resolver):
    # A global role is not a site grant: get_admin_site requires the link.
    admin = _admin(20, role_id=GLOBAL_OPS_ROLE.id)
    session = _FakeSession(roles=ALL_ROLES, sites=ALL_SITES)

    with pytest.raises(HTTPException) as raised:
        await deps.get_admin_site(admin=admin, session=session, site="villa-a", x_site_slug=None)
    assert raised.value.status_code == 403
