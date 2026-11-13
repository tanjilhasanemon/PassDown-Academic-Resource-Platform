"""Course Catalogue & Detail Pydantic Schemas (ECB Boundary Layer).

Implements serialization schemas for FR-03 (`GET /api/v1/courses` and
`GET /api/v1/courses/{id}`), including hypermedia navigation links to the
course's public resource sections (`core-materials`, `contributions`, `requests`).
Also adds request validation schemas for FR-04 (Create and Update).
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


class CourseCreate(BaseModel):
    """Validated payload for creating a new course (FR-04).

    Attributes:
        code (str): Unique course code (e.g., 'CSE 451').
        title (str): Official course title.
        department (str): Academic department offering the course.
        semester_offered (str): Semester label (e.g., 'Spring 2027').
    """

    code: str = Field(..., min_length=2, max_length=32, description="Unique course code.")
    title: str = Field(..., min_length=3, max_length=200, description="Official course title.")
    department: str = Field(..., min_length=2, max_length=100, description="Academic department.")
    semester_offered: str = Field(..., min_length=3, max_length=50, description="Semester offered.")


class CourseUpdate(BaseModel):
    """Validated payload for updating an existing course (FR-04).

    All fields are optional to allow partial updates.
    """

    code: str | None = Field(default=None, min_length=2, max_length=32)
    title: str | None = Field(default=None, min_length=3, max_length=200)
    department: str | None = Field(default=None, min_length=2, max_length=100)
    semester_offered: str | None = Field(default=None, min_length=3, max_length=50)


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