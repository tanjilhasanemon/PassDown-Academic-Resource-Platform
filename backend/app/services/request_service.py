"""Resource Request Service (ECB Control Layer).

Enforces FR-10 course existence and creates requests for the authenticated user.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.course_repo import CourseRepository
from app.repositories.request_repo import RequestRepository
from app.schemas.request_schema import RequestRead


class RequestService:
    """Orchestrates business rules for submitting course resource requests."""

    @staticmethod
    def submit_request(
        db: Session,
        *,
        course_id: int,
        submitted_by: int,
        description: str,
    ) -> RequestRead:
        """Creates an open request for an existing course.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course that the resource is requested for.
            submitted_by (int): Authenticated user's database identifier.
            description (str): Validated request description.

        Raises:
            HTTPException (404): If the requested course does not exist.

        Returns:
            RequestRead: Newly persisted request response.
        """
        if CourseRepository.get_by_id(db, course_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – the requested course does not exist.",
            )

        request = RequestRepository.create(
            db,
            course_id=course_id,
            submitted_by=submitted_by,
            description=description,
        )
        return RequestRead.model_validate(request)