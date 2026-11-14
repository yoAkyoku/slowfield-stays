"""What resolve_site does when the database will not answer.

The degraded default is deliberate: a transient DB fault should not take the
marketing pages down. What it must not do is stay invisible, and it must not
leave a phantom Site attached to the session, because resolve_site also runs on
the write paths (inquiry, newsletter signup, booking, media upload) and anything
attached there is flushed with whatever that request commits.
"""

import logging

import pytest
from fastapi import HTTPException

from app.modules.sites.context import DEFAULT_SITE_SLUG, ensure_default_site, resolve_site


class _EmptySession:
    """A healthy session whose queries simply match nothing."""

    async def execute(self, *args, **kwargs):
        class _Result:
            @staticmethod
            def scalar_one_or_none():
                return None

            @staticmethod
            def scalars():
                class _S:
                    @staticmethod
                    def all():
                        return []

                return _S()

        return _Result()

    async def rollback(self) -> None:  # pragma: no cover - never reached here
        raise AssertionError("a query that matched nothing is not an error")


async def test_a_named_site_that_does_not_exist_is_refused_not_substituted() -> None:
    """A slug that matches nothing must 404, not fall through to the default.

    This ran on the admin paths too, so a typo in `?site=` — or a bookmark
    pointing at a since-renamed site — returned 200 and served, and let the
    caller edit, a different tenant's content while looking entirely successful.
    """
    with pytest.raises(HTTPException) as excinfo:
        await resolve_site(_EmptySession(), host=None, site_slug="no-such-site")

    assert excinfo.value.status_code == 404
    assert "no-such-site" in str(excinfo.value.detail)


async def test_the_refusal_is_not_swallowed_by_the_degraded_fallback() -> None:
    """The 404 is raised inside the same try that catches DB faults.

    Without an explicit re-raise it would be caught as if the database had
    failed, and answered with the stand-in default site — reinstating the exact
    bug above by a different route.
    """
    with pytest.raises(HTTPException):
        await resolve_site(_EmptySession(), host="hejing.example.com", site_slug="no-such-site")


class _DeadSession:
    """A session whose every query fails, as during a DB outage."""

    def __init__(self) -> None:
        self.added: list[object] = []
        self.rolled_back = False

    async def execute(self, *args, **kwargs):
        raise RuntimeError("connection reset by peer")

    async def rollback(self) -> None:
        self.rolled_back = True

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        pass


async def test_slug_lookup_degrades_to_a_default_site_and_says_so(caplog) -> None:
    session = _DeadSession()
    with caplog.at_level(logging.ERROR):
        site = await resolve_site(session, host=None, site_slug="hejing")

    assert site.slug == DEFAULT_SITE_SLUG
    assert session.rolled_back, "a failed query must not leave the transaction poisoned"
    assert [r for r in caplog.records if r.levelno >= logging.ERROR], (
        "a request served against the wrong site is only visible if this is logged"
    )
    assert caplog.records[0].exc_info is not None, "the exception itself must reach the log"


async def test_host_lookup_degrades_to_a_default_site(caplog) -> None:
    session = _DeadSession()
    with caplog.at_level(logging.ERROR):
        site = await resolve_site(session, host="hejing.example.com")

    assert site.slug == DEFAULT_SITE_SLUG
    assert session.rolled_back
    assert [r for r in caplog.records if r.levelno >= logging.ERROR]


@pytest.mark.parametrize(
    "kwargs",
    [{"site_slug": "hejing"}, {"host": "hejing.example.com"}],
)
async def test_the_stand_in_site_is_never_attached_to_the_session(kwargs) -> None:
    session = _DeadSession()
    site = await resolve_site(session, **kwargs)

    assert session.added == [], (
        "the stand-in has a hardcoded id=1; attached, it would be flushed with the "
        "next commit on a write path and insert a phantom site row"
    )
    assert site not in session.added


async def test_the_public_site_payload_never_carries_internal_notes() -> None:
    """`/site/resolve` is unauthenticated, so its settings blob is publication.

    Site.settings is free-form JSON admins write wholesale, and it filtered on a
    denylist of five names — so every key not on that list was public by default.
    The readiness flow writes qa_status, qa_note and qa_decision into the same
    blob and none of them were listed, which served staff QA notes to anyone who
    asked. The front end reads those three off /admin/readiness, not from here.
    """
    from app.modules.sites.routes import public_site_settings

    published = public_site_settings(
        {
            "logo_url": "/media/logo.png",
            "name_translations": {"en": "Hejing Villa"},
            "pages": {"journal": {"visible": True}},
            "hero_journal": "/media/journal.jpg",
            "instagram": "https://instagram.test/hejing",
            "social_facebook": "https://facebook.test/hejing",
            "footer_copyright": {"zh": "© 2026 禾境", "en": "© 2026 Hejing Villa"},
            "qa_status": {"copy": "blocked"},
            "qa_note": "owner still disputes the refund wording",
            "qa_decision": "pending",
            "internal": {"seat": 3},
            "stripe_restricted_key": "rk_live_xxx",
        }
    )

    assert set(published) == {
        "logo_url",
        "name_translations",
        "pages",
        "hero_journal",  # CategoryPage.tsx builds hero_<content_type> per type
        "instagram",
        "social_facebook",
        "footer_copyright",
        # derived from pages, not copied from the blob: only the public fields
        "article_categories",
    }
    assert published["article_categories"] == {
        "journal": {"label": {"zh": "旅遊專欄", "en": "journal"}, "status": "active", "sort_order": 99}
    }
    assert "qa_note" not in published
    assert not any(key.startswith("qa_") for key in published)
    assert "stripe_restricted_key" not in published, (
        "an unrecognised key must default to private; the denylist defaulted to public"
    )


async def test_a_settings_blob_that_is_not_a_dict_does_not_break_resolve() -> None:
    """Same class of bug as the newsletter one: the column is only top-level checked."""
    from app.modules.sites.routes import public_site_settings

    assert public_site_settings(None) == {}
    assert public_site_settings("禾境") == {}
    assert public_site_settings([]) == {}


async def test_a_database_that_cannot_be_read_at_all_raises_rather_than_pretends() -> None:
    """No host and no slug reaches ensure_default_site, which must not swallow.

    That is the create-the-default path, so a failure there is a
    misconfiguration (wrong DATABASE_URL, migrations not run) rather than a
    blip, and answering it with a stand-in would let a deploy pointed at the
    wrong database look healthy.
    """
    session = _DeadSession()
    with pytest.raises(RuntimeError):
        await resolve_site(session, host=None, site_slug=None)

    with pytest.raises(RuntimeError):
        await ensure_default_site(session)
