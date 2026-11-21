"""Contribution — Business Logic Service (ECB Control Layer)."""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.app_user import AppUser
from models.contribution import Contribution
from repositories.contribution import ContributionRepository
from schemas.common import PaginatedResponse
from schemas.contribution import (
    ContributionCreate,
    ContributionRead,
    ContributionStatusUpdate,
    ContributionUpdate,
)
from services.course import CourseService


class ContributionService:
    """Represents `ContributionService` in the PassDown backend."""
    @staticmethod
    def list_approved_for_course(
        db: Session,
        course_id: int,
        material_type: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[ContributionRead]:
        """Executes `list approved for course` operation."""
        CourseService.get_course(db, course_id)
        items, total = ContributionRepository.list_approved_by_course(
            db,
            course_id=course_id,
            material_type=material_type,
            limit=limit,
            offset=offset,
        )
        return PaginatedResponse[ContributionRead](
            items=[ContributionRead.model_validate(item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def list_all_contributions(
        db: Session,
        status_filter: str | None = None,
        course_id: int | None = None,
        author_id: int | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[ContributionRead]:
        """Executes `list all contributions` operation."""
        items, total = ContributionRepository.list_all(
            db,
            status_filter=status_filter,
            course_id=course_id,
            author_id=author_id,
            limit=limit,
            offset=offset,
        )
        return PaginatedResponse[ContributionRead](
            items=[ContributionRead.model_validate(item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def get_contribution(db: Session, contribution_id: int) -> Contribution:
        """Executes `get contribution` operation."""
        contribution = ContributionRepository.get_by_id(db, contribution_id)
        if not contribution:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contribution not found",
            )
        return contribution

    @staticmethod
    def create_contribution(
        db: Session,
        course_id: int,
        data: ContributionCreate,
        current_user: AppUser,
    ) -> Contribution:
        """Executes `create contribution` operation."""
        CourseService.get_course(db, course_id)
        return ContributionRepository.create(
            db, course_id=course_id, data=data, author=current_user
        )

    @staticmethod
    def update_contribution(
        db: Session,
        contribution_id: int,
        data: ContributionUpdate,
        current_user: AppUser,
    ) -> Contribution:
        """Executes `update contribution` operation."""
        contribution = ContributionService.get_contribution(db, contribution_id)
        # SRS §7: Editing a pending contribution is restricted to its owner
        if contribution.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own contributions",
            )
        if contribution.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only pending contributions can be edited",
            )
        return ContributionRepository.update(db, contribution=contribution, data=data)

    @staticmethod
    def update_contribution_status(
        db: Session, contribution_id: int, data: ContributionStatusUpdate
    ) -> Contribution:
        """Executes `update contribution status` operation."""
        contribution = ContributionService.get_contribution(db, contribution_id)
        return ContributionRepository.update_status(
            db, contribution=contribution, new_status=data.status
        )

    @staticmethod
    def delete_contribution(
        db: Session,
        contribution_id: int,
        current_user: AppUser,
    ) -> None:
        """Executes `delete contribution` operation."""
        contribution = ContributionService.get_contribution(db, contribution_id)
        # FR-35, AC-21: Owner or Admin may delete a contribution
        if current_user.role != "admin" and contribution.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own contributions",
            )
        ContributionRepository.delete(db, contribution=contribution)
