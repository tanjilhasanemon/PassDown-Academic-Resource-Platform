"""Request — Business Logic Service (ECB Control Layer)."""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.app_user import AppUser
from models.request import MaterialRequest
from repositories.request import RequestRepository
from schemas.common import PaginatedResponse
from schemas.request import (
    MaterialRequestCreate,
    MaterialRequestRead,
    MaterialRequestUpdate,
)
from services.course import CourseService


class RequestService:
    """Represents `RequestService` in the PassDown backend."""
    @staticmethod
    def list_course_requests(
        db: Session,
        course_id: int,
        status_filter: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[MaterialRequestRead]:
        """Executes `list course requests` operation."""
        CourseService.get_course(db, course_id)
        items, total = RequestRepository.list_by_course(
            db,
            course_id=course_id,
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
    def list_all_requests(
        db: Session,
        status_filter: str | None = None,
        course_id: int | None = None,
        only_new_course_requests: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[MaterialRequestRead]:
        """Executes `list all requests` operation."""
        items, total = RequestRepository.list_all(
            db,
            status_filter=status_filter,
            course_id=course_id,
            only_new_course_requests=only_new_course_requests,
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
    def get_request(db: Session, request_id: int) -> MaterialRequest:
        """Executes `get request` operation."""
        material_request = RequestRepository.get_by_id(db, request_id)
        if not material_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found",
            )
        return material_request

    @staticmethod
    def create_request(
        db: Session,
        course_id: int | None,
        data: MaterialRequestCreate,
        current_user: AppUser,
    ) -> MaterialRequest:
        """Executes `create request` operation."""
        target_course_id = course_id if course_id is not None else data.course_id
        if target_course_id is not None and target_course_id > 0:
            CourseService.get_course(db, target_course_id)
        else:
            target_course_id = None
        return RequestRepository.create(
            db, course_id=target_course_id, data=data, author=current_user
        )

    @staticmethod
    def update_request(
        db: Session,
        request_id: int,
        data: MaterialRequestUpdate,
        current_user: AppUser,
    ) -> MaterialRequest:
        """Executes `update request` operation."""
        material_request = RequestService.get_request(db, request_id)
        if current_user.role != "admin" and material_request.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own requests",
            )
        return RequestRepository.update(
            db, material_request=material_request, data=data
        )

    @staticmethod
    def fulfill_request(
        db: Session,
        request_id: int,
        current_user: AppUser,
    ) -> MaterialRequest:
        """Executes `fulfill request` operation."""
        material_request = RequestService.get_request(db, request_id)
        if current_user.role != "admin" and material_request.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the request owner or an admin can mark this request as fulfilled",
            )
        return RequestRepository.mark_fulfilled(db, material_request=material_request)

    @staticmethod
    def delete_request(
        db: Session,
        request_id: int,
        current_user: AppUser,
    ) -> None:
        """Executes `delete request` operation."""
        material_request = RequestService.get_request(db, request_id)
        if current_user.role != "admin" and material_request.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own requests",
            )
        RequestRepository.delete(db, material_request=material_request)
