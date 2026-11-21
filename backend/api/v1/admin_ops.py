"""Extended Admin Operations for PassDown Final Submission (Section 2.3)."""
import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, Security, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from core.audit import record_audit
from core.database import engine, get_db
from dependencies.auth import get_current_user
from models.app_user import AppUser
from models.audit_log import AuditLog
from models.contribution import Contribution
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupResource
from models.user_session import UserSession

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


_ban_col_checked = False


def ensure_ban_reason_column() -> None:
    """Executes `ensure ban reason column` operation."""
    global _ban_col_checked
    if _ban_col_checked:
        return
    """Safely add ban_reason column on existing SQLite/PostgreSQL databases."""
    try:
        with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE app_user ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(255)"))
            else:
                cols = [r[1] for r in conn.execute(text("PRAGMA table_info(app_user)")).fetchall()]
                if "ban_reason" not in cols:
                    conn.execute(text("ALTER TABLE app_user ADD COLUMN ban_reason VARCHAR(255)"))
        _ban_col_checked = True
    except Exception:
        _ban_col_checked = True


class BanPayload(BaseModel):
    """Represents `BanPayload` in the PassDown backend."""
    is_active: bool
    reason: str | None = Field(default=None, max_length=255)


class RolePayload(BaseModel):
    """Represents `RolePayload` in the PassDown backend."""
    role: str = Field(..., pattern="^(student|admin)$")


class BulkBanPayload(BaseModel):
    """Represents `BulkBanPayload` in the PassDown backend."""
    user_ids: list[int] = Field(..., min_length=1)
    is_active: bool
    reason: str | None = Field(default=None, max_length=255)


class BulkDeletePayload(BaseModel):
    """Represents `BulkDeletePayload` in the PassDown backend."""
    ids: list[int] = Field(..., min_length=1)


@router.get("/overview-extended")
def get_extended_overview(
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["stats:read"]),
) -> dict:
    """Executes `get extended overview` operation."""
    ensure_ban_reason_column()
    since_7d = datetime.now(timezone.utc) - timedelta(days=7)
    banned_users = db.query(AppUser).filter(AppUser.is_active == False).count()  # noqa: E712
    groups_count = db.query(StudyGroup).count()
    new_users_7d = db.query(AppUser).filter(AppUser.created_at >= since_7d).count()
    new_contribs_7d = db.query(Contribution).filter(Contribution.created_at >= since_7d).count()
    new_groups_7d = db.query(StudyGroup).filter(StudyGroup.created_at >= since_7d).count()
    return {
        "banned_users": banned_users,
        "groups": groups_count,
        "new_users_7d": new_users_7d,
        "new_records_7d": new_contribs_7d + new_groups_7d,
    }


@router.get("/users/search")
def search_users(
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=15, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> dict:
    """Executes `search users` operation."""
    ensure_ban_reason_column()
    query = db.query(AppUser)
    if q and q.strip():
        pat = f"%{q.strip()}%"
        query = query.filter(or_(AppUser.name.ilike(pat), AppUser.email.ilike(pat)))
    if role in ("student", "admin"):
        query = query.filter(AppUser.role == role)
    if status_filter == "active":
        query = query.filter(AppUser.is_active == True)  # noqa: E712
    elif status_filter == "banned":
        query = query.filter(AppUser.is_active == False)  # noqa: E712

    total = query.count()
    rows = query.order_by(AppUser.id.asc()).offset(offset).limit(limit).all()
    return {
        "items": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "ban_reason": getattr(u, "ban_reason", None),
                "created_at": u.created_at,
                "updated_at": u.updated_at,
            }
            for u in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/users/export")
def export_users_csv(
    request: Request,
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> StreamingResponse:
    """Executes `export users csv` operation."""
    ensure_ban_reason_column()
    query = db.query(AppUser)
    if q and q.strip():
        pat = f"%{q.strip()}%"
        query = query.filter(or_(AppUser.name.ilike(pat), AppUser.email.ilike(pat)))
    if role in ("student", "admin"):
        query = query.filter(AppUser.role == role)
    if status_filter == "active":
        query = query.filter(AppUser.is_active == True)  # noqa: E712
    elif status_filter == "banned":
        query = query.filter(AppUser.is_active == False)  # noqa: E712

    rows = query.order_by(AppUser.id.asc()).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ID", "Name", "Email", "Role", "Status", "Ban Reason", "Created At"])
    for u in rows:
        writer.writerow([
            u.id,
            u.name,
            u.email,
            u.role,
            "Active" if u.is_active else "Banned",
            getattr(u, "ban_reason", "") or "",
            u.created_at.isoformat() if u.created_at else "",
        ])
    record_audit(db, action="csv_export", user=admin, details=f"Exported {len(rows)} users to CSV", request=request)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=passdown-users.csv"},
    )


@router.get("/users/{user_id}/detail")
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> dict:
    """Executes `get user detail` operation."""
    ensure_ban_reason_column()
    user = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    contribs = (
        db.query(Contribution)
        .filter(Contribution.author_id == user_id)
        .order_by(Contribution.created_at.desc())
        .limit(15)
        .all()
    )
    owned_groups = db.query(StudyGroup).filter(StudyGroup.owner_id == user_id).all()
    member_groups = (
        db.query(StudyGroup)
        .join(StudyGroupMember, StudyGroupMember.group_id == StudyGroup.id)
        .filter(StudyGroupMember.user_id == user_id)
        .all()
    )
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id)
        .order_by(UserSession.last_used_at.desc())
        .limit(10)
        .all()
    )
    activity = (
        db.query(AuditLog)
        .filter(or_(AuditLog.user_id == user_id, AuditLog.user_email == user.email))
        .order_by(AuditLog.created_at.desc())
        .limit(15)
        .all()
    )
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "ban_reason": getattr(user, "ban_reason", None),
            "created_at": user.created_at,
        },
        "contributions": [
            {"id": c.id, "title": c.title, "type": c.type, "status": c.status, "created_at": c.created_at}
            for c in contribs
        ],
        "groups": [
            {"id": g.id, "name": g.name, "role": "Owner"} for g in owned_groups
        ] + [
            {"id": g.id, "name": g.name, "role": "Member"} for g in member_groups
        ],
        "sessions": [
            {
                "id": s.id,
                "ip_address": s.ip_address,
                "browser": s.browser,
                "last_used_at": s.last_used_at,
                "revoked_at": s.revoked_at,
            }
            for s in sessions
        ],
        "activity": [
            {
                "id": a.id,
                "action": a.action,
                "details": a.details,
                "ip_address": a.ip_address,
                "created_at": a.created_at,
            }
            for a in activity
        ],
    }


@router.post("/users/{user_id}/ban")
def ban_or_unban_user(
    user_id: int,
    payload: BanPayload,
    request: Request,
    db: Session = Depends(get_db),
    admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> dict:
    """Executes `ban or unban user` operation."""
    ensure_ban_reason_column()
    target = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == admin.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins cannot ban themselves")
    if not payload.is_active and target.role == "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins cannot ban another admin")

    target.is_active = payload.is_active
    target.ban_reason = None if payload.is_active else (payload.reason or "Banned by administrator")
    if not payload.is_active:
        now = datetime.now(timezone.utc)
        db.query(UserSession).filter(UserSession.user_id == target.id, UserSession.revoked_at.is_(None)).update(
            {"revoked_at": now}
        )
    db.commit()
    action = "user_unbanned" if payload.is_active else "user_banned"
    detail_msg = f"{'Unbanned' if payload.is_active else 'Banned'} {target.email}"
    if target.ban_reason:
        detail_msg += f" — Reason: {target.ban_reason}"
    record_audit(db, action=action, user=admin, details=detail_msg, request=request)
    return {"id": target.id, "is_active": target.is_active, "ban_reason": target.ban_reason}


@router.patch("/users/{user_id}/role")
def change_user_role(
    user_id: int,
    payload: RolePayload,
    request: Request,
    db: Session = Depends(get_db),
    admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> dict:
    """Executes `change user role` operation."""
    target = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == admin.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins cannot change their own role")
    old_role = target.role
    target.role = payload.role
    db.commit()
    record_audit(
        db,
        action="role_changed",
        user=admin,
        details=f"Changed {target.email} role from {old_role} to {payload.role}",
        request=request,
    )
    return {"id": target.id, "role": target.role}


@router.post("/users/{user_id}/revoke-sessions")
def revoke_all_user_sessions(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> dict:
    """Executes `revoke all user sessions` operation."""
    target = db.query(AppUser).filter(AppUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    now = datetime.now(timezone.utc)
    count = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .update({"revoked_at": now})
    )
    db.commit()
    record_audit(
        db,
        action="sessions_revoked",
        user=admin,
        details=f"Revoked {count} active session(s) for {target.email}",
        request=request,
    )
    return {"revoked_count": count}


@router.post("/users/bulk-ban")
def bulk_ban_users(
    payload: BulkBanPayload,
    request: Request,
    db: Session = Depends(get_db),
    admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> dict:
    """Executes `bulk ban users` operation."""
    ensure_ban_reason_column()
    targets = db.query(AppUser).filter(AppUser.id.in_(payload.user_ids)).all()
    updated = 0
    now = datetime.now(timezone.utc)
    for t in targets:
        if t.id == admin.id:
            continue
        if not payload.is_active and t.role == "admin":
            continue
        t.is_active = payload.is_active
        t.ban_reason = None if payload.is_active else (payload.reason or "Bulk banned by administrator")
        if not payload.is_active:
            db.query(UserSession).filter(UserSession.user_id == t.id, UserSession.revoked_at.is_(None)).update(
                {"revoked_at": now}
            )
        updated += 1
    db.commit()
    record_audit(
        db,
        action="bulk_unban" if payload.is_active else "bulk_ban",
        user=admin,
        details=f"Bulk {'unbanned' if payload.is_active else 'banned'} {updated} user(s)",
        request=request,
    )
    return {"updated_count": updated}


@router.get("/contributions/export")
def export_contributions_csv(
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    course_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    admin: AppUser = Security(get_current_user, scopes=["contributions:moderate"]),
) -> StreamingResponse:
    """Executes `export contributions csv` operation."""
    query = db.query(Contribution)
    if status_filter in ("pending", "approved", "rejected"):
        query = query.filter(Contribution.status == status_filter)
    if course_id is not None:
        query = query.filter(Contribution.course_id == course_id)
    rows = query.order_by(Contribution.created_at.desc()).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ID", "Course ID", "Title", "Author", "Type", "Status", "URL", "Created At"])
    for c in rows:
        writer.writerow([
            c.id,
            c.course_id,
            c.title,
            c.author_name,
            c.type,
            c.status,
            c.url,
            c.created_at.isoformat() if c.created_at else "",
        ])
    record_audit(db, action="csv_export", user=admin, details=f"Exported {len(rows)} contributions to CSV", request=request)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=passdown-contributions.csv"},
    )


@router.post("/contributions/bulk-delete")
def bulk_delete_contributions(
    payload: BulkDeletePayload,
    request: Request,
    db: Session = Depends(get_db),
    admin: AppUser = Security(get_current_user, scopes=["contributions:moderate"]),
) -> dict:
    """Executes `bulk delete contributions` operation."""
    deleted = db.query(Contribution).filter(Contribution.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    record_audit(
        db,
        action="bulk_delete",
        user=admin,
        details=f"Bulk deleted {deleted} contribution(s)",
        request=request,
    )
    return {"deleted_count": deleted}


@router.get("/groups")
def list_all_groups_admin(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> list[dict]:
    """Executes `list all groups admin` operation."""
    query = db.query(StudyGroup)
    if q and q.strip():
        pat = f"%{q.strip()}%"
        query = query.filter(or_(StudyGroup.name.ilike(pat), StudyGroup.course_code.ilike(pat)))
    groups = query.order_by(StudyGroup.created_at.desc()).all()
    if not groups:
        return []
    gids = [g.id for g in groups]
    owner_ids = list({g.owner_id for g in groups})
    owners = {u.id: u for u in db.query(AppUser).filter(AppUser.id.in_(owner_ids)).all()}
    m_counts = dict(
        db.query(StudyGroupMember.group_id, func.count(StudyGroupMember.id))
        .filter(StudyGroupMember.group_id.in_(gids))
        .group_by(StudyGroupMember.group_id)
        .all()
    )
    r_counts = dict(
        db.query(StudyGroupResource.group_id, func.count(StudyGroupResource.id))
        .filter(StudyGroupResource.group_id.in_(gids))
        .group_by(StudyGroupResource.group_id)
        .all()
    )
    return [
        {
            "id": g.id,
            "name": g.name,
            "course_code": g.course_code,
            "owner_name": owners[g.owner_id].name if g.owner_id in owners else "Unknown",
            "owner_email": owners[g.owner_id].email if g.owner_id in owners else "",
            "member_count": int(m_counts.get(g.id, 0)) + 1,
            "resource_count": int(r_counts.get(g.id, 0)),
            "created_at": g.created_at,
        }
        for g in groups
    ]


@router.post("/groups/bulk-delete")
def bulk_delete_groups(
    payload: BulkDeletePayload,
    request: Request,
    db: Session = Depends(get_db),
    admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> dict:
    """Executes `bulk delete groups` operation."""
    deleted = db.query(StudyGroup).filter(StudyGroup.id.in_(payload.ids)).delete(synchronize_session=False)
    db.commit()
    record_audit(
        db,
        action="group_bulk_deleted",
        user=admin,
        details=f"Bulk deleted {deleted} study group(s)",
        request=request,
    )
    return {"deleted_count": deleted}
