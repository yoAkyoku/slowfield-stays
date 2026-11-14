from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.db.session import get_session
from app.main import app
from app.modules.auth.models import PasswordResetToken
from app.modules.auth.routes import get_current_admin, hash_reset_token
from app.modules.auth.security import hash_password, verify_password
from app.modules.sites.context import canonical_domain, normalize_host


class FakeAdmin:
    id = 1
    email = "admin@example.com"
    name = "Owner Admin"
    role_id = 1
    is_active = True
    # Changing a password bumps this so every session opened with the old one
    # stops being accepted; a stolen token used to stay valid for its full seven
    # days no matter what the victim did.
    token_epoch = 0
    # Set when the account is deleted from 帳號管理. Every path that lets someone
    # in reads it: login, get_current_admin, and the password reset below.
    deleted_at = None


def test_public_routes_are_available() -> None:
    client = TestClient(app)

    assert client.get("/api/v1/stays").status_code == 200
    assert client.get("/api/v1/cms/banners").status_code == 200
    assert client.get("/api/v1/cms/pages/experience").status_code == 200
    assert client.get("/api/v1/cms/pages/resolve/experience/experience").status_code == 200
    assert client.get("/api/v1/cms/pages/resolve/experience/1").status_code == 200


def test_media_library_requires_admin() -> None:
    """The media library is not public.

    This assertion used to expect 200, from when /media was an open endpoint. It
    was closed deliberately — the library lists every uploaded asset for a site,
    including anything staged but not yet published — and the assertion was left
    behind, so the suite has been failing ever since and stopped being a signal.
    """
    client = TestClient(app)

    assert client.get("/api/v1/media").status_code == 401


def test_site_host_normalization_helpers() -> None:
    assert normalize_host("www.slowfield.example:443") == "www.slowfield.example"
    assert canonical_domain("www.slowfield.example") == "slowfield.example"
    assert canonical_domain("slowfield.example") == "slowfield.example"


def test_public_page_resolution_returns_category_path() -> None:
    client = TestClient(app)

    response = client.get("/api/v1/cms/pages/resolve/privacy/privacy")

    assert response.status_code == 200
    data = response.json()
    assert data["content_type"] == "privacy"
    assert data["route_category"] == "privacy"
    assert data["public_path"] == "/privacy/privacy"


def test_admin_routes_are_available() -> None:
    client = TestClient(app)

    assert client.get("/api/v1/admin/dashboard").status_code == 401

    async def fake_admin() -> FakeAdmin:
        return FakeAdmin()

    async def fake_session():
        yield None

    app.dependency_overrides[get_current_admin] = fake_admin
    app.dependency_overrides[get_session] = fake_session
    try:
        response = client.get("/api/v1/admin/dashboard")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["metrics"]["published_stays"] == 0


def test_admin_can_change_own_password() -> None:
    client = TestClient(app)
    admin = FakeAdmin()
    admin.password_hash = hash_password("ChangeMe123!")

    class FakeSession:
        committed = False

        async def commit(self) -> None:
            self.committed = True

    fake_db = FakeSession()

    async def fake_admin() -> FakeAdmin:
        return admin

    async def fake_session():
        yield fake_db

    app.dependency_overrides[get_current_admin] = fake_admin
    app.dependency_overrides[get_session] = fake_session
    try:
        response = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "ChangeMe123!", "new_password": "NewPassword123!"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_db.committed is True
    assert verify_password("NewPassword123!", admin.password_hash)


def test_admin_can_reset_password_with_token() -> None:
    client = TestClient(app)
    admin = FakeAdmin()
    admin.password_hash = hash_password("ChangeMe123!")
    reset_token = PasswordResetToken(
        admin_user_id=admin.id,
        token_hash=hash_reset_token("reset-token"),
        expires_at=datetime.now(UTC) + timedelta(minutes=30),
    )

    class FakeResult:
        def scalar_one_or_none(self):
            return reset_token

    class FakeSession:
        committed = False

        async def execute(self, statement):
            return FakeResult()

        async def get(self, model, user_id):
            return admin if user_id == admin.id else None

        async def commit(self) -> None:
            self.committed = True

    fake_db = FakeSession()

    async def fake_session():
        yield fake_db

    app.dependency_overrides[get_session] = fake_session
    try:
        response = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "reset-token", "new_password": "NewPassword123!"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert fake_db.committed is True
    assert reset_token.used_at is not None
    assert verify_password("NewPassword123!", admin.password_hash)


def test_the_client_ip_is_the_visitor_not_the_proxy() -> None:
    """Behind Cloudflare and nginx, `request.client.host` is the last hop.

    The rate limiter knew this and read CF-Connecting-IP; the login audit did
    not, and stamped the proxy's address on every row — the one field anyone
    reaches for after a suspicious sign-in. One resolver now, so they cannot
    drift apart again.
    """
    from app.core.rate_limit import client_ip

    class _Req:
        def __init__(self, headers, host="10.0.0.1"):
            self.headers = headers
            self.client = type("C", (), {"host": host})()

    assert client_ip(_Req({"cf-connecting-ip": "203.0.113.7"})) == "203.0.113.7"
    # Cloudflare's header wins: it is set by our own edge and cannot be forged.
    assert client_ip(_Req({"cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4"})) == "203.0.113.7"
    # X-Forwarded-For is a chain; only the first entry is the client.
    assert client_ip(_Req({"x-forwarded-for": "198.51.100.9, 10.0.0.1"})) == "198.51.100.9"
    # Nothing to go on falls back to the socket rather than inventing a value.
    assert client_ip(_Req({})) == "10.0.0.1"


def test_every_public_write_endpoint_has_a_ceiling() -> None:
    """Unsubscribe was the one public POST with no limiter.

    The token is a 32-byte random so guessing is not the worry; an unthrottled
    endpoint that writes on every hit is. The limit is deliberately generous —
    a real person clicking an unsubscribe link twice must never be told to come
    back later.
    """
    from app.core.rate_limit import (
        booking_form_limiter,
        inquiry_form_limiter,
        subscribe_limiter,
        unsubscribe_limiter,
    )

    for limiter in (booking_form_limiter, inquiry_form_limiter, subscribe_limiter, unsubscribe_limiter):
        assert limiter.max_requests > 0 and limiter.window > 0
    assert unsubscribe_limiter.max_requests >= 10, "an unsubscribe must not be hard to complete"


def test_the_admin_session_length_is_a_single_deliberate_number() -> None:
    """Three numbers claimed to be the session length; none of them agreed.

    This default is what production actually uses — `.dockerignore` excludes
    `.env*`, so no env file reaches the image — while the admin cookie hardcoded
    12 hours against it. The cookie was the shorter of the two, so the session
    ended at 12 hours while the credential stayed valid for another six and a
    half days. The cookie now derives its lifetime from the token's own `exp`
    claim, so this asserts the remaining thing that can go wrong: a lifetime
    nobody chose.
    """
    from app.core.config import settings

    minutes = settings.access_token_expire_minutes
    assert 30 <= minutes <= 10080, f"{minutes} minutes is not a plausible admin session"


def test_a_public_list_is_capped_and_says_so_when_it_cuts(caplog) -> None:
    """The public lists take no `limit` and return every published row.

    That stays true on purpose — the front end counts categories from the whole
    list, so a small default page size would silently produce wrong counts. What
    was missing is a ceiling, so one request cannot be made to serialise the
    whole table, and a log line when it bites: a truncated list is
    indistinguishable from a short one otherwise.
    """
    import logging

    from app.core.limits import MAX_PUBLIC_ROWS, cap_rows

    small = list(range(10))
    assert cap_rows(small, "test") is small, "the common case must not copy the list"

    big = list(range(MAX_PUBLIC_ROWS + 25))
    with caplog.at_level(logging.WARNING):
        capped = cap_rows(big, "GET /test")
    assert len(capped) == MAX_PUBLIC_ROWS
    assert capped == big[:MAX_PUBLIC_ROWS], "the cap keeps the ordering the query chose"
    assert any("capped" in r.message or "capped" in r.getMessage() for r in caplog.records), (
        "silently truncating is the bug, not the fix"
    )


def test_the_related_ids_filter_is_bounded() -> None:
    """`ids=` fetches a stay's handful of related articles.

    Unbounded, it builds an IN clause as long as the caller cares to send.
    """
    from app.core.limits import MAX_ID_FILTER
    from app.modules.cms.routes import _parse_ids

    assert _parse_ids(None) is None, "no filter is not the same as an empty filter"
    assert _parse_ids("") == [], "'these ids' with nothing parseable means no rows"
    assert _parse_ids("3, 9 ,x,12") == [3, 9, 12], "non-numeric entries are dropped, not fatal"
    assert len(_parse_ids(",".join(str(i) for i in range(5000)))) == MAX_ID_FILTER


def test_a_secret_is_never_stored_in_cleartext_in_production(monkeypatch) -> None:
    """Encryption failing open is the security control failing silently.

    `cryptography` was only a transitive extra of python-jose, so swapping the
    JWT library would have removed it — and encrypt_value would have gone on
    returning the SMTP password unchanged, with one log line at import as the
    only trace.
    """
    import pytest

    from app.core import crypto

    monkeypatch.setattr(crypto, "_get_fernet", lambda: None)

    from app.core.config import settings

    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(RuntimeError, match="cleartext"):
        crypto.encrypt_value("hunter2")

    # Locally it still falls back, so development works without a real key.
    monkeypatch.setattr(settings, "app_env", "local")
    assert crypto.encrypt_value("hunter2") == "hunter2"
    # An empty value is not a secret and must not raise on either path.
    monkeypatch.setattr(settings, "app_env", "production")
    assert crypto.encrypt_value("") == ""


def test_cryptography_is_a_declared_dependency() -> None:
    """It is used directly by app/core/crypto.py, so it has to be declared here
    rather than inherited from another package's extra."""
    import pathlib
    import tomllib

    root = pathlib.Path(__file__).resolve().parents[1]
    data = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    deps = " ".join(data["project"]["dependencies"])
    assert "cryptography" in deps


def test_a_media_path_cannot_escape_the_media_root() -> None:
    """Storage keys are server-generated, so this is defence in depth — but the
    delete path joined a database value onto a directory, and the check that
    makes that safe belongs beside the join."""
    from app.modules.media.routes import MEDIA_ROOT, media_path

    ok = media_path("abc123.png")
    assert ok is not None and ok.parent == MEDIA_ROOT.resolve()

    for hostile in ["../../etc/passwd", "..", "/etc/passwd", "", "   ", "a/../../b.png"]:
        assert media_path(hostile) is None, hostile
