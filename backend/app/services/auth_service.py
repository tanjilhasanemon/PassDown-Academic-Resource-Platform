"""Authentication and User Profile Service (ECB Control Layer).

Enforces business rules for PassDown SRS FR-01:
1. Checks case-insensitive email uniqueness and raises 409 Conflict on duplicates.
2. Forces public registration accounts to role='student' (preventing admin escalation).
3. Hashes passwords with bcrypt prior to repository persistence (NFR-01).
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import ROLE_STUDENT, hash_password
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.auth_schema import UserRegisterRequest


class AuthService:
    """Control-layer service orchestrating user registration and profile lookup."""

    @staticmethod
    def register_student(db: Session, payload: UserRegisterRequest) -> User:
        """Registers a new Student account and blocks duplicate email or role escalation.

        Args:
            db (Session): Active SQLAlchemy database session.
            payload (UserRegisterRequest): Validated registration request schema.

        Raises:
            HTTPException (409): If an account with the given email already exists.

        Returns:
            User: Newly persisted User entity with role='student' and bcrypt hash.
        """
        existing = UserRepository.get_by_email(db, payload.email)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Registration failed – an account with this email address already exists.",
            )

        # SRS FR-01: Ignore any client attempt to set role='admin' in public registration
        password_hash = hash_password(payload.password)
        return UserRepository.create(
            db,
            name=payload.name,
            email=str(payload.email),
            password_hash=password_hash,
            role=ROLE_STUDENT,
        )
