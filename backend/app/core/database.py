"""SQLAlchemy 2.0 Database Engine and Session Management (Entity Layer).

Provides the declarative ORM base and FastAPI request-scoped session generator
with automatic pure-Python PostgreSQL (Supabase via pg8000 + TLS) and SQLite
connection handling.
"""

from collections.abc import Generator
import os
import ssl
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _normalize_database_url(raw_url: str) -> tuple[str, dict[str, object]]:
    """Normalizes database URLs for SQLAlchemy 2.0 across SQLite and Supabase PostgreSQL.

    Uses the pure-Python `pg8000` PostgreSQL driver with encrypted TLS matching
    PostgreSQL `sslmode=require` semantics for Supabase managed connection poolers.

    Args:
        raw_url (str): Raw DATABASE_URL from environment variables.

    Returns:
        tuple[str, dict[str, object]]: Normalized SQLAlchemy URL and connect_args.
    """
    cleaned = raw_url.strip()
    if os.getenv("VERCEL") and cleaned == "sqlite:///./passdown_dev.db":
        cleaned = "sqlite:////tmp/passdown_dev.db"

    if cleaned.startswith("sqlite"):
        return cleaned, {"check_same_thread": False}

    if cleaned.startswith("postgres://"):
        cleaned = cleaned.replace("postgres://", "postgresql+pg8000://", 1)
    elif cleaned.startswith("postgresql+psycopg2://"):
        cleaned = cleaned.replace(
            "postgresql+psycopg2://", "postgresql+pg8000://", 1
        )
    elif cleaned.startswith("postgresql://"):
        cleaned = cleaned.replace("postgresql://", "postgresql+pg8000://", 1)

    parts = urlsplit(cleaned)
    filtered_query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in {"sslmode", "pgbouncer"}
    ]
    normalized_url = urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(filtered_query),
            parts.fragment,
        )
    )

    # Match PostgreSQL sslmode=require TLS encryption for Supabase managed poolers
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE  # nosec B501
    return normalized_url, {"ssl_context": ssl_context}


database_url, connect_args = _normalize_database_url(settings.DATABASE_URL)
is_sqlite = database_url.startswith("sqlite")

engine_kwargs: dict[str, object] = {"connect_args": connect_args}
if not is_sqlite:
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(database_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all PassDown SQLAlchemy 2.0 relational ORM models."""


def get_db() -> Generator[Session, None, None]:
    """Yields a database session per HTTP request and closes it cleanly on exit.

    Yields:
        Session: Active SQLAlchemy database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
