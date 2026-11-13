"""Core Material Relational Entity Model (ECB Entity Layer).

Implements the CoreMaterial entity specified in PassDown SRS §3.3.3, FR-05, and FR-06.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CoreMaterial(Base):
    """Represents an admin-curated academic resource link for a course.

    Attributes:
        id (int): Primary key identifier.
        course_id (int): Course associated with the material.
        title (str): Short title describing the resource.
        type (str): Resource type such as slides, notes, or past_paper.
        url (str): HTTPS URL pointing to the resource.
        description (str | None): Optional additional resource details.
        created_at (datetime): UTC timestamp when the material was added.
    """

    __tablename__ = "core_materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )