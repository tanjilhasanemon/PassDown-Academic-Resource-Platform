"""PassDown FastAPI Entrypoint (Boundary Layer).

Configures CORS (SRS NFR-04) and mounts `/api/v1` routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="PassDown API",
    description="Academic Resource-Sharing Platform REST API (SRS v1.0)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Returns API health status for deployment verification (SRS §4.1).

    Returns:
        dict[str, str]: Service health status payload.
    """
    return {"status": "ok", "service": "PassDown API v1.0"}
