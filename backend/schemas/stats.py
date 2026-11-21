"""Stats — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from pydantic import BaseModel


class ContributionStatusCounts(BaseModel):
    """Represents `ContributionStatusCounts` in the PassDown backend."""
    pending: int = 0
    approved: int = 0
    rejected: int = 0


class RequestStatusCounts(BaseModel):
    """Represents `RequestStatusCounts` in the PassDown backend."""
    open: int = 0
    fulfilled: int = 0


class UserSummaryRead(BaseModel):
    """Represents `UserSummaryRead` in the PassDown backend."""
    contributions: ContributionStatusCounts
    requests: RequestStatusCounts


class PlatformStatsRead(BaseModel):
    """Represents `PlatformStatsRead` in the PassDown backend."""
    users: int = 0
    courses: int = 0
    core_materials: int = 0
    contributions: ContributionStatusCounts
    requests: RequestStatusCounts
