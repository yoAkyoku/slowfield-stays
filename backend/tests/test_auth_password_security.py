"""Whose SMTP relay a password reset goes out over, and how hard the hashes are.

The reset mail used to be handed to `get_email_settings(session)` with no site,
which returned the lowest-id row in the whole table — whichever tenant happened
to configure email first. Every site admin can edit their own smtp_host, so that
tenant's admin received every other admin's reset link on a server they control.
"""

import logging

import pytest
from passlib.context import CryptContext
from sqlalchemy import Update

from app.modules.auth import security
from app.modules.auth.routes import forgot_password
from app.modules.auth.models import AdminUser
from app.modules.auth.schemas import ForgotPasswordRequest
from app.modules.email import service as email_service
from app.modules.email.models import EmailSettings
from app.modules.sites.models import AdminUserSite


class _Scalars:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class _Result:
    def __init__(self, items):
        self._items = items

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None

    def scalars(self):
        return _Scalars(self._items)


class _FakeSession:
    """Answers the four queries forgot_password makes, by entity."""

    def __init__(self, *, user, site_ids, email_settings):
        self.user = user
        self.site_ids = site_ids
        self.email_settings = email_settings
        self.added = []

    async def execute(self, statement):
        if isinstance(statement, Update):
            return _Result([])
        entity = statement.column_descriptions[0]["entity"]
        if entity is AdminUser:
            return _Result([self.user] if self.user else [])
        if entity is AdminUserSite:
            return _Result(list(self.site_ids))
        if entity is EmailSettings:
            wanted = statement.compile().params.get("site_id_1")
            rows = sorted(self.email_settings, key=lambda row: row.id)
            if wanted is None:
                # What the unfixed code did: order by id, take the first row.
                return _Result(rows[:1])
            return _Result([row for row in rows if row.site_id == wanted])
        raise AssertionError(f"unexpected query for {entity}")

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        pass


class _FakeRequest:
    def __init__(self, ip):
        self.headers = {"cf-connecting-ip": ip}
        self.client = None


def _settings(row_id, site_id, host):
    return EmailSettings(
        id=row_id,
        site_id=site_id,
        is_enabled=True,
        smtp_host=host,
        smtp_port=587,
        from_email=f"noreply@{host}",
        from_name="Slowfield Stays",
    )


def _victim():
    return AdminUser(
        id=7,
        email="victim@example.com",
        name="Victim",
        password_hash="x",
        role_id=1,
        is_active=True,
    )


async def test_a_password_reset_never_borrows_another_sites_smtp(monkeypatch) -> None:
    captured = {}

    def fake_send(settings, to_email, subject, body, html=False):
        captured.update({"settings": settings, "to_email": to_email})
        return True

    monkeypatch.setattr(email_service, "_send_email_sync", fake_send)

    session = _FakeSession(
        user=_victim(),
        site_ids=[2],
        email_settings=[
            _settings(1, 1, "smtp.site-a.example"),
            _settings(2, 2, "smtp.site-b.example"),
        ],
    )

    response = await forgot_password(
        ForgotPasswordRequest(email="victim@example.com"),
        _FakeRequest("203.0.113.10"),
        session,
    )

    assert response.accepted is True
    assert captured["to_email"] == "victim@example.com"
    assert captured["settings"].site_id == 2, (
        "site A configured email first; that does not make it this user's relay"
    )
    assert captured["settings"].smtp_host == "smtp.site-b.example"


async def test_a_reset_for_an_unlinked_user_sends_nothing_and_still_says_nothing(
    monkeypatch, caplog
) -> None:
    """No site link means no relay that is unambiguously this user's.

    The response must not change either way, or it becomes an account oracle.
    """
    sends = []
    monkeypatch.setattr(
        email_service, "_send_email_sync", lambda *args, **kwargs: sends.append(args) or True
    )

    session = _FakeSession(
        user=_victim(),
        site_ids=[],
        email_settings=[_settings(1, 1, "smtp.site-a.example")],
    )

    with caplog.at_level(logging.ERROR):
        response = await forgot_password(
            ForgotPasswordRequest(email="victim@example.com"),
            _FakeRequest("203.0.113.11"),
            session,
        )

    assert sends == []
    assert response.accepted is True
    assert [r for r in caplog.records if r.levelno >= logging.ERROR], (
        "a reset nobody can receive is only visible if it is logged"
    )

    unknown = _FakeSession(
        user=None, site_ids=[], email_settings=[_settings(1, 1, "smtp.site-a.example")]
    )
    missing = await forgot_password(
        ForgotPasswordRequest(email="nobody@example.com"),
        _FakeRequest("203.0.113.12"),
        unknown,
    )
    assert (missing.accepted, missing.message) == (response.accepted, response.message)


async def test_get_email_settings_refuses_to_guess_a_site() -> None:
    session = _FakeSession(user=None, site_ids=[], email_settings=[])

    with pytest.raises(ValueError):
        await email_service.get_email_settings(session, None)

    # Omitting it entirely is not a way around the check.
    with pytest.raises(TypeError):
        await email_service.get_email_settings(session)


def test_passwords_are_hashed_at_the_configured_work_factor() -> None:
    assert security.PBKDF2_ROUNDS >= 600_000, "OWASP's current PBKDF2-HMAC-SHA256 floor"

    digest = security.hash_password("correct horse battery staple")
    assert digest.split("$")[2] == str(security.PBKDF2_ROUNDS)
    assert security.verify_password("correct horse battery staple", digest)
    assert security.needs_rehash(digest) is False

    legacy = CryptContext(
        schemes=["pbkdf2_sha256"], pbkdf2_sha256__default_rounds=29_000
    ).hash("correct horse battery staple")
    assert security.verify_password("correct horse battery staple", legacy), (
        "raising the work factor must not lock existing admins out"
    )
    assert security.needs_rehash(legacy) is True, (
        "login re-hashes on this flag; passlib reads min_rounds, not default_rounds, to set it"
    )
