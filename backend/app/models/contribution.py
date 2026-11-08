"""Contribution Relational Entity Model (ECB Entity Layer).

Implements the Contribution entity specified in PassDown SRS §3.3.3 and FR-07.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Contribution(Base):
    """Represents a user-submitted academic resource awaiting review.

    Attributes:
        id (int): Primary key identifier.
        course_id (int): Course associated with the submitted resource.
        submitted_by (int): Registered user who submitted the resource.
        title (str): Short title describing the resource.
        type (str): Resource type such as slides, notes, or past_paper.
        url (str): HTTPS URL pointing to the resource.
        description (str): Additional details about the resource.
        status (str): Review status, initially and exclusively set to 'pending'.
        created_at (datetime): UTC timestamp when the submission was created.
    """

    __tablename__ = "contributions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"), nullable=False, index=True
    )
    submitted_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", server_default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
