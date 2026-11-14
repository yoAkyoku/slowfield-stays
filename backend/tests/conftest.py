"""A session that actually runs the query.

Every test in this suite hand-rolls a `_FakeSession`, and every one of them
throws the statement away: `async def execute(self, _statement)` returns canned
rows chosen by call order or by model. That makes them blind to the single most
important property of this codebase — the `WHERE site_id == …` on every
tenant-scoped query.

Measured, not assumed: removing the site filter from `delete_site`, so that
deleting one villa cascades across **every site in the database**, leaves all
293 tests green. The same is true of six other isolation filters. The multi-tenant
boundary had no regression protection at all.

The fixtures here give a handler a real database. `execute()` compiles and runs
the statement against in-memory SQLite, so a dropped `WHERE` changes the rows
that come back and the test fails.

SQLite rather than Postgres because it needs no service and no fixture data
cleanup; sync SQLAlchemy behind an async facade rather than `aiosqlite` because
that package is not a dependency of this project and a test helper is not a
reason to add one. The handlers only ever use the async methods below.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base

# Importing the model modules is what registers them on Base.metadata; without
# this, create_all() makes no tables and every query fails with "no such table".
import app.modules.auth.models  # noqa: F401
import app.modules.bookings.models  # noqa: F401
import app.modules.cms.models  # noqa: F401
import app.modules.email.models  # noqa: F401
import app.modules.inquiries.models  # noqa: F401
import app.modules.media.models  # noqa: F401
import app.modules.sites.models  # noqa: F401
import app.modules.stays.models  # noqa: F401


class AsyncSessionFacade:
    """The async surface of AsyncSession, backed by a real sync Session.

    Only the methods the admin handlers use. Anything missing raises
    AttributeError at the call site, which is the honest failure — better than
    a stub that silently returns nothing and lets a test pass for it.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    async def execute(self, statement, *args, **kwargs):
        return self._session.execute(statement, *args, **kwargs)

    async def get(self, model, ident, **kwargs):
        return self._session.get(model, ident, **kwargs)

    def add(self, instance) -> None:
        self._session.add(instance)

    def add_all(self, instances) -> None:
        self._session.add_all(instances)

    async def delete(self, instance) -> None:
        self._session.delete(instance)

    async def flush(self) -> None:
        self._session.flush()

    async def commit(self) -> None:
        self._session.commit()

    async def rollback(self) -> None:
        self._session.rollback()

    async def refresh(self, instance, *args, **kwargs) -> None:
        self._session.refresh(instance, *args, **kwargs)

    # Escape hatch for a test that wants to assert on stored rows directly.
    @property
    def sync(self) -> Session:
        return self._session


@pytest.fixture()
def db_session():
    """A fresh, empty database per test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        # One connection for the whole engine, or ":memory:" gives each
        # connection its own empty database and the tables vanish.
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    session = maker()
    try:
        yield AsyncSessionFacade(session)
    finally:
        session.close()
        engine.dispose()


def make(model, **overrides):
    """Build a valid row of `model`, filling required columns by introspection.

    These tables carry a lot of NOT NULL columns with no Python-side default
    (Stay alone has twenty-two), and spelling them out in every test is how a
    fixture drifts from the schema. Reading the columns means a new NOT NULL
    column makes existing tests keep working rather than fail on something
    unrelated to what they are testing.

    Only what the test cares about goes in `overrides`.
    """
    import datetime as _dt

    from sqlalchemy import (
        Boolean, Date, DateTime, Float, Integer, JSON, Numeric, String, Text,
    )

    values = {}
    for column in model.__table__.columns:
        if column.name in overrides or column.primary_key:
            continue
        if column.nullable or column.default is not None or column.server_default is not None:
            continue
        kind = column.type
        if isinstance(kind, JSON):
            # A JSON column may be an object or a list depending on the field;
            # an empty list is valid for both readers here.
            values[column.name] = []
        elif isinstance(kind, Boolean):
            values[column.name] = False
        elif isinstance(kind, (Integer, Float, Numeric)):
            values[column.name] = 0
        elif isinstance(kind, DateTime):
            values[column.name] = _dt.datetime.now(_dt.UTC)
        elif isinstance(kind, Date):
            values[column.name] = _dt.date.today()
        elif isinstance(kind, (String, Text)):
            values[column.name] = ""
        else:
            values[column.name] = ""
    values.update(overrides)
    return model(**values)
