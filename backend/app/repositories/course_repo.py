"""Course Repository Module (ECB Entity Layer).

Provides public listing, case-insensitive search (?search=), and lookup
queries for Course entities in compliance with PassDown SRS FR-03 and FR-04.
"""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.course import Course


class CourseRepository:
    """Encapsulates SQLAlchemy persistence operations for Course entities."""

    @staticmethod
    def list_courses(db: Session, search: str | None = None) -> list[Course]:
        """Lists courses ordered by code, optionally filtered by code or title.

        Enforces SRS FR-03: Given a search term matches a course code or title,
        when ?search= is supplied, matching courses are returned.

        Args:
            db (Session): Active SQLAlchemy database session.
            search (str | None): Optional search substring for code or title.

        Returns:
            list[Course]: Matching Course ORM records ordered by course code.
        """
        stmt = select(Course)
        if search and search.strip():
            pattern = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Course.code).like(pattern),
                    func.lower(Course.title).like(pattern),
                )
            )
        stmt = stmt.order_by(Course.code.asc())
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_by_id(db: Session, course_id: int) -> Course | None:
        """Retrieves a Course record by its primary key ID.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Unique primary key of the course.

        Returns:
            Course | None: Matching Course entity if found, otherwise None.
        """
        stmt = select(Course).where(Course.id == course_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_by_code(db: Session, code: str) -> Course | None:
        """Retrieves a Course record by its unique course code (case-insensitive).

        Args:
            db (Session): Active SQLAlchemy database session.
            code (str): Course code to look up (e.g., 'CSE 451').

        Returns:
            Course | None: Matching Course entity if found, otherwise None.
        """
        normalized = code.strip().upper()
        stmt = select(Course).where(func.upper(Course.code) == normalized)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def create(
        db: Session,
        *,
        code: str,
        title: str,
        department: str,
        semester_offered: str,
    ) -> Course:
        """Persists a new Course record in the database.

        Args:
            db (Session): Active SQLAlchemy database session.
            code (str): Unique course code (e.g., 'CSE 451').
            title (str): Course title (e.g., 'Software Engineering').
            department (str): Department name (e.g., 'CSE').
            semester_offered (str): Offered semester label (e.g., 'Spring 2027').

        Returns:
            Course: Newly created and refreshed Course ORM instance.
        """
        course = Course(
            code=code.strip().upper(),
            title=title.strip(),
            department=department.strip(),
            semester_offered=semester_offered.strip(),
        )
        db.add(course)
        db.commit()
        db.refresh(course)
        return course
