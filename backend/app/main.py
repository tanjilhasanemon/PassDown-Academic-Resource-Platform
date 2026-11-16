"""PassDown FastAPI Application Entrypoint.

Configures database initialization, CORS middleware, and versioned `/api/v1`
HTTP routers.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.seed import seed_initial_data
import app.models  # noqa: F401
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


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initializes relational database tables and seeds baseline records on startup."""
    if settings.AUTO_SEED_ON_STARTUP:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_initial_data(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Academic Resource-Sharing Platform REST API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(course_router, prefix=settings.API_V1_PREFIX)
app.include_router(request_router, prefix=settings.API_V1_PREFIX)
app.include_router(core_material_router, prefix=settings.API_V1_PREFIX)
app.include_router(contribution_router, prefix=settings.API_V1_PREFIX)
app.include_router(contribution_moderation_router, prefix=settings.API_V1_PREFIX)
app.include_router(contribution_management_router, prefix=settings.API_V1_PREFIX)


@app.get("/api/v1/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Returns API health status for readiness verification.

    Returns:
        dict[str, str]: Service health status payload.
    """
    return {"status": "ok", "service": "PassDown API v1.0"}
