"""Requests — FastAPI HTTP Router (ECB Boundary Layer)."""
from fastapi import APIRouter, Depends, Query, Response, Security, status
from sqlalchemy.orm import Session

from core.database import get_db
from dependencies.auth import get_current_user
from models.app_user import AppUser
from schemas.common import PaginatedResponse, RequestStatus
from schemas.request import (
    MaterialRequestCreate,
    MaterialRequestRead,
    MaterialRequestUpdate,
)
from services.request import RequestService

router = APIRouter(tags=["Requests"])


@router.get(
    "/requests",
    response_model=PaginatedResponse[MaterialRequestRead],
)
def list_all_requests(
    status: RequestStatus | None = Query(
        default=None,
        description="Filter requests across all courses by status (open, fulfilled)",
    ),
    course_id: int | None = Query(
        default=None,
        description="Filter requests by course ID",
    ),
    new_course_only: bool = Query(
        default=False,
        description="If true, return only requests asking for a brand-new course",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedResponse[MaterialRequestRead]:
    """Executes `list all requests` operation."""
    return RequestService.list_all_requests(
        db,
        status_filter=status,
        course_id=course_id,
        only_new_course_requests=new_course_only,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/requests",
    response_model=MaterialRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_general_or_course_request(
    data: MaterialRequestCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["requests:write"]),
) -> MaterialRequestRead:
    """Executes `create general or course request` operation."""
    material_request = RequestService.create_request(
        db, course_id=data.course_id, data=data, current_user=current_user
    )
    return MaterialRequestRead.model_validate(material_request)


@router.get(
    "/courses/{course_id}/requests",
    response_model=PaginatedResponse[MaterialRequestRead],
)
def list_course_requests(
    course_id: int,
    status: RequestStatus | None = Query(
        default=None,
        description="Filter requests by status (open, fulfilled)",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedResponse[MaterialRequestRead]:
    """Executes `list course requests` operation."""
    return RequestService.list_course_requests(
        db,
        course_id=course_id,
        status_filter=status,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/courses/{course_id}/requests",
    response_model=MaterialRequestRead,
    status_code=status.HTTP_201_CREATED,
)
def create_request(
    course_id: int,
    data: MaterialRequestCreate,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["requests:write"]),
) -> MaterialRequestRead:
    """Executes `create request` operation."""
    material_request = RequestService.create_request(
        db, course_id=course_id, data=data, current_user=current_user
    )
    return MaterialRequestRead.model_validate(material_request)


@router.get(
    "/requests/{request_id}",
    response_model=MaterialRequestRead,
)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
) -> MaterialRequestRead:
    """Executes `get request` operation."""
    material_request = RequestService.get_request(db, request_id)
    return MaterialRequestRead.model_validate(material_request)


@router.put(
    "/requests/{request_id}",
    response_model=MaterialRequestRead,
)
def update_request(
    request_id: int,
    data: MaterialRequestUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["requests:write"]),
) -> MaterialRequestRead:
    """Executes `update request` operation."""
    material_request = RequestService.update_request(
        db, request_id=request_id, data=data, current_user=current_user
    )
    return MaterialRequestRead.model_validate(material_request)


@router.patch(
    "/requests/{request_id}/fulfill",
    response_model=MaterialRequestRead,
)
def fulfill_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["requests:write"]),
) -> MaterialRequestRead:
    """Executes `fulfill request` operation."""
    material_request = RequestService.fulfill_request(
        db, request_id=request_id, current_user=current_user
    )
    return MaterialRequestRead.model_validate(material_request)


@router.delete(
    "/requests/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["requests:write"]),
) -> Response:
    """Executes `delete request` operation."""
    RequestService.delete_request(
        db, request_id=request_id, current_user=current_user
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
