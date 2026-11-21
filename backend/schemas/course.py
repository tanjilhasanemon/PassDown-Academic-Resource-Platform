"""Course — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from schemas.common import normalize_optional_str


class CourseBase(BaseModel):
    """Represents `CourseBase` in the PassDown backend."""
    code: str
    title: str
    department: str | None = None
    semester_offered: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        """Executes `validate code` operation."""
        cleaned = value.strip().upper()
        if len(cleaned) < 2 or len(cleaned) > 20:
            raise ValueError("Course code must be between 2 and 20 characters")
        return cleaned

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        """Executes `validate title` operation."""
        cleaned = value.strip()
        if len(cleaned) < 3 or len(cleaned) > 200:
            raise ValueError("Course title must be between 3 and 200 characters")
        return cleaned

    @field_validator("department")
    @classmethod
    def validate_department(cls, value: str | None) -> str | None:
        """Executes `validate department` operation."""
        return normalize_optional_str(value, 100, "Department")

    @field_validator("semester_offered")
    @classmethod
    def validate_semester(cls, value: str | None) -> str | None:
        """Executes `validate semester` operation."""
        return normalize_optional_str(value, 50, "Semester offered")


class CourseCreate(CourseBase):
    """Represents `CourseCreate` in the PassDown backend."""
    pass


class CourseUpdate(CourseBase):
    """Represents `CourseUpdate` in the PassDown backend."""
    pass


class CourseRead(BaseModel):
    """Represents `CourseRead` in the PassDown backend."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    title: str
    department: str | None = None
    semester_offered: str | None = None
    created_at: datetime
    updated_at: datetime
