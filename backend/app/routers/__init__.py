"""FastAPI HTTP Routers (ECB Boundary Layer)."""

from app.routers.auth_router import router as auth_router
from app.routers.course_router import router as course_router
from app.routers.contribution_moderation_router import (
    router as contribution_moderation_router,
)
from app.routers.contribution_management_router import (
    router as contribution_management_router,
)

__all__ = [
    "auth_router",
    "course_router",
    "contribution_management_router",
    "contribution_moderation_router",
]
