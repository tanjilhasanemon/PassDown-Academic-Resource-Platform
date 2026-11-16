"""Course Repository (Entity Layer).


Encapsulates all SQLAlchemy database queries for the `courses` table, including
public listing, case-insensitive search by code or title, creation, updates,
and safe deletion with dependent-entity counting.
"""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.contribution import Contribution
from app.models.core_material import CoreMaterial
from app.models.course import Course
from app.models.request import Request


class CourseRepository:
    """Data-access repository for `Course` ORM entities."""

    @staticmethod
    def list_courses(
        db: Session, search: str | None = None
    ) -> list[Course]:
        """Lists all courses ordered by course code, optionally filtered by `search`.

        Args:
            db: Active SQLAlchemy database session.
            search: Optional substring matched case-insensitively against
                `Course.code` or `Course.title` (SRS §3.1 FR-03).

        Returns:
            list[Course]: Ordered list of matching `Course` ORM instances.
        """
        stmt = select(Course)
        if search and search.strip():
            raw = search.strip()
            pattern = f"%{raw}%"
            compact_pattern = f"%{raw.replace(' ', '')}%"
            stmt = stmt.where(
                or_(
                    Course.code.ilike(pattern),
                    func.replace(Course.code, " ", "").ilike(compact_pattern),
                    Course.title.ilike(pattern),
                )
            )
        stmt = stmt.order_by(Course.code.asc())
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_by_id(db: Session, course_id: int) -> Course | None:
        """Retrieves a single `Course` by its primary key ID.

        Args:
            db: Active SQLAlchemy database session.
            course_id: Integer primary key of the course.

        Returns:
            Course | None: The matching `Course` entity if found, else `None`.
        """
        stmt = select(Course).where(Course.id == course_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_by_code(db: Session, code: str) -> Course | None:
        """Retrieves a single `Course` by its unique course code (case-insensitive).

        Args:
            db: Active SQLAlchemy database session.
            code: Course code string (e.g., `'CSE 451'`).

        Returns:
            Course | None: The matching `Course` entity if found, else `None`.
        """
        normalized_code = code.strip().upper()
        stmt = select(Course).where(func.upper(Course.code) == normalized_code)
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
        """Persists a new `Course` entity in the database.

        Args:
            db: Active SQLAlchemy database session.
            code: Unique course code (e.g., `'CSE 451'`).
            title: Full academic title of the course.
            department: Offering academic department (e.g., `'CSE'`).
            semester_offered: Academic term offered (e.g., `'Spring 2027'`).

        Returns:
            Course: Newly created and refreshed `Course` ORM entity.
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
    def update(db: Session, course: Course, **kwargs: str | None) -> Course:
        """Updates an existing `Course` entity with provided non-None fields.

        Args:
            db: Active SQLAlchemy database session.
            course: Existing `Course` ORM instance to update.
            **kwargs: Field names and updated string values.

        Returns:
            Course: Updated and refreshed `Course` ORM entity.
        """
        for key, value in kwargs.items():
            if value is not None:
                cleaned = value.strip().upper() if key == "code" else value.strip()
                setattr(course, key, cleaned)
        db.commit()
        db.refresh(course)
        return course

    @staticmethod
    def delete(db: Session, course: Course) -> None:
        """Deletes a `Course` entity from the database.

        Args:
            db: Active SQLAlchemy database session.
            course: Existing `Course` ORM instance to delete.
        """
        db.delete(course)
        db.commit()

    @staticmethod
    def count_dependents(db: Session, course_id: int) -> int:
        """Counts total dependent CoreMaterials, Contributions, and Requests for a course.

        Used by FR-04 to block course deletion with `409 Conflict` when dependent
        academic records exist.

        Args:
            db: Active SQLAlchemy database session.
            course_id: Primary key of the course to inspect.

        Returns:
            int: Total count of dependent records across all 3 child tables.
        """
        materials_count = db.execute(
            select(func.count(CoreMaterial.id)).where(
                CoreMaterial.course_id == course_id
            )
        ).scalar_one()
        contributions_count = db.execute(
            select(func.count(Contribution.id)).where(
                Contribution.course_id == course_id
            )
        ).scalar_one()
        requests_count = db.execute(
            select(func.count(Request.id)).where(Request.course_id == course_id)
        ).scalar_one()
        return int(materials_count + contributions_count + requests_count)
