"""User Repository Module (ECB Entity Layer).

Provides parameterized database queries and persistence operations for the
User entity in compliance with PassDown SRS FR-01, FR-02, and NFR-10.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    """Encapsulates SQLAlchemy persistence operations for User entities."""

    @staticmethod
    def get_by_id(db: Session, user_id: int) -> User | None:
        """Retrieves a User record by its primary key ID.

        Args:
            db (Session): Active SQLAlchemy database session.
            user_id (int): Unique primary key of the user.

        Returns:
            User | None: Matching User entity if found, otherwise None.
        """
        stmt = select(User).where(User.id == user_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        """Retrieves a User record by email (case-insensitive per SRS §3.4).

        Args:
            db (Session): Active SQLAlchemy database session.
            email (str): Email address to look up.

        Returns:
            User | None: Matching User entity if found, otherwise None.
        """
        normalized = email.strip().lower()
        stmt = select(User).where(func.lower(User.email) == normalized)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def create(
        db: Session,
        *,
        name: str,
        email: str,
        password_hash: str,
        role: str,
    ) -> User:
        """Persists a new User entity in the database.

        Args:
            db (Session): Active SQLAlchemy database session.
            name (str): Trimmed full name of the user.
            email (str): Normalized unique email address.
            password_hash (str): Secure bcrypt password hash.
            role (str): Assigned role ('student' or 'admin').

        Returns:
            User: Newly created and refreshed User ORM instance.
        """
        user = User(
            name=name.strip(),
            email=email.strip().lower(),
            password_hash=password_hash,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
