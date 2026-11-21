"""Course — Business Logic Service (ECB Control Layer)."""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.course import Course
from repositories.course import CourseRepository
from schemas.common import PaginatedResponse
from schemas.course import CourseCreate, CourseRead, CourseUpdate


class CourseService:
    """Represents `CourseService` in the PassDown backend."""
    @staticmethod
    def list_courses(
        db: Session,
        q: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[CourseRead]:
        """Executes `list courses` operation."""
        items, total = CourseRepository.list_courses(db, q=q, limit=limit, offset=offset)
        return PaginatedResponse[CourseRead](
            items=[CourseRead.model_validate(item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def get_course(db: Session, course_id: int) -> Course:
        """Executes `get course` operation."""
        course = CourseRepository.get_by_id(db, course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found",
            )
        return course

    @staticmethod
    def create_course(db: Session, data: CourseCreate) -> Course:
        """Executes `create course` operation."""
        existing = CourseRepository.get_by_code(db, data.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Course with code '{data.code}' already exists",
            )
        return CourseRepository.create(db, data)

    @staticmethod
    def update_course(db: Session, course_id: int, data: CourseUpdate) -> Course:
        """Executes `update course` operation."""
        course = CourseService.get_course(db, course_id)
        if data.code != course.code:
            existing = CourseRepository.get_by_code(db, data.code)
            if existing and existing.id != course.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Course with code '{data.code}' already exists",
                )
        return CourseRepository.update(db, course, data)

    @staticmethod
    def delete_course(db: Session, course_id: int) -> None:
        """Executes `delete course` operation."""
        course = CourseService.get_course(db, course_id)
        CourseRepository.delete(db, course)
