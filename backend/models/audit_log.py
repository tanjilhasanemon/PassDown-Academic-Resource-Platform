"""Audit Log — ORM Entity Model (ECB Entity Layer)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class AuditLog(Base):
    """Represents `AuditLog` in the PassDown backend."""
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("app_user.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    user_email: Mapped[str] = mapped_column(String(254), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    details: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_security_event: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="0",
        index=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False,
    )
