"""Contribution Submission Service (ECB Control Layer).

Enforces FR-07 course existence and creates pending contributions for the
authenticated user.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.contribution_repo import ContributionRepository
from app.repositories.course_repo import CourseRepository
from app.schemas.contribution_schema import ContributionCreate, ContributionRead


class ContributionService:
    """Orchestrates business rules for submitting course contributions."""

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
            payload (ContributionCreate): Validated contribution data.

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
