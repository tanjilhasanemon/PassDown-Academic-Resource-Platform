"""SQLAlchemy 2.0 Database Engine and Session Management (Entity Layer).

Provides the declarative ORM base and FastAPI request-scoped session generator
with automatic PostgreSQL (Supabase SSL) and SQLite connection handling.
"""

from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _normalize_database_url(raw_url: str) -> str:
    """Normalizes PostgreSQL connection strings for SQLAlchemy 2.0 + psycopg2.

    Args:
        raw_url (str): Raw DATABASE_URL from environment variables.

    Returns:
        str: Normalized SQLAlchemy database URL.
    """
    cleaned = raw_url.strip()
    if cleaned.startswith("postgres://"):
        cleaned = cleaned.replace("postgres://", "postgresql://", 1)
    if cleaned.startswith("postgresql://") and "sslmode=" not in cleaned:
        separator = "&" if "?" in cleaned else "?"
        cleaned = f"{cleaned}{separator}sslmode=require"
    return cleaned


database_url = _normalize_database_url(settings.DATABASE_URL)
is_sqlite = database_url.startswith("sqlite")

connect_args = {"check_same_thread": False} if is_sqlite else {}
engine_kwargs = {"connect_args": connect_args}
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
