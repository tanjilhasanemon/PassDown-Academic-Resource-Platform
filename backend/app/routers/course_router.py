"""Course Catalogue and Search HTTP Router (ECB Boundary Layer).

Exposes FR-03 public read endpoints:
- GET /api/v1/courses (List courses and support ?search= by code or title)
- GET /api/v1/courses/{course_id} (Return course detail + public resource links, or 404)
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.course_schema import CourseDetailRead, CourseRead
from app.services.course_service import CourseService

router = APIRouter(prefix="/courses", tags=["Courses (FR-03, FR-04)"])
db_session_dependency = Depends(get_db)


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
    db: Session = db_session_dependency,
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
    db: Session = db_session_dependency,
) -> CourseDetailRead:
    """Returns full metadata and resource navigation links for a course, or 404."""
    return CourseService.get_course_detail(db, course_id=course_id)
