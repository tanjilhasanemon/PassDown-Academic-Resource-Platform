"""Course Catalogue & Detail Pydantic Schemas (ECB Boundary Layer).

Implements serialization schemas for FR-03 (`GET /api/v1/courses` and
`GET /api/v1/courses/{id}`), including hypermedia navigation links to the
course's public resource sections (`core-materials`, `contributions`, `requests`).
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CourseResourceLinks(BaseModel):
    """Navigation links to a course's public resource sections (SRS FR-03)."""

    core_materials: str = Field(
        ...,
        description="Public endpoint for admin-curated Core Materials (FR-05).",
    )
    approved_contributions: str = Field(
        ...,
        description="Public endpoint for approved student Contributions (FR-05).",
    )
    requests: str = Field(
        ...,
        description="Public endpoint for course missing-material Requests (FR-11).",
    )


class CourseRead(BaseModel):
    """Summary schema for a Course record in the public catalogue list (FR-03)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    department: str
    semester_offered: str
    created_at: datetime


class CourseDetailRead(CourseRead):
    """Detailed Course response schema with public resource section links (FR-03)."""

    resource_links: CourseResourceLinks
