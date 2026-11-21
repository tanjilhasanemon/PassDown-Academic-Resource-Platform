"""Centralized RBAC & fine-grained Study Group permission enforcement."""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.app_user import AppUser
from models.study_group import StudyGroup, StudyGroupMember


class GroupPermission:
    """Represents `GroupPermission` in the PassDown backend."""
    VIEW = "view"
    CREATE = "can_create"
    EDIT = "can_edit"
    ASSIGN = "can_assign"
    OWNER = "owner"


def get_membership(db: Session, group_id: int, user_id: int) -> StudyGroupMember | None:
    """Executes `get membership` operation."""
    return (
        db.query(StudyGroupMember)
        .filter(StudyGroupMember.group_id == group_id, StudyGroupMember.user_id == user_id)
        .first()
    )


def assert_group_permission(
    db: Session,
    group: StudyGroup,
    user: AppUser,
    permission: str,
    allow_admin: bool = False,
) -> StudyGroupMember | None:
    """Enforce owner-only and fine-grained member permissions on a StudyGroup."""
    if allow_admin and user.role == "admin":
        return get_membership(db, group.id, user.id)

    if group.owner_id == user.id:
        return get_membership(db, group.id, user.id)

    if permission == GroupPermission.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the study group owner can perform this action",
        )

    membership = get_membership(db, group.id, user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this study group",
        )

    if permission == GroupPermission.VIEW:
        return membership

    if not getattr(membership, permission, False):
        readable = permission.replace("can_", "")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing '{readable}' permission in this study group",
        )

    return membership
