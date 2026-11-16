"""Course Repository Module (ECB Entity Layer)."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.course import Course


class CourseRepository:
    """Encapsulates SQLAlchemy persistence operations for Course entities."""

    @staticmethod
    def list_courses(db: Session, search: str | None = None) -> list[Course]:
        """Lists courses ordered by code, optionally filtered by code or title."""
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
        """Retrieves a Course record by its primary key ID."""
        stmt = select(Course).where(Course.id == course_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_by_code(db: Session, code: str) -> Course | None:
        """Retrieves a Course record by its unique course code."""
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
        """Persists a new Course record in the database."""
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
        """Updates an existing Course record with provided non-None fields."""
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
        """Deletes a Course record from the database."""
        db.delete(course)
        db.commit()

    @staticmethod
    def count_dependents(db: Session, course_id: int) -> int:
        """Counts total dependent records for a course."""
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