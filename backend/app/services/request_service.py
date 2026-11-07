"""Resource Request Service (ECB Control Layer).

Enforces FR-10 course existence and creates requests for the authenticated user.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN
from app.repositories.course_repo import CourseRepository
from app.repositories.request_repo import RequestRepository
from app.models.request import Request
from app.schemas.request_schema import RequestPublicRead, RequestRead


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

    @staticmethod
    def list_course_requests(
        db: Session, *, course_id: int
    ) -> list[RequestPublicRead]:
        """Returns public requests for an existing course.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course whose requests should be listed.

        Raises:
            HTTPException (404): If the requested course does not exist.

        Returns:
            list[RequestPublicRead]: Public request records with display names.
        """
        if CourseRepository.get_by_id(db, course_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – the requested course does not exist.",
            )

        requests = RequestRepository.list_by_course(db, course_id)
        return [
            RequestPublicRead(
                id=request.id,
                submitted_by=request.submitted_by,
                description=request.description,
                status=request.status,
                author_name=author_name,
                created_at=request.created_at,
            )
            for request, author_name in requests
        ]

    @staticmethod
    def fulfill_request(
        db: Session,
        *,
        request_id: int,
        acting_user_id: int,
        acting_user_role: str,
    ) -> RequestRead:
        """Marks an open request fulfilled for its owner or an Admin.

        Args:
            db (Session): Active SQLAlchemy database session.
            request_id (int): Request to fulfill.
            acting_user_id (int): Authenticated user's ID.
            acting_user_role (str): Authenticated user's role.

        Raises:
            HTTPException (403): If a Student does not own the request.
            HTTPException (404): If the request does not exist.
            HTTPException (409): If the request is not open.

        Returns:
            RequestRead: Updated request with status 'fulfilled'.
        """
        request = RequestService._get_accessible_request(
            db,
            request_id=request_id,
            acting_user_id=acting_user_id,
            acting_user_role=acting_user_role,
        )
        if request.status != "open":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Request is already fulfilled and cannot be fulfilled again.",
            )

        updated = RequestRepository.set_status(db, request, "fulfilled")
        return RequestRead.model_validate(updated)

    @staticmethod
    def delete_request(
        db: Session,
        *,
        request_id: int,
        acting_user_id: int,
        acting_user_role: str,
    ) -> None:
        """Deletes a request for its owner or an Admin.

        Args:
            db (Session): Active SQLAlchemy database session.
            request_id (int): Request to delete.
            acting_user_id (int): Authenticated user's ID.
            acting_user_role (str): Authenticated user's role.

        Raises:
            HTTPException (403): If a Student does not own the request.
            HTTPException (404): If the request does not exist.
        """
        request = RequestService._get_accessible_request(
            db,
            request_id=request_id,
            acting_user_id=acting_user_id,
            acting_user_role=acting_user_role,
        )
        RequestRepository.delete(db, request)

    @staticmethod
    def _get_accessible_request(
        db: Session,
        *,
        request_id: int,
        acting_user_id: int,
        acting_user_role: str,
    ) -> Request:
        """Loads a request and enforces the owner-or-Admin rule.

        Args:
            db (Session): Active SQLAlchemy database session.
            request_id (int): Request to load.
            acting_user_id (int): Authenticated user's ID.
            acting_user_role (str): Authenticated user's role.

        Raises:
            HTTPException (403): If the user is neither owner nor Admin.
            HTTPException (404): If the request does not exist.

        Returns:
            Request: Request available to the authenticated user.
        """
        request = RequestRepository.get_by_id(db, request_id)
        if request is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found.",
            )
        if acting_user_role != ROLE_ADMIN and request.submitted_by != acting_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the request owner or an Admin may manage this request.",
            )
        return request
