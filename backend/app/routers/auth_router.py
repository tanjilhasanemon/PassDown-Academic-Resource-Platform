"""Authentication and Profile HTTP Router (ECB Boundary Layer).

Exposes FR-01 endpoints:
- POST /api/v1/auth/register (Public registration -> 201 Created)
- GET /api/v1/auth/me (Authenticated profile retrieval -> 200 OK)
"""

from fastapi import APIRouter, Depends, Security, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.auth_schema import UserRead, UserRegisterRequest
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication & Profile (FR-01, FR-02)"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Student account (FR-01)",
)
def register_user(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> UserRead:
    """Registers a prospective student and returns the safe profile without password_hash.

    Args:
        payload (UserRegisterRequest): Validated registration body (name, email, password).
        db (Session): Request-scoped SQLAlchemy session.

    Returns:
        UserRead: Safe public representation of the newly created Student account.
    """
    user = AuthService.register_student(db, payload)
    return UserRead.model_validate(user)


@router.get(
    "/me",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile (FR-01)",
)
def read_current_user_profile(
    current_user: object = Security(get_current_user, scopes=[]),
) -> UserRead:
    """Returns the currently authenticated Student or Admin profile without password_hash.

    Args:
        current_user (User): Authenticated user resolved by JWT dependency.

    Returns:
        UserRead: Safe user profile response schema.
    """
    return UserRead.model_validate(current_user)
