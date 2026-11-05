"""SQLAlchemy 2.0 Database Engine and Session Management (Entity Layer).

Provides the declarative ORM base and FastAPI request-scoped session generator
in compliance with PassDown SRS §2.1 and §3.3.3.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
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
