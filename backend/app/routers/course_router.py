"""Course Catalogue and Search HTTP Router (ECB Boundary Layer).

Exposes FR-03 public read endpoints:
- GET /api/v1/courses (List courses and support ?search= by code or title)
- GET /api/v1/courses/{course_id} (Return course detail + public resource links, or 404)
"""

from fastapi import APIRouter, Depends, Query, Security, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SCOPE_REQUESTS_WRITE, get_current_user
from app.schemas.auth_schema import UserRead
from app.schemas.course_schema import CourseDetailRead, CourseRead
from app.schemas.request_schema import RequestCreate, RequestPublicRead, RequestRead
from app.services.course_service import CourseService
from app.services.request_service import RequestService

router = APIRouter(prefix="/courses", tags=["Courses (FR-03, FR-04)"])


@router.get(
    "",
    response_model=list[CourseRead],
    status_code=status.HTTP_200_OK,
    summary="Browse and search public courses by code or title (FR-03)",
)
def list_courses(
    search: str | None = Query(
        default=None,
        max_length=120,
        description="Optional case-insensitive search term matching course code or title.",
    ),
    db: Session = Depends(get_db),
) -> list[CourseRead]:
    """Returns the public course catalogue, optionally filtered by `?search=`."""
    return CourseService.list_public_courses(db, search=search)


@router.get(
    "/{course_id}",
    response_model=CourseDetailRead,
    status_code=status.HTTP_200_OK,
    summary="Get course detail and public resource section links (FR-03)",
)
def get_course_by_id(
    course_id: int,
    db: Session = Depends(get_db),
) -> CourseDetailRead:
    """Returns full metadata and resource navigation links for a course, or 404."""
    return CourseService.get_course_detail(db, course_id=course_id)


@router.get(
    "/{course_id}/requests",
    response_model=list[RequestPublicRead],
    status_code=status.HTTP_200_OK,
    summary="Browse public requests for a course (FR-11)",
    responses={404: {"description": "The course does not exist."}},
)
def list_course_requests(
    course_id: int,
    db: Session = Depends(get_db),
) -> list[RequestPublicRead]:
    """Lists course requests publicly without requiring authentication."""
    return RequestService.list_course_requests(db, course_id=course_id)


@router.post(
    "/{course_id}/requests",
    response_model=RequestRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an open resource request for a course (FR-10)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks requests:write permission."},
        404: {"description": "The course does not exist."},
        422: {"description": "The request description is missing or blank."},
    },
)
def submit_course_request(
    course_id: int,
    payload: RequestCreate,
    db: Session = Depends(get_db),
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_REQUESTS_WRITE]
    ),
) -> RequestRead:
    """Creates an open course request for the authenticated Student or Admin."""
    user = UserRead.model_validate(current_user)
    return RequestService.submit_request(
        db,
        course_id=course_id,
        submitted_by=user.id,
        description=payload.description,
    )
