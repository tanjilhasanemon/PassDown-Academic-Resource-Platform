"""Unified Vercel Serverless ASGI Entrypoint for PassDown FastAPI Backend."""

from pathlib import Path
import sys

BACKEND_ROOT = str(Path(__file__).resolve().parent.parent / "backend")
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.main import app  # noqa: E402, F401
