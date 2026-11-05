"""Authentication and User Profile Service (ECB Control Layer).

Enforces business rules for PassDown SRS FR-01 and FR-02:
1. Checks case-insensitive email uniqueness and raises 409 Conflict on duplicates.
2. Forces public registration accounts to role='student' (preventing admin escalation).
3. Hashes passwords with bcrypt prior to repository persistence (NFR-01).
4. Verifies login credentials and issues expiring signed JWTs with role scopes (FR-02).
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    ROLE_SCOPES,
    ROLE_STUDENT,
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.schemas.auth_schema import (
    TokenResponse,
    UserRead,
    UserRegisterRequest,
)


class AuthService:
    """Control-layer service orchestrating user registration, login, and JWT issuance."""

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

        password_hash = hash_password(payload.password)
        return UserRepository.create(
            db,
            name=payload.name,
            email=str(payload.email),
            password_hash=password_hash,
            role=ROLE_STUDENT,
        )

    @staticmethod
    def authenticate_user(
        db: Session,
        *,
        email: str,
        password: str,
    ) -> TokenResponse:
        """Verifies user credentials and returns a signed JWT session payload (FR-02).

        Args:
            db (Session): Active SQLAlchemy database session.
            email (str): Submitted candidate email address.
            password (str): Submitted candidate plaintext password.

        Raises:
            HTTPException (401): If email does not exist or password does not match.

        Returns:
            TokenResponse: Signed JWT token, expiry seconds, role, scopes, and safe profile.
        """
        user = UserRepository.get_by_email(db, email)
        if user is None or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Login failed – invalid email address or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = create_access_token(user_id=user.id, role=user.role)
        scopes = ROLE_SCOPES.get(user.role, [])
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.JWT_EXPIRE_MINUTES * 60,
            role=user.role,
            scopes=scopes,
            user=UserRead.model_validate(user),
        )
