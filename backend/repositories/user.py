"""User — Data-Access Repository (ECB Entity Layer)."""
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.app_user import AppUser


class UserRepository:
    """Represents `UserRepository` in the PassDown backend."""
    @staticmethod
    def get_by_id(db: Session, user_id: int) -> AppUser | None:
        """Executes `get by id` operation."""
        return db.get(AppUser, user_id)

    @staticmethod
    def get_by_email(db: Session, email: str) -> AppUser | None:
        """Executes `get by email` operation."""
        stmt = select(AppUser).where(AppUser.email == email.strip().lower())
        return db.scalar(stmt)

    @staticmethod
    def list_users(
        db: Session,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[AppUser], int]:
        """Executes `list users` operation."""
        count_stmt = select(func.count()).select_from(AppUser)
        stmt = (
            select(AppUser)
            .order_by(AppUser.created_at.desc(), AppUser.id.desc())
            .limit(limit)
            .offset(offset)
        )
        total = db.scalar(count_stmt) or 0
        items = list(db.scalars(stmt).all())
        return items, total

    @staticmethod
    def create_student(
        db: Session,
        name: str,
        email: str,
        password_hash: str,
    ) -> AppUser:
        """Executes `create student` operation."""
        user = AppUser(
            name=name.strip(),
            email=email.strip().lower(),
            password_hash=password_hash,
            role="student",
            is_active=True,
            failed_attempts=0,
            locked_until=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def record_failed_login(
        db: Session,
        user: AppUser,
        failed_attempts: int,
        locked_until: datetime | None,
    ) -> AppUser:
        """Executes `record failed login` operation."""
        user.failed_attempts = failed_attempts
        user.locked_until = locked_until
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def reset_login_attempts(db: Session, user: AppUser) -> AppUser:
        """Executes `reset login attempts` operation."""
        if user.failed_attempts != 0 or user.locked_until is not None:
            user.failed_attempts = 0
            user.locked_until = None
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def update_name(db: Session, user: AppUser, name: str) -> AppUser:
        """Executes `update name` operation."""
        user.name = name.strip()
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_password(db: Session, user: AppUser, password_hash: str) -> AppUser:
        """Executes `update password` operation."""
        user.password_hash = password_hash
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_active_status(db: Session, user: AppUser, is_active: bool) -> AppUser:
        """Executes `update active status` operation."""
        user.is_active = is_active
        db.commit()
        db.refresh(user)
        return user
