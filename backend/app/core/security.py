"""Cryptographic Password Hashing, JWT Session & RBAC Security Scopes (Control Layer).

Enforces PassDown SRS §3.4, FR-01, FR-02, NFR-01, NFR-02, and NFR-03:
- Hashes passwords with bcrypt and never stores or logs plaintext passwords.
- Signs and verifies expiring JWTs containing subject identity, role, and scopes.
- Enforces FastAPI SecurityScopes for role-based and scope-based access control.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.repositories.user_repo import UserRepository

ROLE_ADMIN = "admin"
ROLE_STUDENT = "student"
ROLE_GUEST = "guest"

SCOPE_COURSES_WRITE = "courses:write"
SCOPE_MATERIALS_WRITE = "materials:write"
SCOPE_CONTRIBUTIONS_MODERATE = "contributions:moderate"
SCOPE_CONTRIBUTIONS_WRITE = "contributions:write"
SCOPE_REQUESTS_WRITE = "requests:write"

ROLE_SCOPES: dict[str, list[str]] = {
    ROLE_ADMIN: [
        SCOPE_COURSES_WRITE,
        SCOPE_MATERIALS_WRITE,
        SCOPE_CONTRIBUTIONS_MODERATE,
        SCOPE_CONTRIBUTIONS_WRITE,
        SCOPE_REQUESTS_WRITE,
    ],
    ROLE_STUDENT: [
        SCOPE_CONTRIBUTIONS_WRITE,
        SCOPE_REQUESTS_WRITE,
    ],
    ROLE_GUEST: [],
}

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login",
    scopes={
        SCOPE_COURSES_WRITE: "Create, update, and delete courses (Admin only).",
        SCOPE_MATERIALS_WRITE: "Manage curated Core Materials (Admin only).",
        SCOPE_CONTRIBUTIONS_MODERATE: "Approve or reject pending Contributions (Admin only).",
        SCOPE_CONTRIBUTIONS_WRITE: "Submit and manage own pending Contributions.",
        SCOPE_REQUESTS_WRITE: "Submit and fulfill missing material Requests.",
    },
    auto_error=False,
)
db_session_dependency = Depends(get_db)


def hash_password(plain_password: str) -> str:
    """Hashes a plaintext password using bcrypt (SRS NFR-01).

    Args:
        plain_password (str): Raw user password string.

    Returns:
        str: UTF-8 encoded bcrypt password hash string.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifies a plaintext password against a stored bcrypt hash.

    Args:
        plain_password (str): Raw candidate password string.
        password_hash (str): Stored bcrypt hash from the database.

    Returns:
        bool: True if the password matches the hash, False otherwise.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(
    *,
    user_id: int,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Creates a signed JWT access token containing subject, role, scopes, and exp.

    Args:
        user_id (int): Database primary key of the authenticated user.
        role (str): User role ('student' or 'admin').
        expires_delta (timedelta | None): Custom expiration window.

    Returns:
        str: Encoded HS256 JWT string.
    """
    expire = datetime.now(UTC) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    scopes = ROLE_SCOPES.get(role, [])
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "scopes": scopes,
        "exp": expire,
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def get_current_user(
    security_scopes: SecurityScopes,
    token: str | None = Depends(oauth2_scheme),
    db: Session = db_session_dependency,
) -> User:
    """Validates the Bearer JWT and enforces required FastAPI SecurityScopes.

    Returns 401 Unauthorized when the token is missing, malformed, or expired,
    and returns 403 Forbidden when the token lacks a required scope (SRS FR-02).

    Args:
        security_scopes (SecurityScopes): Scopes required by the endpoint.
        token (str | None): Bearer token extracted from Authorization header.
        db (Session): Active SQLAlchemy database session.

    Raises:
        HTTPException (401): If token is missing, invalid, expired, or user is absent.
        HTTPException (403): If user token lacks one or more required scopes.

    Returns:
        User: Authenticated SQLAlchemy User entity.
    """
    authenticate_value = (
        f'Bearer scope="{security_scopes.scope_str}"'
        if security_scopes.scopes
        else "Bearer"
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or unauthorized – please log in to view your profile.",
            headers={"WWW-Authenticate": authenticate_value},
        )
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token payload.",
                headers={"WWW-Authenticate": authenticate_value},
            )
        user_id = int(sub)
        token_scopes: list[str] = payload.get("scopes", [])
    except (jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired – your login session has timed out. Please sign in again.",
            headers={"WWW-Authenticate": authenticate_value},
        ) from exc

    user = UserRepository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Profile unavailable – user account could not be found.",
            headers={"WWW-Authenticate": authenticate_value},
        )

    for required_scope in security_scopes.scopes:
        if required_scope not in token_scopes:
            raise HTTPException(
                status_code=status.HTTP_403_BIDDEN
                if hasattr(status, "HTTP_403_BIDDEN")
                else status.HTTP_403_FORBIDDEN,
                detail="Access denied – you do not have the required permissions to perform this action.",
                headers={"WWW-Authenticate": authenticate_value},
            )

    return user
