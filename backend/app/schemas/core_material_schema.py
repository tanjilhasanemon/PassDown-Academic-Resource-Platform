"""Core Material Pydantic Schemas (ECB Boundary Layer).

Defines validated payloads and response models for Admin Core Material CRUD.
"""

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    AnyUrl,
    BaseModel,
    ConfigDict,
    Field,
    UrlConstraints,
    field_validator,
)

# Restrict URLs strictly to HTTPS (SRS §3.4 Input Validation)
HttpsUrl = Annotated[
    AnyUrl,
    UrlConstraints(allowed_schemes=["https"], max_length=2048),
]

# Restrict allowed types exactly as stated in the SRS
CoreMaterialType = Literal["slides", "notes", "past_paper", "book", "other"]


class CoreMaterialCreate(BaseModel):
    """Validated payload for adding a new Core Material (Admin only)."""

    title: str = Field(..., min_length=3, max_length=200)
    type: CoreMaterialType
    url: HttpsUrl
    description: str | None = Field(default=None, min_length=1, max_length=2000)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: Any) -> Any:
        """Trims the title so whitespace-only input fails validation."""
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: Any) -> Any:
        """Trims a supplied description and treats whitespace-only input as absent."""
        if isinstance(value, str):
            return value.strip() or None
        return value


class CoreMaterialUpdate(BaseModel):
    """Validated payload for updating an existing Core Material (Admin only).

    All fields are optional to allow partial updates.
    """

    title: str | None = Field(default=None, min_length=3, max_length=200)
    type: CoreMaterialType | None = None
    url: HttpsUrl | None = None
    description: str | None = Field(default=None, min_length=1, max_length=2000)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value: Any) -> Any:
        """Trims the title."""
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: Any) -> Any:
        """Trims a supplied description."""
        if isinstance(value, str):
            return value.strip() or None
        return value


class CoreMaterialRead(BaseModel):
    """Safe response schema for a persisted Core Material record."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    title: str
    type: str
    url: str
    description: str | None
    created_at: datetime