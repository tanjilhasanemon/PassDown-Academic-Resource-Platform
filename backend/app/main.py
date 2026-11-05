"""PassDown FastAPI Entrypoint (ECB Boundary Layer).

Configures CORS (SRS NFR-04) and mounts `/api/v1` routers for Auth (FR-01, FR-02)
and Courses (FR-03).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.auth_router import router as auth_router
from app.routers.course_router import router as course_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Academic Resource-Sharing Platform REST API (SRS v1.0)",
    version="1.0.0",
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


@app.get("/api/v1/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Returns API health status for deployment verification (SRS §4.1).

    Returns:
        dict[str, str]: Service health status payload.
    """
    return {"status": "ok", "service": "PassDown API v1.0"}
