"""Authentication & User Profile Pydantic Schemas (ECB Boundary Layer).

Implements input validation and safe response serialization for FR-01:
- Validates email format, non-empty trimmed name, and password minimum length.
- Explicitly excludes `password_hash` from UserRead responses (SRS NFR-01).
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRegisterRequest(BaseModel):
    """Request payload schema for public student registration (FR-01).

    Any client-supplied `role` field is accepted only as an ignored optional
    attribute so attempts to pass `role="admin"` never escalate privileges.
    """

    name: str = Field(
        ...,
        min_length=2,
        max_length=120,
        description="Full display name of the prospective student.",
    )
    email: EmailStr = Field(
        ...,
        description="Unique university email address.",
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Plaintext password (minimum 8 characters; hashed before storage).",
    )
    role: str | None = Field(
        default=None,
        description="Ignored during public registration; server always forces role='student'.",
    )

    @field_validator("name")
    @classmethod
    def validate_trimmed_name(cls, value: str) -> str:
        """Trims whitespace and rejects blank names (SRS §3.4 Input Validation)."""
        trimmed = value.strip()
        if len(trimmed) < 2:
            raise ValueError("Name must contain at least 2 non-whitespace characters.")
        return trimmed


class UserRead(BaseModel):
    """Safe user profile response schema for /auth/register and /auth/me (FR-01).

    Never exposes `password_hash` (SRS FR-01 & NFR-01).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: str
    created_at: datetime
