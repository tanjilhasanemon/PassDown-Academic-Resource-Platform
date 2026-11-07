"""Resource Request Repository Module (ECB Entity Layer).

Provides database persistence operations for Request entities under FR-10.
"""

from sqlalchemy.orm import Session

from app.models.request import Request


class RequestRepository:
    """Encapsulates SQLAlchemy persistence operations for Request entities."""

    @staticmethod
    def create(
        db: Session,
        *,
        course_id: int,
        submitted_by: int,
        description: str,
    ) -> Request:
        """Persists and returns a new open Request.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Existing course requested by the submitter.
            submitted_by (int): Authenticated user's database identifier.
            description (str): Validated non-empty resource description.

        Returns:
            Request: Newly created and refreshed Request entity.
        """
        request = Request(
            course_id=course_id,
            submitted_by=submitted_by,
            description=description,
            status="open",
        )
        db.add(request)
        db.commit()
        db.refresh(request)
        return request