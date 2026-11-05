"""Course Relational Entity Model (ECB Entity Layer).

Implements the Course entity specified in PassDown SRS §3.3.3, FR-03, and FR-04.
"""

from datetime import datetime, timezone
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Course(Base):
    """Represents an academic course in the PassDown catalogue.

    Attributes:
        id (int): Primary key identifier.
        code (str): Unique course code (e.g., 'CSE 451').
        title (str): Official course title (e.g., 'Software Engineering').
        department (str): Academic department offering the course (e.g., 'CSE').
        semester_offered (str): Validated semester label (e.g., 'Spring 2027').
        created_at (datetime): UTC timestamp when the course record was created.
    """

    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    semester_offered: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
