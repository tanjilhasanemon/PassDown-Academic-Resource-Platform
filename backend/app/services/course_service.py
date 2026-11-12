"""Course Catalogue Service (ECB Control Layer).

Enforces business rules for PassDown SRS FR-03 and FR-04:
1. Public listing and case-insensitive `?search=` filtering by course code or title.
2. Course detail retrieval by ID with 404 Not Found handling for unknown IDs.
3. Construction of public resource navigation links (`core-materials`,
   `contributions`, and `requests`).
4. Admin-only Course CRUD operations with dependency-protection rules (409 Conflict).
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories.course_repo import CourseRepository
from app.schemas.course_schema import (
    CourseCreate,
    CourseDetailRead,
    CourseRead,
    CourseResourceLinks,
    CourseUpdate,
)


class CourseService:
    """Control-layer service orchestrating public course browsing, search, and Admin management."""

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

    @staticmethod
    def create_course(db: Session, payload: CourseCreate) -> CourseRead:
        """Creates a new course after verifying code uniqueness (FR-04).

        Args:
            db (Session): Active SQLAlchemy database session.
            payload (CourseCreate): Validated course creation data.

        Raises:
            HTTPException (409): If a course with the same code already exists.

        Returns:
            CourseRead: The newly created course.
        """
        existing = CourseRepository.get_by_code(db, payload.code)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Course creation failed – a course with code '{payload.code}' already exists.",
            )

        course = CourseRepository.create(
            db,
            code=payload.code,
            title=payload.title,
            department=payload.department,
            semester_offered=payload.semester_offered,
        )
        return CourseRead.model_validate(course)

    @staticmethod
    def update_course(db: Session, course_id: int, payload: CourseUpdate) -> CourseRead:
        """Updates an existing course's metadata (FR-04).

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): The ID of the course to update.
            payload (CourseUpdate): Validated partial update data.

        Raises:
            HTTPException (404): If the course does not exist.
            HTTPException (409): If the new course code conflicts with an existing one.

        Returns:
            CourseRead: The updated course.
        """
        course = CourseRepository.get_by_id(db, course_id)
        if course is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – the target course does not exist.",
            )

        # If the Admin is changing the course code, ensure it doesn't clash with another course
        if payload.code is not None and payload.code.strip().upper() != course.code:
            existing_code = CourseRepository.get_by_code(db, payload.code)
            if existing_code is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Update failed – a course with code '{payload.code}' already exists.",
                )

        updated_course = CourseRepository.update(
            db,
            course,
            code=payload.code,
            title=payload.title,
            department=payload.department,
            semester_offered=payload.semester_offered,
        )
        return CourseRead.model_validate(updated_course)

    @staticmethod
    def delete_course(db: Session, course_id: int) -> None:
        """Deletes a course if and only if it has no dependent records (FR-04).

        Enforces the Risk Mitigation Policy (§1.6) to prevent accidental
        cascade deletion of student data.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): The ID of the course to delete.

        Raises:
            HTTPException (404): If the course does not exist.
            HTTPException (409): If the course has dependent records.
        """
        course = CourseRepository.get_by_id(db, course_id)
        if course is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – the target course does not exist.",
            )

        # Check if there are any Core Materials, Contributions, or Requests linked to this course
        dependents = CourseRepository.count_dependents(db, course_id)
        if dependents > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Deletion blocked – cannot delete a course that has existing materials, contributions, or requests.",
            )

        CourseRepository.delete(db, course)