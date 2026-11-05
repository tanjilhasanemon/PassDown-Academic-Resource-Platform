"""Course Catalogue Service (ECB Control Layer).

Enforces business rules for PassDown SRS FR-03:
1. Public listing and case-insensitive `?search=` filtering by course code or title.
2. Course detail retrieval by ID with 404 Not Found handling for unknown IDs.
3. Construction of public resource navigation links (`core-materials`,
   `contributions`, and `requests`).
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories.course_repo import CourseRepository
from app.schemas.course_schema import (
    CourseDetailRead,
    CourseRead,
    CourseResourceLinks,
)


class CourseService:
    """Control-layer service orchestrating public course browsing and search."""

    @staticmethod
    def list_public_courses(
        db: Session,
        search: str | None = None,
    ) -> list[CourseRead]:
        """Returns all courses or courses matching the `?search=` code/title query.

        Args:
            db (Session): Active SQLAlchemy database session.
            search (str | None): Optional search query matching code or title.

        Returns:
            list[CourseRead]: Ordered list of public course summary schemas.
        """
        courses = CourseRepository.list_courses(db, search=search)
        return [CourseRead.model_validate(course) for course in courses]

    @staticmethod
    def get_course_detail(db: Session, course_id: int) -> CourseDetailRead:
        """Retrieves a single course by ID along with its public resource section links.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Unique primary key of the requested course.

        Raises:
            HTTPException (404): If no course exists with the given `course_id`.

        Returns:
            CourseDetailRead: Course metadata plus navigation links to public sections.
        """
        course = CourseRepository.get_by_id(db, course_id)
        if course is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – the requested course does not exist.",
            )

        prefix = f"{settings.API_V1_PREFIX}/courses/{course.id}"
        links = CourseResourceLinks(
            core_materials=f"{prefix}/core-materials",
            approved_contributions=f"{prefix}/contributions",
            requests=f"{prefix}/requests",
        )
        return CourseDetailRead(
            id=course.id,
            code=course.code,
            title=course.title,
            department=course.department,
            semester_offered=course.semester_offered,
            created_at=course.created_at,
            resource_links=links,
        )
