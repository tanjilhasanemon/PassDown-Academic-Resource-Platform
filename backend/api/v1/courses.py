"""Courses — FastAPI HTTP Router (ECB Boundary Layer)."""
from fastapi import APIRouter, Depends, Query, Request, Response, Security, status
from sqlalchemy.orm import Session

from core.audit import record_audit
from core.database import get_db
from dependencies.auth import get_current_user
from models.app_user import AppUser
from schemas.common import PaginatedResponse
from schemas.course import CourseCreate, CourseRead, CourseUpdate
from services.course import CourseService

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.get("", response_model=PaginatedResponse[CourseRead])
def list_courses(
    q: str | None = Query(
        default=None,
        description="Search courses by code or title (case-insensitive)",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedResponse[CourseRead]:
    """Executes `list courses` operation."""
    return CourseService.list_courses(db, q=q, limit=limit, offset=offset)


@router.get("/{course_id}", response_model=CourseRead)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
) -> CourseRead:
    """Executes `get course` operation."""
    course = CourseService.get_course(db, course_id)
    return CourseRead.model_validate(course)


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    data: CourseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["courses:write"]),
) -> CourseRead:
    """Executes `create course` operation."""
    course = CourseService.create_course(db, data)
    record_audit(
        db,
        action="course_created",
        user_id=current_user.id,
        user_email=current_user.email,
        details=f"{course.code} — {course.title}",
        request=request,
    )
    return CourseRead.model_validate(course)


@router.put("/{course_id}", response_model=CourseRead)
def update_course(
    course_id: int,
    data: CourseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["courses:write"]),
) -> CourseRead:
    """Executes `update course` operation."""
    course = CourseService.update_course(db, course_id, data)
    record_audit(
        db,
        action="course_updated",
        user_id=current_user.id,
        user_email=current_user.email,
        details=f"{course.code} — {course.title}",
        request=request,
    )
    return CourseRead.model_validate(course)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["courses:write"]),
) -> Response:
    """Executes `delete course` operation."""
    course = CourseService.get_course(db, course_id)
    details = f"{course.code} — {course.title}"
    CourseService.delete_course(db, course_id)
    record_audit(
        db,
        action="course_deleted",
        user_id=current_user.id,
        user_email=current_user.email,
        details=details,
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
