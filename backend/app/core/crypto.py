"""
Field-level encryption for sensitive database values (e.g. SMTP passwords).

Uses AES-256-GCM via the ``cryptography`` library, deriving a stable Fernet
key from the application's ``SECRET_KEY``.  If SECRET_KEY is the default
placeholder, encryption is skipped so local dev "just works".
"""

import base64
import hashlib
import logging

logger = logging.getLogger(__name__)

_fernet = None  # lazy-loaded


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        logger.warning("cryptography package not installed — SMTP passwords will NOT be encrypted at rest")
        return None

    from app.core.config import settings

    if settings.secret_key == "change-me-in-production":
        # Local dev: skip encryption so devs don't need to worry about it
        return None

    # Derive a 32-byte key from the secret and base64-encode for Fernet
    raw = hashlib.sha256(settings.secret_key.encode()).digest()
    key = base64.urlsafe_b64encode(raw)
    _fernet = Fernet(key)
    return _fernet


def encrypt_value(plaintext: str) -> str:
    """Return the encrypted value.

    Outside production, an unavailable cipher falls back to plaintext so local
    development works without a real SECRET_KEY. In production it raises
    instead: silently writing an SMTP password in cleartext because a package
    is missing is a security control failing open, and the only trace it left
    was one log line at import that nobody reads. `cryptography` is a declared
    dependency, so reaching this in production means the environment is broken
    and the admin should be told, not quietly obliged.
    """
    if not plaintext:
        return plaintext
    f = _get_fernet()
    if f is None:
        from app.core.config import settings

        if settings.app_env == "production":
            raise RuntimeError(
                "Refusing to store a secret in cleartext: encryption is unavailable "
                "(cryptography missing, or SECRET_KEY is the default)."
            )
        return plaintext
    return "enc:" + f.encrypt(plaintext.encode()).decode()


def decrypt_value(stored: str) -> str:
    """Return decrypted string. Handles both encrypted ('enc:...') and legacy plaintext."""
    if not stored or not stored.startswith("enc:"):
        return stored  # legacy plaintext — return as-is
    f = _get_fernet()
    if f is None:
        # cryptography not available but value was encrypted — can't decrypt
        logger.error("Cannot decrypt value: cryptography not installed or secret_key is default")
        return ""
    try:
        return f.decrypt(stored[4:].encode()).decode()
    except Exception:
        logger.error("Failed to decrypt value — key may have changed")
        return ""
