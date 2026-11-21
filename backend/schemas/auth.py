"""Auth — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    """Represents `RegisterRequest` in the PassDown backend."""
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        """Executes `clean name` operation."""
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Name must be at least 2 characters")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        """Executes `normalize email` operation."""
        return str(v).strip().lower()


class TokenResponse(BaseModel):
    """Represents `TokenResponse` in the PassDown backend."""
    access_token: str
    token_type: str = "bearer"
    refresh_token: str | None = None
    session_id: int | None = None


class RefreshRequest(BaseModel):
    """Represents `RefreshRequest` in the PassDown backend."""
    refresh_token: str | None = None


class SessionRead(BaseModel):
    """Represents `SessionRead` in the PassDown backend."""
    id: int
    ip_address: str | None = None
    browser: str | None = None
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None

    model_config = {"from_attributes": True}
