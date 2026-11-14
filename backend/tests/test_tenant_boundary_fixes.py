"""Four ways a semi-trusted tenant reached past their own site.

  * a ``draft`` site — documented as "not live yet" — was served to the public
    from the moment it was created;
  * ``smtp_host`` was free text and the "send test" button dialled it, so the
    backend would open a TCP connection to any address a site admin named;
  * ``update_site`` took the network topology fields from the payload, so a
    villa admin could re-parent their site, mark it a template, or flip a
    status the operator had left as draft;
  * ``global_users:write`` could deactivate every super-admin, and auth rejects
    an inactive user's token at once — a full lockout of the only people who
    could undo it.
"""

import asyncio
from unittest.mock import patch

import pytest
from fastapi import HTTPException

import app.modules.admin.routes as routes
from app.core.config import settings
from app.modules.admin.routes import update_admin_user_status, update_site
from app.modules.auth.models import AdminUser, Role
from app.modules.email.relay_guard import ALLOWED_SMTP_PORTS, RelayNotAllowed, check_relay
from app.modules.sites.models import Site


# ── draft sites are not public ───────────────────────────────────────────────

def test_the_public_resolver_only_serves_active_sites() -> None:
    """Asserted on the query, because the filter IS the behaviour."""
    import inspect as _inspect

    from app.modules.sites.context import resolve_site

    src = _inspect.getsource(resolve_site)
    assert 'live_only = Site.status == "active"' in src, "the public filter is gone"
    assert 'status_filter = Site.status != "archived" if include_unpublished else live_only' in src, (
        "the public path no longer distinguishes draft from active"
    )
    # Every lookup must use the computed filter, not a status literal of its
    # own — that is how one path came to serve drafts while another did not.
    # Checked on the queries rather than the whole body, since the line that
    # DEFINES the filter necessarily mentions both statuses.
    body = "\n".join(
        line for line in src.splitlines() if "status_filter =" not in line
    )
    queries = [seg for seg in body.split("select(Site)")[1:]]
    assert len(queries) >= 3, f"expected at least 3 site lookups, found {len(queries)}"
    for query in queries:
        head = query[: query.find(")\n") if ")\n" in query else 300]
        assert "Site.status" not in head, (
            f"a lookup filters on status itself instead of using status_filter: {head.strip()[:90]}"
        )
    assert body.count("status_filter") >= 3, "a site lookup is not using the computed filter"


def test_the_admin_can_still_reach_a_draft_site() -> None:
    # Otherwise a site could never be built before it goes live.
    import inspect as _inspect

    from app.modules.admin.deps import get_admin_site, require_permission

    for fn in (get_admin_site, require_permission):
        src = _inspect.getsource(fn)
        assert "include_unpublished=True" in src, (
            f"{fn.__name__} resolves sites the public way — draft sites become uneditable"
        )


# ── the SMTP relay ───────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "host",
    ["127.0.0.1", "localhost", "169.254.169.254", "10.0.0.5", "192.168.1.10", "0.0.0.0"],
)
def test_production_refuses_a_relay_inside_the_network(host) -> None:
    with patch.object(settings, "app_env", "production"):
        with pytest.raises(RelayNotAllowed):
            check_relay(host, 587)


@pytest.mark.parametrize("port", [22, 80, 443, 3306, 5432, 6379, 8080])
def test_production_refuses_a_port_that_is_not_for_mail(port) -> None:
    with patch.object(settings, "app_env", "production"):
        with pytest.raises(RelayNotAllowed):
            check_relay("smtp.gmail.com", port)


def test_production_allows_a_real_relay() -> None:
    with patch.object(settings, "app_env", "production"):
        for port in sorted(ALLOWED_SMTP_PORTS):
            check_relay("smtp.gmail.com", port)


def test_a_host_that_does_not_resolve_is_refused() -> None:
    # It cannot be a working relay, and letting it through would leave the
    # decision to the connection attempt this exists to prevent.
    with patch.object(settings, "app_env", "production"):
        with pytest.raises(RelayNotAllowed):
            check_relay("no-such-host.invalid", 587)


def test_an_empty_host_is_refused_everywhere() -> None:
    with pytest.raises(RelayNotAllowed):
        check_relay("", 587)
    with pytest.raises(RelayNotAllowed):
        check_relay("   ", 587)


def test_local_development_keeps_its_mailhog() -> None:
    # 1025 is not a mail port and 127.0.0.1 is not public; both are how this is
    # developed, so the exemption has to come before either check.
    with patch.object(settings, "app_env", "local"):
        check_relay("127.0.0.1", 1025)
        check_relay("mailhog", 1025)


def test_both_the_save_and_the_test_button_check() -> None:
    import inspect as _inspect

    from app.modules.admin.routes import test_email_settings, update_email_settings

    for fn in (update_email_settings, test_email_settings):
        assert "check_relay(" in _inspect.getsource(fn), (
            f"{fn.__name__} does not check the relay — a row stored before the "
            "guard existed would still be dialled"
        )


# ── site topology ────────────────────────────────────────────────────────────

class _Session:
    def __init__(self, site):
        self._site = site

    async def get(self, _model, _id):
        return self._site

    async def execute(self, _s):
        class _R:
            @staticmethod
            def scalar_one_or_none():
                return None
        return _R()

    async def flush(self):
        return None

    async def commit(self):
        return None


class _SitePayload:
    def __init__(self, **over):
        self.name = "Villa"
        self.slug = "villa"
        self.domain = ""
        self.status = "active"
        self.parent_site_id = None
        self.template_site_id = None
        self.is_template = False
        self.template_version = "v1"
        self.default_locale = "zh"
        self.primary_color = self.accent_color = "#000"
        self.nav_bg = self.nav_text = self.footer_bg = self.footer_text = ""
        self.button_bg = self.button_text = ""
        self.nav_button_bg = self.nav_button_text = ""
        self.footer_button_bg = self.footer_button_text = ""
        self.page_bg = ""
        self.contact_email = self.contact_line = ""
        self.seo_title = "T"
        self.seo_description = "D"
        self.settings = {}
        self.__dict__.update(over)


def _run_update(site, payload, is_super):
    async def _stub_super(_a, _s):
        return is_super

    async def _stub_role(_a, _s, _sess):
        return Role(id=2, name="admin", permissions=["site_users:write"])

    orig_super, orig_role = routes._is_super_admin, routes._site_role
    routes._is_super_admin, routes._site_role = _stub_super, _stub_role
    try:
        asyncio.run(update_site(site_id=site.id, payload=payload, admin=object(), session=_Session(site)))
    finally:
        routes._is_super_admin, routes._site_role = orig_super, orig_role


def _villa():
    site = Site(id=7, name="Villa", slug="villa", domain="")
    site.status, site.parent_site_id, site.template_site_id = "draft", 1, None
    site.is_template, site.settings = False, {}
    return site


def test_a_tenant_cannot_move_their_site_in_the_network() -> None:
    site = _villa()
    _run_update(site, _SitePayload(parent_site_id=None, template_site_id=99,
                                   is_template=True, status="active",
                                   slug="stolen", domain="evil.example"), is_super=False)
    assert site.parent_site_id == 1, "a tenant re-parented their own site"
    assert site.is_template is False, "a tenant marked their site a template"
    assert site.status == "draft", "a tenant published a site the operator left as draft"
    assert site.slug == "villa", "a tenant changed their slug"
    assert site.domain == "", "a tenant claimed a domain"
    # The things they legitimately own still go through.
    assert site.name == "Villa"


def test_the_operator_still_owns_those_fields() -> None:
    site = _villa()
    _run_update(site, _SitePayload(parent_site_id=None, is_template=True,
                                   status="active", slug="renamed"), is_super=True)
    assert site.is_template is True
    assert site.status == "active"
    assert site.slug == "renamed"


# ── deactivating a super-admin ───────────────────────────────────────────────

class _UserSession:
    def __init__(self, user, role):
        self.user, self.role = user, role

    async def get(self, model, item_id):
        return self.role if model is Role else self.user

    async def commit(self):
        return None


class _Status:
    def __init__(self, status):
        self.status = status


def _set_status(target_role_perms, status, is_super):
    user = AdminUser(id=42, email="owner@x.co", name="Owner", role_id=1)
    user.is_active = True
    role = Role(id=1, name="super_admin", permissions=target_role_perms)

    async def _stub(_a, _s):
        return is_super

    original = routes._is_super_admin
    routes._is_super_admin = _stub
    try:
        asyncio.run(
            update_admin_user_status(
                user_id=42,
                payload=_Status(status),
                admin=AdminUser(id=9, email="c@d.co", name="C", role_id=5),
                session=_UserSession(user, role),
            )
        )
    finally:
        routes._is_super_admin = original
    return user


def test_a_non_super_admin_cannot_deactivate_a_super_admin() -> None:
    with pytest.raises(HTTPException) as exc:
        _set_status(["*"], "archived", is_super=False)
    assert exc.value.status_code == 403


def test_a_super_admin_can() -> None:
    user = _set_status(["*"], "archived", is_super=True)
    assert user.is_active is False


def test_an_ordinary_account_is_unaffected() -> None:
    user = _set_status(["cms:read"], "archived", is_super=False)
    assert user.is_active is False, "the guard now blocks deactivating ordinary users too"


def test_reactivating_is_never_blocked() -> None:
    # The guard is about lockout; turning someone back on cannot cause one.
    user = _set_status(["*"], "active", is_super=False)
    assert user.is_active is True


# ── a password change ends other sessions ────────────────────────────────────

def test_a_token_carries_the_accounts_epoch() -> None:
    from jose import jwt

    from app.core.config import settings
    from app.modules.auth.security import ALGORITHM, create_access_token

    claims = jwt.decode(create_access_token("42", 7), settings.secret_key, algorithms=[ALGORITHM])
    assert claims["sub"] == "42"
    assert claims["epc"] == 7, "the token no longer carries the epoch, so it can never be invalidated"
    # A token minted before this claim existed must still work: it is read as
    # epoch 0, so the deploy does not sign everyone out.
    legacy = jwt.decode(create_access_token("42"), settings.secret_key, algorithms=[ALGORITHM])
    assert legacy["epc"] == 0


def test_a_token_from_before_the_change_is_rejected() -> None:
    import inspect as _inspect

    from app.modules.auth.routes import get_current_admin

    src = _inspect.getsource(get_current_admin)
    assert 'int(payload.get("epc", 0))' in src, (
        "the epoch claim is not read, or a missing one is no longer treated as 0"
    )
    assert "if token_epoch < (user.token_epoch or 0):" in src, (
        "a token older than the account's epoch is accepted again"
    )


def test_changing_or_resetting_a_password_bumps_the_epoch() -> None:
    import inspect as _inspect

    from app.modules.auth.routes import change_password, reset_password

    for fn in (change_password, reset_password):
        src = _inspect.getsource(fn)
        assert "token_epoch" in src and "+ 1" in src, (
            f"{fn.__name__} no longer ends the sessions opened with the old password"
        )
    # …and the caller of change_password gets a replacement, or the act of
    # changing their password would sign them out.
    assert "access_token=create_access_token" in _inspect.getsource(change_password), (
        "change_password does not hand back a new token — the caller is signed out by their own action"
    )
