import asyncio
from datetime import UTC, datetime, timedelta

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# OWASP's current floor for PBKDF2-HMAC-SHA256. passlib's built-in default is
# 29,000 — a figure from an older revision of the same guidance — and it applies
# silently, so the work factor has to be stated here to be a decision at all.
PBKDF2_ROUNDS = 600_000

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
    pbkdf2_sha256__default_rounds=PBKDF2_ROUNDS,
    # needs_update() reads min_rounds, not default_rounds: without this line a
    # 29,000-round hash is considered current and never gets re-hashed on login.
    pbkdf2_sha256__min_rounds=PBKDF2_ROUNDS,
)
ALGORITHM = "HS256"


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def needs_rehash(password_hash: str) -> bool:
    """Whether this hash is below the current work factor.

    `deprecated="auto"` only marks such hashes; nothing re-writes them. Raising
    PBKDF2_ROUNDS therefore protects new passwords only until a successful login
    re-hashes the old ones, which is the only moment the plaintext is available.
    """
    return pwd_context.needs_update(password_hash)


# 600,000 rounds is roughly 100ms of pure CPU. Called inline from an async
# handler that is the whole event loop stalling for every concurrent request,
# so the auth paths go through these.
async def verify_password_async(plain_password: str, password_hash: str) -> bool:
    return await asyncio.to_thread(verify_password, plain_password, password_hash)


async def hash_password_async(password: str) -> str:
    return await asyncio.to_thread(hash_password, password)


def create_access_token(subject: str, token_epoch: int = 0) -> str:
    """Mint an access token.

    `token_epoch` is the account's current epoch, copied in so the token can be
    invalidated without waiting for `exp`. A token carried only `sub` and `exp`
    before, which meant a password change did nothing to sessions already open:
    a stolen token stayed good for the full seven days, and the only way to stop
    it was to deactivate the account.
    """
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": subject, "exp": expires_at, "epc": token_epoch},
        settings.secret_key,
        algorithm=ALGORITHM,
    )
