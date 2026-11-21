"""Contribution — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.common import (
    ContributionStatus,
    MaterialType,
    ModerationStatus,
    normalize_optional_str,
    validate_http_url,
)


class ContributionCreate(BaseModel):
    """Represents `ContributionCreate` in the PassDown backend."""
    model_config = ConfigDict(extra="ignore")

    title: str
    type: MaterialType
    url: str
    description: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        """Executes `validate title` operation."""
        cleaned = value.strip()
        if len(cleaned) < 3 or len(cleaned) > 200:
            raise ValueError("Contribution title must be between 3 and 200 characters")
        return cleaned

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        """Executes `validate url` operation."""
        return validate_http_url(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        """Executes `validate description` operation."""
        return normalize_optional_str(value, 1000, "Description")


class ContributionUpdate(BaseModel):
    """Represents `ContributionUpdate` in the PassDown backend."""
    model_config = ConfigDict(extra="ignore")

    title: str
    type: MaterialType
    url: str
    description: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        """Executes `validate title` operation."""
        cleaned = value.strip()
        if len(cleaned) < 3 or len(cleaned) > 200:
            raise ValueError("Contribution title must be between 3 and 200 characters")
        return cleaned

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        """Executes `validate url` operation."""
        return validate_http_url(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        """Executes `validate description` operation."""
        return normalize_optional_str(value, 1000, "Description")


class ContributionStatusUpdate(BaseModel):
    """Represents `ContributionStatusUpdate` in the PassDown backend."""
    status: ModerationStatus


class ContributionRead(BaseModel):
    """Represents `ContributionRead` in the PassDown backend."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    course_code: str | None = None
    course_title: str | None = None
    author_id: int | None = None
    author_name: str
    title: str
    type: MaterialType
    url: str
    description: str | None = None
    status: ContributionStatus
    created_at: datetime
    updated_at: datetime
