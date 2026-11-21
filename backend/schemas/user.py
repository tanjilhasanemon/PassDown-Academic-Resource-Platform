"""User — Pydantic Request/Response Schema (ECB Boundary Layer)."""
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

UserRole = Literal["student", "admin"]

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_email_str(value: str) -> str:
    """Executes `validate email str` operation."""
    cleaned = value.strip().lower()
    if not cleaned or len(cleaned) > 254 or not _EMAIL_REGEX.match(cleaned):
        raise ValueError("Enter a valid email address (up to 254 characters)")
    return cleaned


def validate_password_strength(value: str) -> str:
    """Executes `validate password strength` operation."""
    if len(value) < 8 or len(value) > 128:
        raise ValueError("Password must be between 8 and 128 characters")
    if not any(ch.isalpha() for ch in value):
        raise ValueError("Password must contain at least one letter")
    if not any(ch.isdigit() for ch in value):
        raise ValueError("Password must contain at least one digit")
    return value


def validate_user_name(value: str) -> str:
    """Executes `validate user name` operation."""
    cleaned = value.strip()
    if len(cleaned) < 2 or len(cleaned) > 100:
        raise ValueError("Name must be between 2 and 100 characters")
    return cleaned


class UserRead(BaseModel):
    """Represents `UserRead` in the PassDown backend."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(BaseModel):
    """Represents `UserProfileUpdate` in the PassDown backend."""
    name: str

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str) -> str:
        """Executes `check name` operation."""
        return validate_user_name(value)


class UserPasswordUpdate(BaseModel):
    """Represents `UserPasswordUpdate` in the PassDown backend."""
    current_password: str
    new_password: str

    @field_validator("current_password")
    @classmethod
    def check_current_password(cls, value: str) -> str:
        """Executes `check current password` operation."""
        if not value:
            raise ValueError("Current password is required")
        return value

    @field_validator("new_password")
    @classmethod
    def check_new_password(cls, value: str) -> str:
        """Executes `check new password` operation."""
        return validate_password_strength(value)


class UserActiveUpdate(BaseModel):
    """Represents `UserActiveUpdate` in the PassDown backend."""
    is_active: bool
