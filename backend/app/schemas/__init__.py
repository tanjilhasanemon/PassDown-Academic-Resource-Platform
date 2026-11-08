"""Pydantic v2 Request and Response Schemas (ECB Boundary Validation).

Exports validated DTO schemas for PassDown REST API endpoints.
"""

from app.schemas.auth_schema import (
    LoginRequest,
    ScopeCheckResponse,
    TokenResponse,
    UserRead,
    UserRegisterRequest,
)
from app.schemas.course_schema import (
    CourseDetailRead,
    CourseRead,
    CourseResourceLinks,
)
from app.schemas.contribution_schema import ContributionCreate, ContributionRead
from app.schemas.request_schema import RequestCreate, RequestRead

__all__ = [
    "ContributionCreate",
    "ContributionRead",
    "CourseDetailRead",
    "CourseRead",
    "CourseResourceLinks",
    "RequestCreate",
    "RequestRead",
    "LoginRequest",
    "ScopeCheckResponse",
    "TokenResponse",
    "UserRead",
    "UserRegisterRequest",
]
