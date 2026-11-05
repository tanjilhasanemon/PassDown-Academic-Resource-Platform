"""User Relational Entity Model (ECB Entity Layer).

Implements the User entity specified in PassDown SRS §3.3.3, FR-01, and NFR-10.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.security import ROLE_STUDENT


class User(Base):
    """Represents a registered Student or Admin account in PassDown.

    Attributes:
        id (int): Primary key identifier.
        name (str): Full display name of the user.
        email (str): Unique, case-insensitive university email address.
        password_hash (str): Bcrypt-hashed password string (never plaintext).
        role (str): Application role ('student' or 'admin').
        created_at (datetime): UTC timestamp when the account was created.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ROLE_STUDENT
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
