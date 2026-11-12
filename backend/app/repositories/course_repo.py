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

    @staticmethod
    def update(
        db: Session,
        course: Course,
        *,
        code: str | None = None,
        title: str | None = None,
        department: str | None = None,
        semester_offered: str | None = None,
    ) -> Course:
        """Updates an existing Course record with provided non-None fields.

        Args:
            db (Session): Active SQLAlchemy database session.
            course (Course): The Course entity to update.
            code (str | None): New course code if provided.
            title (str | None): New title if provided.
            department (str | None): New department if provided.
            semester_offered (str | None): New semester if provided.

        Returns:
            Course: The updated and refreshed Course ORM instance.
        """
        if code is not None:
            course.code = code.strip().upper()
        if title is not None:
            course.title = title.strip()
        if department is not None:
            course.department = department.strip()
        if semester_offered is not None:
            course.semester_offered = semester_offered.strip()

        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def delete(db: Session, course: Course) -> None:
        """Deletes a Course record from the database.

        Args:
            db (Session): Active SQLAlchemy database session.
            course (Course): The Course entity to delete.
        """
        db.delete(course)
        db.commit()

    @staticmethod
    def count_dependents(db: Session, course_id: int) -> int:
        """Counts total dependent records (materials, contributions, requests) for a course.

        Used to enforce the FR-04 deletion protection rule (409 Conflict).

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Unique primary key of the course.

        Returns:
            int: Total number of dependent records associated with the course.
        """
        from app.models.core_material import CoreMaterial
        from app.models.contribution import Contribution
        from app.models.request import Request

        materials_count = (
            db.query(CoreMaterial)
            .filter(CoreMaterial.course_id == course_id)
            .count()
        )
        contributions_count = (
            db.query(Contribution)
            .filter(Contribution.course_id == course_id)
            .count()
        )
        requests_count = (
            db.query(Request).filter(Request.course_id == course_id).count()
        )

        return materials_count + contributions_count + requests_count