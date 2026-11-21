"""User — Business Logic Service (ECB Control Layer)."""
from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from core.security import hash_password, verify_password
from models.app_user import AppUser
from models.contribution import Contribution
from models.request import MaterialRequest
from repositories.request import RequestRepository
from repositories.user import UserRepository
from schemas.common import PaginatedResponse
from schemas.contribution import ContributionRead
from schemas.request import MaterialRequestRead
from schemas.user import (
    UserActiveUpdate,
    UserPasswordUpdate,
    UserProfileUpdate,
    UserRead,
)
from services.contribution import ContributionService


class UserService:
    """Represents `UserService` in the PassDown backend."""
    @staticmethod
    def get_user_or_404(db: Session, user_id: int) -> AppUser:
        """Executes `get user or 404` operation."""
        user = UserRepository.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return user

    @staticmethod
    def update_profile(
        db: Session,
        current_user: AppUser,
        data: UserProfileUpdate,
    ) -> AppUser:
        """Executes `update profile` operation."""
        updated = UserRepository.update_name(db, user=current_user, name=data.name)
        # Keep author_name synchronized across the user's own contributions & requests
        db.execute(
            update(Contribution)
            .where(Contribution.author_id == updated.id)
            .values(author_name=updated.name)
        )
        db.execute(
            update(MaterialRequest)
            .where(MaterialRequest.author_id == updated.id)
            .values(author_name=updated.name)
        )
        db.commit()
        db.refresh(updated)
        return updated

    @staticmethod
    def change_password(
        db: Session,
        current_user: AppUser,
        data: UserPasswordUpdate,
    ) -> None:
        """Executes `change password` operation."""
        if not verify_password(data.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        new_hash = hash_password(data.new_password)
        UserRepository.update_password(db, user=current_user, password_hash=new_hash)

    @staticmethod
    def list_my_contributions(
        db: Session,
        current_user: AppUser,
        status_filter: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[ContributionRead]:
        """Executes `list my contributions` operation."""
        return ContributionService.list_all_contributions(
            db,
            status_filter=status_filter,
            author_id=current_user.id,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def list_my_requests(
        db: Session,
        current_user: AppUser,
        status_filter: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[MaterialRequestRead]:
        """Executes `list my requests` operation."""
        items, total = RequestRepository.list_by_author(
            db,
            author_id=current_user.id,
            status_filter=status_filter,
            limit=limit,
            offset=offset,
        )
        return PaginatedResponse[MaterialRequestRead](
            items=[MaterialRequestRead.model_validate(item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def list_users_for_admin(
        db: Session,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[UserRead]:
        """Executes `list users for admin` operation."""
        items, total = UserRepository.list_users(db, limit=limit, offset=offset)
        return PaginatedResponse[UserRead](
            items=[UserRead.model_validate(item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def set_user_active(
        db: Session,
        target_user_id: int,
        data: UserActiveUpdate,
        admin_user: AppUser,
    ) -> AppUser:
        # FR-39, AC-25: Admin cannot deactivate themselves (409 Conflict)
        """Executes `set user active` operation."""
        if target_user_id == admin_user.id and not data.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Admins cannot deactivate their own account",
            )
        target = UserService.get_user_or_404(db, target_user_id)
        return UserRepository.update_active_status(
            db, user=target, is_active=data.is_active
        )
