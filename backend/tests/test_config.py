import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_cors_origins_accepts_comma_separated_string() -> None:
    settings = Settings(
        cors_origins="https://slowfield.onrender.com,https://www.slowfield.example",
    )

    assert settings.cors_origins == [
        "https://slowfield.onrender.com",
        "https://www.slowfield.example",
    ]


def test_bootstrap_email_must_be_accepted_by_login_validation() -> None:
    with pytest.raises(ValidationError):
        Settings(admin_bootstrap_email="qa-admin@example.test")
