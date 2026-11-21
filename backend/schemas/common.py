"""Common — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from typing import Generic, Literal, TypeVar
from urllib.parse import urlparse

from pydantic import BaseModel

T = TypeVar("T")

MaterialType = Literal["slides", "notes", "past_paper", "book", "other"]
ContributionStatus = Literal["pending", "approved", "rejected"]
ModerationStatus = Literal["approved", "rejected"]
RequestStatus = Literal["open", "fulfilled"]


class PaginatedResponse(BaseModel, Generic[T]):
    """Represents `PaginatedResponse` in the PassDown backend."""
    items: list[T]
    total: int
    limit: int
    offset: int


def validate_http_url(value: str) -> str:
    """Executes `validate http url` operation."""
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("URL cannot be empty")
    if len(cleaned) > 2048:
        raise ValueError("URL must be at most 2048 characters")
    parsed = urlparse(cleaned)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL must be a valid http or https link")
    return cleaned


def normalize_optional_str(value: str | None, max_length: int, field_label: str) -> str | None:
    """Executes `normalize optional str` operation."""
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if len(cleaned) > max_length:
        raise ValueError(f"{field_label} must be at most {max_length} characters")
    return cleaned
