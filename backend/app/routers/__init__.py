"""FastAPI HTTP Routers (ECB Boundary Layer)."""

from app.routers.auth_router import router as auth_router
from app.routers.course_router import router as course_router

__all__ = ["auth_router", "course_router"]
