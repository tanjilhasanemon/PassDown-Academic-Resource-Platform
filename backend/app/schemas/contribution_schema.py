"""Contribution Pydantic Schemas (ECB Boundary Layer).

Defines validated FR-07 submission input and safe contribution response schemas.
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
    description: str = Field(..., min_length=1, max_length=2000)

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_text_fields(cls, value: Any) -> Any:
        """Trims text input so whitespace-only titles and descriptions fail."""
        return value.strip() if isinstance(value, str) else value


class ContributionRead(BaseModel):
    """Safe response schema for a persisted contribution submission."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    submitted_by: int
    title: str
    type: str
    url: str
    description: str
    status: str
    created_at: datetime
