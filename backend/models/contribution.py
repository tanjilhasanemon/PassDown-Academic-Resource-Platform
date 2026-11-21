"""Contribution — ORM Entity Model (ECB Entity Layer)."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.app_user import AppUser
    from models.course import Course


class Contribution(Base):
    """Represents `Contribution` in the PassDown backend."""
    __tablename__ = "contribution"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("course.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    author_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("app_user.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    author_name: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
        server_default="pending",
        index=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    course: Mapped["Course"] = relationship("Course", back_populates="contributions")
    author: Mapped["AppUser | None"] = relationship(
        "AppUser", back_populates="contributions"
    )

    @property
    def course_code(self) -> str | None:
        """Executes `course code` operation."""
        return self.course.code if self.course else None

    @property
    def course_title(self) -> str | None:
        """Executes `course title` operation."""
        return self.course.title if self.course else None
