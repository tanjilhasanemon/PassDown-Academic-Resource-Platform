"""Request — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.common import RequestStatus, normalize_optional_str


class MaterialRequestCreate(BaseModel):
    """Represents `MaterialRequestCreate` in the PassDown backend."""
    model_config = ConfigDict(extra="ignore")

    course_id: int | None = None
    title: str
    description: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        """Executes `validate title` operation."""
        cleaned = value.strip()
        if len(cleaned) < 5 or len(cleaned) > 200:
            raise ValueError("Request title must be between 5 and 200 characters")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        """Executes `validate description` operation."""
        return normalize_optional_str(value, 1000, "Description")


class MaterialRequestUpdate(BaseModel):
    """Represents `MaterialRequestUpdate` in the PassDown backend."""
    model_config = ConfigDict(extra="ignore")

    title: str
    description: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        """Executes `validate title` operation."""
        cleaned = value.strip()
        if len(cleaned) < 5 or len(cleaned) > 200:
            raise ValueError("Request title must be between 5 and 200 characters")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        """Executes `validate description` operation."""
        return normalize_optional_str(value, 1000, "Description")


class MaterialRequestRead(BaseModel):
    """Represents `MaterialRequestRead` in the PassDown backend."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int | None = None
    course_code: str | None = None
    course_title: str | None = None
    author_id: int | None = None
    author_name: str
    title: str
    description: str | None = None
    status: RequestStatus
    created_at: datetime
    updated_at: datetime


RequestCreate = MaterialRequestCreate
RequestUpdate = MaterialRequestUpdate
RequestRead = MaterialRequestRead
