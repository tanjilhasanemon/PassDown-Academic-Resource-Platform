"""Boundary Layer FastAPI Routers Package."""

from app.routers.auth_router import router as auth_router
from app.routers.contribution_management_router import (
    router as contribution_management_router,
)
from app.routers.contribution_moderation_router import (
    router as contribution_moderation_router,
)
from app.routers.contribution_router import router as contribution_router
from app.routers.core_material_router import router as core_material_router
from app.routers.course_router import router as course_router
from app.routers.request_router import router as request_router

__all__ = [
    "auth_router",
    "course_router",
    "core_material_router",
    "contribution_router",
    "contribution_moderation_router",
    "contribution_management_router",
    "request_router",
]
