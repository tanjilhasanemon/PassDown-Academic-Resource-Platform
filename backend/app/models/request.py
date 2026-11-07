"""Resource Request Relational Entity Model (ECB Entity Layer).

Implements the Request entity specified in PassDown SRS §3.3.3 and FR-10.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Request(Base):
    """Represents a user's request for a missing resource in a course.

    Attributes:
        id (int): Primary key identifier.
        course_id (int): Course for which the resource is requested.
        submitted_by (int): Registered user who submitted the request.
        description (str): Non-empty description of the requested resource.
        status (str): Request lifecycle status, initially 'open'.
        created_at (datetime): UTC timestamp when the request was created.
    """

    __tablename__ = "requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"), nullable=False, index=True
    )
    submitted_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="open", server_default="open"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )