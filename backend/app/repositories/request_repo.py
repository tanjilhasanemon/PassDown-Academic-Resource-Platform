"""Resource Request Repository Module (ECB Entity Layer).

Provides database persistence operations for Request entities under FR-10.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.request import Request
from app.models.user import User


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

    @staticmethod
    def list_by_course(db: Session, course_id: int) -> list[tuple[Request, str]]:
        """Lists course requests with the request author's display name.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course whose requests should be listed.

        Returns:
            list[tuple[Request, str]]: Request entities paired with author names.
        """
        stmt = (
            select(Request, User.name)
            .join(User, User.id == Request.submitted_by)
            .where(Request.course_id == course_id)
            .order_by(Request.created_at.desc(), Request.id.desc())
        )
        return list(db.execute(stmt).all())

    @staticmethod
    def get_by_id(db: Session, request_id: int) -> Request | None:
        """Retrieves a request by its primary key.

        Args:
            db (Session): Active SQLAlchemy database session.
            request_id (int): Request primary key.

        Returns:
            Request | None: Matching request, or None when it does not exist.
        """
        return db.get(Request, request_id)

    @staticmethod
    def set_status(db: Session, request: Request, new_status: str) -> Request:
        """Updates and returns the request's persisted status.

        Args:
            db (Session): Active SQLAlchemy database session.
            request (Request): Request entity to update.
            new_status (str): New server-controlled status value.

        Returns:
            Request: Updated and refreshed request entity.
        """
        request.status = new_status
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def delete(db: Session, request: Request) -> None:
        """Deletes a request without changing its course or related resources.

        Args:
            db (Session): Active SQLAlchemy database session.
            request (Request): Request entity to delete.
        """
        db.delete(request)
        db.commit()
