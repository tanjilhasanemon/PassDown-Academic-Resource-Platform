"""Course — ORM Entity Model (ECB Entity Layer)."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.contribution import Contribution
    from models.core_material import CoreMaterial
    from models.request import MaterialRequest


class Course(Base):
    """Represents `Course` in the PassDown backend."""
    __tablename__ = "course"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    semester_offered: Mapped[str | None] = mapped_column(String(50), nullable=True)
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

    core_materials: Mapped[list["CoreMaterial"]] = relationship(
        "CoreMaterial",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    contributions: Mapped[list["Contribution"]] = relationship(
        "Contribution",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    requests: Mapped[list["MaterialRequest"]] = relationship(
        "MaterialRequest",
        back_populates="course",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
