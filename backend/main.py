"""Main — Backend Module."""
import sys
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from api.v1 import admin, admin_ops, auth, contributions, core_materials, courses, groups, me, requests
from core.config import settings
from api.v1.admin_ops import ensure_ban_reason_column
from core.database import init_db
from scripts.seed_final_demo import ensure_final_demo_data


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Executes `lifespan` operation."""
    init_db()
    ensure_ban_reason_column()
    try:
        ensure_final_demo_data()
    except Exception:
        pass
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Executes `add security headers` operation."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if not request.url.path.startswith(("/api/docs", "/api/redoc")):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: https:; "
            "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000;"
        )
    return response


app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(me.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(admin_ops.router, prefix=settings.api_v1_prefix)
app.include_router(groups.router, prefix=settings.api_v1_prefix)
app.include_router(courses.router, prefix=settings.api_v1_prefix)
app.include_router(core_materials.router, prefix=settings.api_v1_prefix)
app.include_router(contributions.router, prefix=settings.api_v1_prefix)
app.include_router(requests.router, prefix=settings.api_v1_prefix)


@app.get("/api/health", tags=["System"])
def health() -> dict[str, str]:
    """Executes `health` operation."""
    return {"status": "ok"}


FRONTEND_DIR = BACKEND_DIR.parent / "frontend" / "dist"

if FRONTEND_DIR.is_dir() and hasattr(app, "frontend"):
    app.frontend("/", directory=FRONTEND_DIR)
