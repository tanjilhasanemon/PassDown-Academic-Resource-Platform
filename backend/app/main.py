"""PassDown FastAPI Application Entrypoint.

Configures database initialization, CORS middleware, and versioned `/api/v1`
HTTP routers.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request, Response
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

logger = logging.getLogger(__name__)
_db_initialized = False


def ensure_database_initialized() -> None:
    """Idempotently initializes database tables and seeds baseline records once per process."""
    global _db_initialized
    if _db_initialized or not settings.AUTO_SEED_ON_STARTUP:
        return
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_initial_data(db)
            _db_initialized = True
        finally:
            db.close()
    except Exception as exc:  # pragma: no cover - defensive serverless startup guard
        logger.exception("Database startup initialization failed: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initializes relational database tables and seeds baseline records on startup."""
    ensure_database_initialized()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Academic Resource-Sharing Platform REST API",
    version="1.0.0",
    lifespan=lifespan,
)

allow_all_origins = "*" in settings.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_origins else settings.CORS_ORIGINS,
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def initialize_database_on_cold_start(
    request: Request, call_next: object
) -> Response:
    """Ensures database schema and demo records exist on serverless cold starts."""
    ensure_database_initialized()
    return await call_next(request)  # type: ignore[operator]


app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(course_router, prefix=settings.API_V1_PREFIX)
app.include_router(request_router, prefix=settings.API_V1_PREFIX)
app.include_router(core_material_router, prefix=settings.API_V1_PREFIX)
app.include_router(contribution_router, prefix=settings.API_V1_PREFIX)
app.include_router(contribution_moderation_router, prefix=settings.API_V1_PREFIX)
app.include_router(contribution_management_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Health"])
def root_status() -> dict[str, str]:
    """Returns root API metadata and links to Swagger UI and health check."""
    return {
        "service": "PassDown API v1.0",
        "status": "ok",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


@app.get("/api/v1/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Returns API health status for readiness verification.

    Returns:
        dict[str, str]: Service health status payload.
    """
    return {"status": "ok", "service": "PassDown API v1.0"}
