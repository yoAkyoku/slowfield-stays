import re
from functools import lru_cache

from pydantic import EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PG_SCHEME_RE = re.compile(r"^postgres(?:ql)?(?:\+[^:]+)?://")


class Settings(BaseSettings):
    app_name: str = "Slowfield Stays API"
    app_env: str = "local"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://staycation:staycation@localhost:5432/slowfield"
    secret_key: str = "change-me-in-production"
    # The admin session length, and the only place it is decided.
    #
    # This value IS production's: `.dockerignore` excludes `.env*`, so the file
    # never reaches the image, and compose passes no override. A local .env can
    # still shadow it during development — which is exactly how it was once
    # misread as production's setting.
    #
    # It pairs with the admin cookie, which used to hardcode 12 hours against
    # this 7-day token. The cookie was the shorter of the two, so the session
    # really ended at 12 hours while the credential stayed valid for another six
    # and a half days — a token that escaped the cookie outlived the session it
    # belonged to. The cookie now takes its lifetime from this token's own `exp`
    # claim (frontend/app/admin/modules/authActions.ts), so the two cannot
    # disagree and changing this line changes the real session length.
    access_token_expire_minutes: int = 10080
    cors_origins: list[str] | str = ["http://localhost:3000"]
    cors_origin_regex: str | None = None  # computed in model_post_init
    frontend_url: str = "http://localhost:3000"
    # Keep startup and login validation aligned.  Without this, startup can
    # seed an address that the login payload will always reject.
    admin_bootstrap_email: EmailStr = "admin@example.com"
    admin_bootstrap_password: str = "ChangeMe123!"


    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("database_url", mode="before")
    @classmethod
    def ensure_asyncpg_scheme(cls, value: str) -> str:
        # Normalise any postgres/postgresql URL (with or without an explicit
        # +driver suffix such as +psycopg2) to use the asyncpg async driver.
        # Render and other hosts often emit plain "postgresql://" or even
        # "postgresql+psycopg2://" which SQLAlchemy would try to load psycopg2
        # for — that package is intentionally absent from this image.
        return _PG_SCHEME_RE.sub("postgresql+asyncpg://", str(value))

    def model_post_init(self, __context: object) -> None:
        # Fail fast if production uses insecure defaults.
        #
        # Comparing against the placeholder is not enough: docker-compose
        # interpolates `${SECRET_KEY}` to an EMPTY STRING when the variable is
        # missing from the server's .env — it prints one warning and carries on.
        # An empty key is not equal to the placeholder, so it used to sail
        # through this check, and the app would then sign JWTs with "" (anyone
        # can forge an admin token) and derive the SMTP encryption key from
        # sha256("") — both completely silently. The deploy tarball deliberately
        # excludes .env, so that file on the server is a single copy nothing
        # verifies. A length floor catches the empty and the too-short alike.
        if self.app_env == "production":
            if self.secret_key == "change-me-in-production" or len(self.secret_key) < 32:
                raise ValueError(
                    "SECRET_KEY must be set in production to a value of at least 32 characters "
                    f"(got {len(self.secret_key)}). An empty value usually means the server's "
                    ".env is missing or the variable was not exported."
                )
            if self.admin_bootstrap_email in ("admin@example.com", ""):
                raise ValueError("ADMIN_BOOTSTRAP_EMAIL must be changed in production")
            if self.admin_bootstrap_password in ("ChangeMe123!", "") or len(self.admin_bootstrap_password) < 12:
                raise ValueError("ADMIN_BOOTSTRAP_PASSWORD must be changed in production")
        # Build CORS regex: allow localhost only in non-production environments
        if self.cors_origin_regex is None:
            if self.app_env == "production":
                object.__setattr__(
                    self,
                    "cors_origin_regex",
                    r"https://([a-z0-9-]+\.)?slowfieldstays\.com",
                )
            else:
                object.__setattr__(
                    self,
                    "cors_origin_regex",
                    r"https?://([a-z0-9-]+\.)?(slowfieldstays\.com|localhost|127\.0\.0\.1)(:\d+)?",
                )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
