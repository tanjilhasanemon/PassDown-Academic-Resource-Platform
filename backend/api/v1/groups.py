"""Groups — FastAPI HTTP Router (ECB Boundary Layer)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Security, status
from sqlalchemy.orm import Session

from core.audit import record_audit
from core.database import get_db
from core.rbac import GroupPermission, assert_group_permission, get_membership
from dependencies.auth import get_current_user
from models.app_user import AppUser
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupResource
from schemas.group import (
    GroupMemberAdd,
    GroupMemberRead,
    GroupMemberUpdate,
    GroupResourceCreate,
    GroupResourceRead,
    GroupResourceUpdate,
    StudyGroupCreate,
    StudyGroupDetail,
    StudyGroupSummary,
    StudyGroupUpdate,
)

router = APIRouter(prefix="/groups", tags=["Study Groups"])


def _get_group_or_404(db: Session, group_id: int) -> StudyGroup:
    """Executes `get group or 404` operation."""
    group = db.query(StudyGroup).filter(StudyGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study group not found")
    return group


def _build_summary(db: Session, group: StudyGroup, current_user: AppUser) -> StudyGroupSummary:
    """Executes `build summary` operation."""
    owner = db.query(AppUser).filter(AppUser.id == group.owner_id).first()
    member_count = db.query(StudyGroupMember).filter(StudyGroupMember.group_id == group.id).count()
    resource_count = db.query(StudyGroupResource).filter(StudyGroupResource.group_id == group.id).count()
    is_owner = group.owner_id == current_user.id
    membership = get_membership(db, group.id, current_user.id)
    perms = {
        "can_create": is_owner or bool(membership and membership.can_create),
        "can_edit": is_owner or bool(membership and membership.can_edit),
        "can_assign": is_owner or bool(membership and membership.can_assign),
    }
    return StudyGroupSummary(
        id=group.id,
        name=group.name,
        description=group.description,
        course_code=group.course_code,
        owner_id=group.owner_id,
        owner_name=owner.name if owner else "Unknown",
        owner_email=owner.email if owner else "",
        member_count=member_count,
        resource_count=resource_count,
        is_owner=is_owner,
        my_permissions=perms,
        created_at=group.created_at,
    )


def _build_detail(db: Session, group: StudyGroup, current_user: AppUser) -> StudyGroupDetail:
    """Executes `build detail` operation."""
    summary = _build_summary(db, group, current_user)
    member_rows = (
        db.query(StudyGroupMember, AppUser)
        .join(AppUser, StudyGroupMember.user_id == AppUser.id)
        .filter(StudyGroupMember.group_id == group.id)
        .order_by(StudyGroupMember.added_at.asc())
        .all()
    )
    members = [
        GroupMemberRead(
            id=m.id,
            user_id=u.id,
            name=u.name,
            email=u.email,
            can_create=m.can_create,
            can_edit=m.can_edit,
            can_assign=m.can_assign,
            added_at=m.added_at,
        )
        for m, u in member_rows
    ]

    res_rows = (
        db.query(StudyGroupResource)
        .filter(StudyGroupResource.group_id == group.id)
        .order_by(StudyGroupResource.created_at.desc())
        .all()
    )
    user_ids = {r.created_by_id for r in res_rows} | {r.assigned_to_id for r in res_rows if r.assigned_to_id}
    users_map = {
        u.id: u.name for u in db.query(AppUser).filter(AppUser.id.in_(user_ids)).all()
    } if user_ids else {}

    resources = [
        GroupResourceRead(
            id=r.id,
            group_id=r.group_id,
            title=r.title,
            url=r.url,
            resource_type=r.resource_type,
            notes=r.notes,
            status=r.status,
            created_by_id=r.created_by_id,
            created_by_name=users_map.get(r.created_by_id, "Unknown"),
            assigned_to_id=r.assigned_to_id,
            assigned_to_name=users_map.get(r.assigned_to_id) if r.assigned_to_id else None,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in res_rows
    ]

    return StudyGroupDetail(**summary.model_dump(), members=members, resources=resources)


@router.get("", response_model=list[StudyGroupSummary])
def list_my_groups(
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:read"]),
) -> list[StudyGroupSummary]:
    """Executes `list my groups` operation."""
    from sqlalchemy import func

    if current_user.role == "admin":
        groups = db.query(StudyGroup).order_by(StudyGroup.created_at.desc()).all()
    else:
        member_group_ids = [
            row[0]
            for row in db.query(StudyGroupMember.group_id)
            .filter(StudyGroupMember.user_id == current_user.id)
            .all()
        ]
        groups = (
            db.query(StudyGroup)
            .filter(
                (StudyGroup.owner_id == current_user.id)
                | (StudyGroup.id.in_(member_group_ids))
            )
            .order_by(StudyGroup.created_at.desc())
            .all()
        )
    if not groups:
        return []

    gids = [g.id for g in groups]
    owner_ids = list({g.owner_id for g in groups})
    owners = {u.id: u for u in db.query(AppUser).filter(AppUser.id.in_(owner_ids)).all()}
    member_counts = dict(
        db.query(StudyGroupMember.group_id, func.count(StudyGroupMember.id))
        .filter(StudyGroupMember.group_id.in_(gids))
        .group_by(StudyGroupMember.group_id)
        .all()
    )
    res_counts = dict(
        db.query(StudyGroupResource.group_id, func.count(StudyGroupResource.id))
        .filter(StudyGroupResource.group_id.in_(gids))
        .group_by(StudyGroupResource.group_id)
        .all()
    )
    my_memberships = {
        m.group_id: m
        for m in db.query(StudyGroupMember)
        .filter(StudyGroupMember.group_id.in_(gids), StudyGroupMember.user_id == current_user.id)
        .all()
    }

    summaries: list[StudyGroupSummary] = []
    for g in groups:
        owner = owners.get(g.owner_id)
        is_owner = g.owner_id == current_user.id
        mem = my_memberships.get(g.id)
        summaries.append(
            StudyGroupSummary(
                id=g.id,
                name=g.name,
                description=g.description,
                course_code=g.course_code,
                owner_id=g.owner_id,
                owner_name=owner.name if owner else "Unknown",
                owner_email=owner.email if owner else "",
                member_count=int(member_counts.get(g.id, 0)),
                resource_count=int(res_counts.get(g.id, 0)),
                is_owner=is_owner,
                my_permissions={
                    "can_create": is_owner or bool(mem and mem.can_create),
                    "can_edit": is_owner or bool(mem and mem.can_edit),
                    "can_assign": is_owner or bool(mem and mem.can_assign),
                },
                created_at=g.created_at,
            )
        )
    return summaries


@router.post("", response_model=StudyGroupDetail, status_code=status.HTTP_201_CREATED)
def create_group(
    data: StudyGroupCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> StudyGroupDetail:
    """Executes `create group` operation."""
    now = datetime.now(timezone.utc)
    group = StudyGroup(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        course_code=data.course_code.strip().upper() if data.course_code else None,
        owner_id=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    record_audit(db, action="group_created", user=current_user, details=f"Created study group '{group.name}'", request=request)
    return _build_detail(db, group, current_user)


@router.get("/{group_id}", response_model=StudyGroupDetail)
def get_group_detail(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:read"]),
) -> StudyGroupDetail:
    """Executes `get group detail` operation."""
    group = _get_group_or_404(db, group_id)
    assert_group_permission(db, group, current_user, GroupPermission.VIEW, allow_admin=True)
    return _build_detail(db, group, current_user)


@router.patch("/{group_id}", response_model=StudyGroupDetail)
def update_group(
    group_id: int,
    data: StudyGroupUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> StudyGroupDetail:
    """Executes `update group` operation."""
    group = _get_group_or_404(db, group_id)
    assert_group_permission(db, group, current_user, GroupPermission.OWNER)
    if data.name is not None:
        group.name = data.name.strip()
    if data.description is not None:
        group.description = data.description.strip() or None
    if data.course_code is not None:
        group.course_code = data.course_code.strip().upper() or None
    group.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(group)
    record_audit(db, action="group_updated", user=current_user, details=f"Updated study group #{group.id} ('{group.name}')", request=request)
    return _build_detail(db, group, current_user)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> Response:
    """Executes `delete group` operation."""
    group = _get_group_or_404(db, group_id)
    assert_group_permission(db, group, current_user, GroupPermission.OWNER, allow_admin=True)
    gname = group.name
    db.delete(group)
    db.commit()
    record_audit(db, action="group_deleted", user=current_user, details=f"Deleted study group '{gname}'", request=request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{group_id}/members", response_model=StudyGroupDetail, status_code=status.HTTP_201_CREATED)
def add_group_member(
    group_id: int,
    data: GroupMemberAdd,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> StudyGroupDetail:
    """Executes `add group member` operation."""
    group = _get_group_or_404(db, group_id)
    assert_group_permission(db, group, current_user, GroupPermission.OWNER)
    target = db.query(AppUser).filter(AppUser.email == str(data.email).strip().lower()).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User with that email not found")
    if target.id == group.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner already has full permissions")

    existing = get_membership(db, group.id, target.id)
    if existing:
        existing.can_create = data.can_create
        existing.can_edit = data.can_edit
        existing.can_assign = data.can_assign
    else:
        db.add(
            StudyGroupMember(
                group_id=group.id,
                user_id=target.id,
                can_create=data.can_create,
                can_edit=data.can_edit,
                can_assign=data.can_assign,
            )
        )
    db.commit()
    record_audit(db, action="group_member_added", user=current_user, details=f"Added {target.email} to '{group.name}'", request=request)
    return _build_detail(db, group, current_user)


@router.patch("/{group_id}/members/{member_user_id}", response_model=StudyGroupDetail)
def update_group_member(
    group_id: int,
    member_user_id: int,
    data: GroupMemberUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> StudyGroupDetail:
    """Executes `update group member` operation."""
    group = _get_group_or_404(db, group_id)
    assert_group_permission(db, group, current_user, GroupPermission.OWNER)
    membership = get_membership(db, group.id, member_user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this group")
    membership.can_create = data.can_create
    membership.can_edit = data.can_edit
    membership.can_assign = data.can_assign
    db.commit()
    record_audit(db, action="group_member_updated", user=current_user, details=f"Updated permissions for user #{member_user_id} in '{group.name}'", request=request)
    return _build_detail(db, group, current_user)


@router.delete("/{group_id}/members/{member_user_id}", response_model=StudyGroupDetail)
def remove_group_member(
    group_id: int,
    member_user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> StudyGroupDetail:
    """Executes `remove group member` operation."""
    group = _get_group_or_404(db, group_id)
    assert_group_permission(db, group, current_user, GroupPermission.OWNER)
    membership = get_membership(db, group.id, member_user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this group")
    db.delete(membership)
    db.commit()
    record_audit(db, action="group_member_removed", user=current_user, details=f"Removed user #{member_user_id} from '{group.name}'", request=request)
    return _build_detail(db, group, current_user)


@router.post("/{group_id}/resources", response_model=StudyGroupDetail, status_code=status.HTTP_201_CREATED)
def add_group_resource(
    group_id: int,
    data: GroupResourceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> StudyGroupDetail:
    """Executes `add group resource` operation."""
    group = _get_group_or_404(db, group_id)
    assert_group_permission(db, group, current_user, GroupPermission.CREATE)
    if data.assigned_to_id is not None:
        assert_group_permission(db, group, current_user, GroupPermission.ASSIGN)

    now = datetime.now(timezone.utc)
    res = StudyGroupResource(
        group_id=group.id,
        title=data.title.strip(),
        url=data.url.strip(),
        resource_type=data.resource_type,
        notes=data.notes.strip() if data.notes else None,
        created_by_id=current_user.id,
        assigned_to_id=data.assigned_to_id,
        created_at=now,
        updated_at=now,
    )
    db.add(res)
    db.commit()
    record_audit(db, action="group_resource_created", user=current_user, details=f"Added '{res.title}' to '{group.name}'", request=request)
    return _build_detail(db, group, current_user)


@router.patch("/{group_id}/resources/{resource_id}", response_model=StudyGroupDetail)
def update_group_resource(
    group_id: int,
    resource_id: int,
    data: GroupResourceUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> StudyGroupDetail:
    """Executes `update group resource` operation."""
    group = _get_group_or_404(db, group_id)
    res = (
        db.query(StudyGroupResource)
        .filter(StudyGroupResource.id == resource_id, StudyGroupResource.group_id == group.id)
        .first()
    )
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group resource not found")

    if data.update_assignment:
        assert_group_permission(db, group, current_user, GroupPermission.ASSIGN)
        res.assigned_to_id = data.assigned_to_id

    if any(v is not None for v in (data.title, data.url, data.resource_type, data.notes, data.status)):
        assert_group_permission(db, group, current_user, GroupPermission.EDIT)
        if data.title is not None:
            res.title = data.title.strip()
        if data.url is not None:
            res.url = data.url.strip()
        if data.resource_type is not None:
            res.resource_type = data.resource_type
        if data.notes is not None:
            res.notes = data.notes.strip() or None
        if data.status is not None:
            res.status = data.status

    res.updated_at = datetime.now(timezone.utc)
    db.commit()
    record_audit(db, action="group_resource_updated", user=current_user, details=f"Updated '{res.title}' in '{group.name}'", request=request)
    return _build_detail(db, group, current_user)


@router.delete("/{group_id}/resources/{resource_id}", response_model=StudyGroupDetail)
def delete_group_resource(
    group_id: int,
    resource_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> StudyGroupDetail:
    """Executes `delete group resource` operation."""
    group = _get_group_or_404(db, group_id)
    assert_group_permission(db, group, current_user, GroupPermission.EDIT, allow_admin=True)
    res = (
        db.query(StudyGroupResource)
        .filter(StudyGroupResource.id == resource_id, StudyGroupResource.group_id == group.id)
        .first()
    )
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group resource not found")
    title = res.title
    db.delete(res)
    db.commit()
    record_audit(db, action="group_resource_deleted", user=current_user, details=f"Deleted '{title}' from '{group.name}'", request=request)
    return _build_detail(db, group, current_user)
