"""The public unsubscribe page, against settings blobs nobody validated.

Site.settings is free-form JSON that an admin edits wholesale, and only its top
level is checked, so anything inside it is whatever was typed. The unsubscribe
endpoint reads it purely to print a friendly site name — the least important
thing on the page — and used to be able to fail the request over it.
"""

from app.modules.email.models import NewsletterSubscriber
from app.modules.newsletter import routes as newsletter_routes
from app.modules.sites.models import Site


class _Request:
    def __init__(self, headers=None):
        self.headers = headers or {}
        self.client = type("C", (), {"host": "203.0.113.7"})()


class _ExecuteResult:
    def __init__(self, item):
        self._item = item

    def scalar_one_or_none(self):
        return self._item

    def scalars(self):
        return self

    def all(self):
        return [] if self._item is None else [self._item]

    def first(self):
        return self._item


class _SiblingResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items


class _FakeSession:
    """One subscriber and its site.

    `siblings` is what the address-wide unsubscribe finds besides the row the
    token resolved to. These tests set up a single subscriber, so the honest
    answer is an empty list — spelled out rather than left to whatever the token
    lookup happened to return, which would have made the unsubscribe act on the
    same row twice.
    """

    def __init__(self, subscriber, site, siblings=None):
        self._subscriber = subscriber
        self._site = site
        self._siblings = siblings or []
        self.committed = False
        self.committed_before_lookup = None
        self.execute_calls = 0

    async def execute(self, _statement):
        self.execute_calls += 1
        # First call resolves the token; the next is the sibling sweep.
        if self.execute_calls == 1:
            return _ExecuteResult(self._subscriber)
        return _SiblingResult(self._siblings)

    async def get(self, _model, _item_id):
        self.committed_before_lookup = self.committed
        return self._site

    async def commit(self):
        self.committed = True


async def test_unsubscribe_survives_a_non_dict_name_translations() -> None:
    """`{"name_translations": "禾境"}` is a plausible hand edit.

    A truthy string sails through both `or {}` guards and then `.get` raises
    AttributeError — a 500 raised *after* the unsubscribe had been committed, so
    the visitor was already unsubscribed but saw a failure and clicked again.
    """
    subscriber = NewsletterSubscriber(id=20, site_id=1, email="guest@example.com", status="subscribed")
    site = Site(
        id=1,
        name="Hejing Villa",
        slug="hejing",
        default_locale="zh",
        settings={"name_translations": "禾境"},
    )
    session = _FakeSession(subscriber, site)

    result = await newsletter_routes.unsubscribe(
        _Request(), token="token-123", locale="en", session=session
    )

    assert (result.ok, result.status) == (True, "unsubscribed")
    assert subscriber.status == "unsubscribed"
    assert session.committed is True
    # Nothing usable to translate with, so the raw site name is the answer.
    assert result.site_name == "Hejing Villa"
    assert result.site_slug == "hejing"
    assert session.committed_before_lookup is False, (
        "the page copy is resolved before the write, so a bad blob cannot leave "
        "the visitor unsubscribed and looking at an error"
    )


async def test_unsubscribe_survives_settings_that_are_not_a_dict_at_all() -> None:
    subscriber = NewsletterSubscriber(id=21, site_id=1, email="guest@example.com", status="subscribed")
    site = Site(id=1, name="Hejing Villa", slug="hejing", default_locale="zh", settings="broken")
    session = _FakeSession(subscriber, site)

    result = await newsletter_routes.unsubscribe(
        _Request(), token="token-123", locale=None, session=session
    )

    assert result.site_name == "Hejing Villa"
    assert subscriber.status == "unsubscribed"


async def test_a_well_formed_translation_is_still_used() -> None:
    """The guard must not quietly disable the feature it protects."""
    subscriber = NewsletterSubscriber(id=22, site_id=1, email="guest@example.com", status="subscribed")
    site = Site(
        id=1,
        name="Hejing Villa",
        slug="hejing",
        default_locale="zh",
        settings={"name_translations": {"zh": "禾境", "en": "Hejing Villa Villa"}},
    )
    session = _FakeSession(subscriber, site)

    result = await newsletter_routes.unsubscribe(
        _Request(), token="token-123", locale="en", session=session
    )

    assert result.site_name == "Hejing Villa Villa"
