"""PassDown FastAPI Entrypoint (ECB Boundary Layer).

Configures CORS (SRS NFR-04), initializes database tables and controlled seed
records on startup (SRS §1.5 & §4.4), and mounts `/api/v1` routers for Auth
(FR-01, FR-02) and Courses (FR-03).
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.seed import seed_initial_data
from app.routers.auth_router import router as auth_router
from app.routers.course_router import router as course_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Initializes database schema and seeds default IUB courses on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Academic Resource-Sharing Platform REST API (SRS v1.0)",
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


@app.get("/api/v1/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Returns API health status for deployment verification (SRS §4.1).

    Returns:
        dict[str, str]: Service health status payload.
    """
    return {"status": "ok", "service": "PassDown API v1.0"}
