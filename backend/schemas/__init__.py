"""Init — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from schemas.auth import RegisterRequest, TokenResponse
from schemas.common import (
    ContributionStatus,
    MaterialType,
    ModerationStatus,
    PaginatedResponse,
    RequestStatus,
)
from schemas.contribution import (
    ContributionCreate,
    ContributionRead,
    ContributionStatusUpdate,
    ContributionUpdate,
)
from schemas.core_material import (
    CoreMaterialCreate,
    CoreMaterialRead,
    CoreMaterialUpdate,
)
from schemas.course import CourseCreate, CourseRead, CourseUpdate
from schemas.request import (
    MaterialRequestCreate,
    MaterialRequestRead,
    MaterialRequestUpdate,
    RequestCreate,
    RequestRead,
    RequestUpdate,
)
from schemas.stats import (
    ContributionStatusCounts,
    PlatformStatsRead,
    RequestStatusCounts,
    UserSummaryRead,
)
from schemas.user import (
    UserActiveUpdate,
    UserPasswordUpdate,
    UserProfileUpdate,
    UserRead,
    UserRole,
)

__all__ = [
    "MaterialType",
    "ContributionStatus",
    "ModerationStatus",
    "RequestStatus",
    "PaginatedResponse",
    "CourseCreate",
    "CourseUpdate",
    "CourseRead",
    "CoreMaterialCreate",
    "CoreMaterialUpdate",
    "CoreMaterialRead",
    "ContributionCreate",
    "ContributionUpdate",
    "ContributionStatusUpdate",
    "ContributionRead",
    "MaterialRequestCreate",
    "MaterialRequestUpdate",
    "MaterialRequestRead",
    "RequestCreate",
    "RequestUpdate",
    "RequestRead",
    "RegisterRequest",
    "TokenResponse",
    "UserRead",
    "UserRole",
    "UserProfileUpdate",
    "UserPasswordUpdate",
    "UserActiveUpdate",
    "ContributionStatusCounts",
    "RequestStatusCounts",
    "UserSummaryRead",
    "PlatformStatsRead",
]
