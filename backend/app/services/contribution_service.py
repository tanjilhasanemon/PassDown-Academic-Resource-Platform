"""Contribution Submission Service (ECB Control Layer).

Enforces FR-07 submission and FR-08 moderation and visibility business rules.
"""

from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.contribution_repo import ContributionRepository
from app.repositories.course_repo import CourseRepository
from app.schemas.auth_schema import UserRead
from app.schemas.contribution_schema import (
    ContributionCreate,
    ContributionModerationRead,
    ContributionRead,
)
from app.schemas.course_schema import CourseRead

ModerationStatus = Literal["approved", "rejected"]


class ContributionService:
    """Orchestrates submission, visibility, and moderation business rules."""

    @staticmethod
    def submit_contribution(
        db: Session,
        *,
        course_id: int,
        submitted_by: int,
        payload: ContributionCreate,
    ) -> ContributionRead:
        """Creates a pending contribution for an existing course.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course associated with the submitted resource.
            submitted_by (int): Authenticated user's database identifier.
            payload (ContributionCreate): Validated contribution data, including
                an optional description.

        Raises:
            HTTPException (404): If the requested course does not exist.

        Returns:
            ContributionRead: Newly persisted pending contribution response.
        """
        if CourseRepository.get_by_id(db, course_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – the requested course does not exist.",
            )

        contribution = ContributionRepository.create(
            db,
            course_id=course_id,
            submitted_by=submitted_by,
            title=payload.title,
            type=payload.type,
            url=str(payload.url),
            description=payload.description,
        )
        return ContributionRead.model_validate(contribution)

    @staticmethod
    def list_pending_contributions(
        db: Session,
    ) -> list[ContributionModerationRead]:
        """Returns pending Contributions with course and submitter metadata.

        Args:
            db (Session): Active SQLAlchemy database session.

        Returns:
            list[ContributionModerationRead]: Pending records for authorized
                moderation, ordered from oldest to newest.
        """
        records = ContributionRepository.list_pending_with_metadata(db)
        return [
            ContributionModerationRead.model_validate(
                {
                    **ContributionRead.model_validate(contribution).model_dump(),
                    "course": CourseRead.model_validate(course),
                    "submitter": UserRead.model_validate(submitter),
                }
            )
            for contribution, course, submitter in records
        ]

    @staticmethod
    def moderate_contribution(
        db: Session,
        *,
        contribution_id: int,
        new_status: ModerationStatus,
    ) -> ContributionRead:
        """Transitions a pending Contribution to approved or rejected.

        Args:
            db (Session): Active SQLAlchemy database session.
            contribution_id (int): Contribution to moderate.
            new_status (ModerationStatus): Server-selected moderation outcome.

        Raises:
            HTTPException (404): If the contribution does not exist.
            HTTPException (409): If the contribution is no longer pending.

        Returns:
            ContributionRead: Contribution with its updated status.
        """
        contribution = ContributionRepository.get_by_id(db, contribution_id)
        if contribution is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contribution not found – the requested contribution does not exist.",
            )

        updated = ContributionRepository.update_status_if_pending(
            db,
            contribution_id=contribution_id,
            new_status=new_status,
        )
        if updated is not None:
            return ContributionRead.model_validate(updated)

        current = ContributionRepository.get_by_id(db, contribution_id)
        if current is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contribution not found – the requested contribution does not exist.",
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Contribution #{contribution_id} is already {current.status}; "
                "only pending Contributions can be moderated."
            ),
        )

    @staticmethod
    def list_public_contributions(
        db: Session, *, course_id: int
    ) -> list[ContributionRead]:
        """Returns approved Contributions for an existing course only.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course whose public Contributions are requested.

        Raises:
            HTTPException (404): If the course does not exist.

        Returns:
            list[ContributionRead]: Approved public Contributions for the course.
        """
        if CourseRepository.get_by_id(db, course_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – the requested course does not exist.",
            )
        contributions = ContributionRepository.list_approved_by_course(db, course_id)
        return [
            ContributionRead.model_validate(contribution)
            for contribution in contributions
        ]
