"""Only a super-admin can put executable code on a site's public pages.

``ads_code`` and ``body_code`` are rendered as an inline ``<script>`` and
``head_code`` as raw ``<head>`` markup (frontend ``app/(site)/layout.tsx`` and
``app/property/[slug]/layout.tsx``). Those pages are served from the same origin
as ``/admin``, so anything running there can call ``/admin/api/proxy`` with a
visiting admin's cookies — the proxy's CSRF check is same-origin, which a
same-origin request passes by definition.

Editing a site needs only ``site_users:write``, and the site-scoped ``admin``
role has it. A child-site admin could therefore paste JS onto their own site and
wait for a super-admin to open it. The frontend's ``!/[<>"']/`` filter is not a
boundary: ``ads_code`` exists to execute JS, and backticks alone write any
payload without those four characters — measured, three separate payload styles
pass it.

The settings form posts every key on every save, so a non-super-admin's save has
to carry the stored values forward rather than be rejected; refusing would stop
site admins editing anything at all.
"""

import asyncio

from app.modules.admin.routes import update_site
from app.modules.sites.models import Site


SCRIPT_KEYS = ("head_code", "body_code", "ads_code")


class _Permissions:
    def __init__(self, permissions):
        self.permissions = permissions


class _FakeSession:
    def __init__(self, site):
        self._site = site
        self.committed = False

    async def get(self, model, item_id):
        return self._site if item_id == self._site.id else None

    async def execute(self, _statement):
        class _R:
            @staticmethod
            def scalar_one_or_none():
                return None
        return _R()

    async def flush(self):
        return None

    async def commit(self):
        self.committed = True


class _Payload:
    """Only the fields update_site touches."""

    def __init__(self, settings):
        self.settings = settings
        self.name = "Villa"
        self.slug = "villa"
        self.domain = ""
        self.status = "live"
        self.parent_site_id = 1
        self.template_site_id = None
        self.is_template = False
        self.template_version = "v1"
        self.default_locale = "zh"
        self.primary_color = "#000"
        self.accent_color = "#111"
        self.nav_bg = self.nav_text = self.footer_bg = self.footer_text = ""
        self.button_bg = self.button_text = ""
        self.nav_button_bg = self.nav_button_text = ""
        self.footer_button_bg = self.footer_button_text = ""
        self.page_bg = ""
        self.contact_email = self.contact_line = ""
        self.seo_title = "T"
        self.seo_description = "D"


def _site():
    site = Site(id=7, name="Villa", slug="villa", domain="")
    site.settings = {"head_code": "<!-- owner -->", "ads_code": "gtag()", "contact_phone": "0900"}
    return site


def _run(site, payload, is_super):
    """Call the handler with the two role lookups stubbed.

    Both read the database through SQLAlchemy's inspection of a real AdminUser
    row; who holds which role is a separate concern with its own tests
    (test_authorization.py, test_admin_route_guards.py). What is under test here
    is only what the handler does with the answer.
    """
    import app.modules.admin.routes as routes

    original_super = routes._is_super_admin
    original_role = routes._site_role

    async def _stub_super(_admin, _session):
        return is_super

    async def _stub_role(_admin, _site, _session):
        # Not None — the caller has *a* role on this site, which is exactly the
        # case that matters: a site admin who is legitimately editing it.
        return _Permissions(["*"] if is_super else ["site_users:write"])

    routes._is_super_admin = _stub_super
    routes._site_role = _stub_role
    try:
        return asyncio.run(
            update_site(site_id=site.id, payload=payload, admin=object(), session=_FakeSession(site))
        )
    finally:
        routes._is_super_admin = original_super
        routes._site_role = original_role


def test_a_site_admin_cannot_inject_script_through_settings() -> None:
    site = _site()
    # The payload a site-scoped admin would post: every key, with the script
    # ones swapped for a backtick payload that the frontend filter allows.
    attack = "fetch(`/admin/api/proxy?path=/admin/users`,{method:`POST`})"
    _run(site, _Payload({"head_code": "<script>x</script>", "ads_code": attack,
                         "body_code": attack, "contact_phone": "0911"}), is_super=False)

    assert site.settings["ads_code"] == "gtag()", "a site admin overwrote ads_code"
    assert site.settings["head_code"] == "<!-- owner -->", "a site admin overwrote head_code"
    # body_code was not stored before, so it must not appear now either.
    assert "body_code" not in site.settings, "a site admin introduced body_code"
    # Everything else on the same save still goes through — otherwise the guard
    # would have locked site admins out of the settings form entirely.
    assert site.settings["contact_phone"] == "0911", "the guard blocked an ordinary setting"


def test_a_super_admin_still_owns_the_analytics_fields() -> None:
    site = _site()
    _run(site, _Payload({"head_code": "<!-- new -->", "ads_code": "newTag()",
                         "body_code": "console.log(1)", "contact_phone": "0922"}), is_super=True)

    assert site.settings["ads_code"] == "newTag()", "the owner can no longer set their own ads code"
    assert site.settings["head_code"] == "<!-- new -->"
    assert site.settings["body_code"] == "console.log(1)"


def test_clearing_is_still_possible_for_the_owner_only() -> None:
    site = _site()
    _run(site, _Payload({"contact_phone": "0933"}), is_super=True)
    for key in SCRIPT_KEYS:
        assert key not in site.settings, f"{key} survived an owner's clear"

    site = _site()
    _run(site, _Payload({"contact_phone": "0933"}), is_super=False)
    assert site.settings["ads_code"] == "gtag()", "a site admin cleared ads_code by omitting it"
    assert site.settings["head_code"] == "<!-- owner -->", "a site admin cleared head_code by omitting it"
