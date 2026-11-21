"""Group — Pydantic Request/Response Schema (ECB Boundary Layer)."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class StudyGroupCreate(BaseModel):
    """Represents `StudyGroupCreate` in the PassDown backend."""
    name: str = Field(..., min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    course_code: str | None = Field(default=None, max_length=20)


class StudyGroupUpdate(BaseModel):
    """Represents `StudyGroupUpdate` in the PassDown backend."""
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    course_code: str | None = Field(default=None, max_length=20)


class GroupMemberAdd(BaseModel):
    """Represents `GroupMemberAdd` in the PassDown backend."""
    email: EmailStr
    can_create: bool = True
    can_edit: bool = False
    can_assign: bool = False


class GroupMemberUpdate(BaseModel):
    """Represents `GroupMemberUpdate` in the PassDown backend."""
    can_create: bool
    can_edit: bool
    can_assign: bool


class GroupMemberRead(BaseModel):
    """Represents `GroupMemberRead` in the PassDown backend."""
    id: int
    user_id: int
    name: str
    email: str
    can_create: bool
    can_edit: bool
    can_assign: bool
    added_at: datetime


class GroupResourceCreate(BaseModel):
    """Represents `GroupResourceCreate` in the PassDown backend."""
    title: str = Field(..., min_length=2, max_length=200)
    url: str = Field(..., min_length=8, max_length=500)
    resource_type: str = Field(default="notes", max_length=32)
    notes: str | None = Field(default=None, max_length=1000)
    assigned_to_id: int | None = None


class GroupResourceUpdate(BaseModel):
    """Represents `GroupResourceUpdate` in the PassDown backend."""
    title: str | None = Field(default=None, min_length=2, max_length=200)
    url: str | None = Field(default=None, min_length=8, max_length=500)
    resource_type: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=1000)
    status: str | None = Field(default=None, max_length=24)
    assigned_to_id: int | None = None
    update_assignment: bool = False


class GroupResourceRead(BaseModel):
    """Represents `GroupResourceRead` in the PassDown backend."""
    id: int
    group_id: int
    title: str
    url: str
    resource_type: str
    notes: str | None = None
    status: str
    created_by_id: int
    created_by_name: str
    assigned_to_id: int | None = None
    assigned_to_name: str | None = None
    created_at: datetime
    updated_at: datetime


class StudyGroupSummary(BaseModel):
    """Represents `StudyGroupSummary` in the PassDown backend."""
    id: int
    name: str
    description: str | None = None
    course_code: str | None = None
    owner_id: int
    owner_name: str
    owner_email: str
    member_count: int
    resource_count: int
    is_owner: bool
    my_permissions: dict[str, bool]
    created_at: datetime


class StudyGroupDetail(StudyGroupSummary):
    """Represents `StudyGroupDetail` in the PassDown backend."""
    members: list[GroupMemberRead]
    resources: list[GroupResourceRead]
