"""Auth — Business Logic Service (ECB Control Layer)."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from core.config import settings
from core.security import create_access_token, hash_password, verify_password
from models.app_user import AppUser
from repositories.user import UserRepository
from schemas.auth import RegisterRequest, TokenResponse

GENERIC_LOGIN_ERROR = "Incorrect email or password"


def _as_utc(dt: datetime | None) -> datetime | None:
    """Executes `as utc` operation."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AuthService:
    """Represents `AuthService` in the PassDown backend."""
    @staticmethod
    def register(db: Session, data: RegisterRequest) -> AppUser:
        """Executes `register` operation."""
        existing = UserRepository.get_by_email(db, data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        password_hash = hash_password(data.password)
        return UserRepository.create_student(
            db,
            name=data.name,
            email=data.email,
            password_hash=password_hash,
        )

    @staticmethod
    def login(db: Session, email: str, password: str) -> TokenResponse:
        """Executes `login` operation."""
        user = UserRepository.get_by_email(db, email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=GENERIC_LOGIN_ERROR,
                headers={"WWW-Authenticate": "Bearer"},
            )

        now = datetime.now(timezone.utc)
        locked_until = _as_utc(user.locked_until)

        # 1. Check temporary account lockout first (FR-31, AC-17)
        if locked_until and locked_until > now:
            remaining_min = max(1, int((locked_until - now).total_seconds() // 60) + 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account is temporarily locked due to repeated failed login attempts. Try again in {remaining_min} minute(s).",
            )

        # 2. Verify Argon2id password hash (NFR-12, NFR-15)
        if not verify_password(password, user.password_hash):
            base_attempts = (
                0 if (locked_until and locked_until <= now) else user.failed_attempts
            )
            new_attempts = base_attempts + 1
            new_locked_until = None
            if new_attempts >= settings.login_max_attempts:
                new_locked_until = now + timedelta(minutes=settings.login_lockout_minutes)
            UserRepository.record_failed_login(
                db,
                user=user,
                failed_attempts=new_attempts,
                locked_until=new_locked_until,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=GENERIC_LOGIN_ERROR,
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 3. Check if the account has been deactivated by an admin (FR-40, AC-25)
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )

        # 4. Reset failed login counter and issue signed HS256 JWT (FR-29)
        UserRepository.reset_login_attempts(db, user)
        token = create_access_token(user_id=user.id, role=user.role)
        return TokenResponse(access_token=token, token_type="bearer")
