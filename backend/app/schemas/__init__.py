"""Boundary Layer Request/Response Schemas Package."""

from app.schemas.auth_schema import (
    LoginRequest,
    ScopeCheckResponse,
    TokenResponse,
    UserRead,
    UserRegisterRequest,
)
from app.schemas.contribution_schema import (
    ContributionCreate,
    ContributionModerationRead,
    ContributionRead,
    ContributionUpdate,
)
from app.schemas.core_material_schema import (
    CoreMaterialCreate,
    CoreMaterialRead,
    CoreMaterialUpdate,
)
from app.schemas.course_schema import (
    CourseCreate,
    CourseDetailRead,
    CourseRead,
    CourseResourceLinks,
    CourseUpdate,
)
from app.schemas.request_schema import (
    RequestCreate,
    RequestPublicRead,
    RequestRead,
)

__all__ = [
    "UserRegisterRequest",
    "LoginRequest",
    "UserRead",
    "TokenResponse",
    "ScopeCheckResponse",
    "CourseCreate",
    "CourseUpdate",
    "CourseRead",
    "CourseResourceLinks",
    "CourseDetailRead",
    "CoreMaterialCreate",
    "CoreMaterialUpdate",
    "CoreMaterialRead",
    "ContributionCreate",
    "ContributionUpdate",
    "ContributionRead",
    "ContributionModerationRead",
    "RequestCreate",
    "RequestRead",
    "RequestPublicRead",
]
