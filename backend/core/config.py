"""Config — Core Configuration & Security (ECB Control Layer)."""
import os
import re
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


def _default_sqlite_url() -> str:
    """Executes `default sqlite url` operation."""
    if os.environ.get("VERCEL") or not os.access(BACKEND_DIR, os.W_OK):
        return "sqlite:////tmp/passdown.db"
    return f"sqlite:///{BACKEND_DIR / 'passdown.db'}"


class Settings(BaseSettings):
    """Represents `Settings` in the PassDown backend."""
    app_name: str = "PassDown API"
    app_version: str = "0.2.0"
    api_v1_prefix: str = "/api/v1"
    database_url: str = _default_sqlite_url()
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Beta JWT & Auth Settings (NFR-13, FR-31, FR-41)
    jwt_secret: str = "passdown-default-jwt-secret-key-minimum-32-characters-2026"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 15
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15
    password_pepper: str = "passdown-dev-pepper-change-in-production"
    refresh_expire_days: int = 7

    # Seed Admin Settings (FR-41)
    admin_name: str = "PassDown Admin"
    admin_email: str = "admin@passdown.edu"
    admin_password: str = "Admin1234"

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), str(ROOT_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def normalized_database_url(self) -> str:
        """Executes `normalized database url` operation."""
        raw = self.database_url.strip()

        for line in raw.splitlines():
            cleaned = line.strip()
            if not cleaned or cleaned.startswith("#"):
                continue
            cleaned = re.sub(r"^[A-Z0-9_]+\s*=\s*", "", cleaned)
            cleaned = cleaned.strip("\"' ")
            if "postgres" in cleaned or "sqlite" in cleaned:
                raw = cleaned
                break

        raw = raw.strip("\"' ")
        if not raw or "[YOUR-PASSWORD]" in raw:
            return _default_sqlite_url()

        if raw.startswith("postgres://"):
            raw = raw.replace("postgres://", "postgresql+psycopg://", 1)
        elif raw.startswith("postgresql://") and "+psycopg" not in raw:
            raw = raw.replace("postgresql://", "postgresql+psycopg://", 1)

        if raw.startswith("postgresql"):
            parts = urlsplit(raw)
            filtered_query = [
                (k, v)
                for k, v in parse_qsl(parts.query)
                if k.lower() not in {"pgbouncer", "connection_limit"}
            ]
            raw = urlunsplit(
                (
                    parts.scheme,
                    parts.netloc,
                    parts.path,
                    urlencode(filtered_query),
                    parts.fragment,
                )
            )

        return raw

    @property
    def is_sqlite(self) -> bool:
        """Executes `is sqlite` operation."""
        return self.normalized_database_url.startswith("sqlite")

    @property
    def cors_origins_list(self) -> list[str]:
        """Executes `cors origins list` operation."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
