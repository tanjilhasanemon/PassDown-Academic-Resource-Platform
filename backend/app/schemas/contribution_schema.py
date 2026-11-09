"""Contribution Pydantic Schemas (ECB Boundary Layer).

Defines validated contribution submission, response, and moderation schemas for
FR-07 and FR-08.
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

from app.schemas.auth_schema import UserRead
from app.schemas.course_schema import CourseRead

HttpsUrl = Annotated[
    AnyUrl,
    UrlConstraints(allowed_schemes=["https"], max_length=2048),
]
ContributionType = Literal["slides", "notes", "past_paper", "book", "other"]


class ContributionCreate(BaseModel):
    """Validated payload for submitting a course contribution."""

    title: str = Field(..., min_length=1, max_length=200)
    type: ContributionType
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


class ContributionUpdate(ContributionCreate):
    """Validated edit payload that disallows status and owner fields."""

    model_config = ConfigDict(extra="forbid")


class ContributionRead(BaseModel):
    """Safe response schema for a persisted contribution submission."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    submitted_by: int
    title: str
    type: str
    url: str
    description: str | None
    status: str
    created_at: datetime


class ContributionModerationRead(ContributionRead):
    """Pending queue schema with course and submitter metadata for review."""

    course: CourseRead
    submitter: UserRead
