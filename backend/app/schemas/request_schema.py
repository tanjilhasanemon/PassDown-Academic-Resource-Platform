"""Resource Request Pydantic Schemas (ECB Boundary Layer).

Defines the FR-10 request submission payload and safe response contract.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RequestCreate(BaseModel):
    """Validated payload for submitting a course resource request."""

    description: str = Field(..., min_length=1)

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: Any) -> Any:
        """Trims the description so whitespace-only input fails validation."""
        return value.strip() if isinstance(value, str) else value


class RequestRead(BaseModel):
    """Safe response schema for a persisted resource request."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    submitted_by: int
    description: str
    status: str
    created_at: datetime