"""Audit — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    """Represents `AuditLogRead` in the PassDown backend."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    user_email: str
    action: str
    details: str | None = None
    ip_address: str
    user_agent: str | None = None
    is_security_event: bool
    created_at: datetime


class SecurityIpSummary(BaseModel):
    """Represents `SecurityIpSummary` in the PassDown backend."""
    ip_address: str
    failures: int
    what_happened: str
    emails_tried: list[str]
    browser: str
    last_seen: datetime


class SecurityAccountSummary(BaseModel):
    """Represents `SecurityAccountSummary` in the PassDown backend."""
    user_id: int | None = None
    email: str
    status: str
    failures: int
    from_addresses: list[str]
    browser: str
    last_seen: datetime


class SecurityOverviewRead(BaseModel):
    """Represents `SecurityOverviewRead` in the PassDown backend."""
    min_failures: int
    hours: int
    by_ip: list[SecurityIpSummary]
    by_account: list[SecurityAccountSummary]


class PurgeResultRead(BaseModel):
    """Represents `PurgeResultRead` in the PassDown backend."""
    deleted_count: int
    older_than_days: int
