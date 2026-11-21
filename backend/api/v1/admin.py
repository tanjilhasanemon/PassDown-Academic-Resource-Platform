"""Admin — FastAPI HTTP Router (ECB Boundary Layer)."""
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request, Security
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from core.audit import record_audit
from core.database import get_db
from dependencies.auth import get_current_user
from models.app_user import AppUser
from repositories.audit import AuditRepository
from repositories.user import UserRepository
from schemas.audit import (
    AuditLogRead,
    PurgeResultRead,
    SecurityOverviewRead,
)
from schemas.common import PaginatedResponse
from schemas.stats import PlatformStatsRead
from schemas.user import UserActiveUpdate, UserRead
from services.stats import StatsService
from services.user import UserService

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=PlatformStatsRead)
def get_platform_stats(
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["stats:read"]),
) -> PlatformStatsRead:
    """Executes `get platform stats` operation."""
    return StatsService.get_platform_stats(db)


@router.get("/users", response_model=PaginatedResponse[UserRead])
def list_users(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> PaginatedResponse[UserRead]:
    """Executes `list users` operation."""
    return UserService.list_users_for_admin(db, limit=limit, offset=offset)


@router.patch("/users/{user_id}/active", response_model=UserRead)
def update_user_active_status(
    user_id: int,
    data: UserActiveUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> UserRead:
    """Executes `update user active status` operation."""
    updated = UserService.set_user_active(
        db,
        target_user_id=user_id,
        data=data,
        admin_user=admin_user,
    )
    record_audit(
        db,
        action="user_activated" if data.is_active else "user_deactivated",
        user_id=admin_user.id,
        user_email=admin_user.email,
        details=f"Target: {updated.email}",
        request=request,
    )
    return UserRead.model_validate(updated)


@router.post("/users/{user_id}/unlock", response_model=UserRead)
def unlock_user_account(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> UserRead:
    """Executes `unlock user account` operation."""
    target = UserService.get_user_or_404(db, user_id)
    unlocked = UserRepository.reset_login_attempts(db, target)
    record_audit(
        db,
        action="user_unlocked",
        user_id=admin_user.id,
        user_email=admin_user.email,
        details=f"Unlocked {unlocked.email}",
        request=request,
    )
    return UserRead.model_validate(unlocked)


@router.get("/activity", response_model=PaginatedResponse[AuditLogRead])
def list_activity_logs(
    q: str | None = Query(default=None),
    user_email: str | None = Query(default=None),
    action: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    limit: int = Query(default=15, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["stats:read"]),
) -> PaginatedResponse[AuditLogRead]:
    """Executes `list activity logs` operation."""
    items, total = AuditRepository.list_activity(
        db,
        q=q,
        user_email=user_email,
        action=action,
        from_dt=from_dt,
        to_dt=to_dt,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse[AuditLogRead](
        items=[AuditLogRead.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/activity/filters")
def get_activity_filter_options(
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["stats:read"]),
) -> dict[str, list[str]]:
    """Executes `get activity filter options` operation."""
    return AuditRepository.list_distinct_filters(db)


@router.get("/activity/export")
def export_activity_csv(
    q: str | None = Query(default=None),
    user_email: str | None = Query(default=None),
    action: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["stats:read"]),
) -> StreamingResponse:
    """Executes `export activity csv` operation."""
    items, _ = AuditRepository.list_activity(
        db,
        q=q,
        user_email=user_email,
        action=action,
        from_dt=from_dt,
        to_dt=to_dt,
        limit=1000,
        offset=0,
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Time (UTC)", "User", "Action", "Details", "IP", "Browser", "Security Event"])
    for item in items:
        writer.writerow([
            item.created_at.isoformat(),
            item.user_email,
            item.action,
            item.details or "",
            item.ip_address,
            item.user_agent or "",
            "Yes" if item.is_security_event else "No",
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="passdown-activity-log.csv"'},
    )


@router.delete("/activity/purge", response_model=PurgeResultRead)
def purge_old_activity_logs(
    request: Request,
    older_than_days: int = Query(default=30, ge=0, le=3650),
    db: Session = Depends(get_db),
    admin_user: AppUser = Security(get_current_user, scopes=["users:manage"]),
) -> PurgeResultRead:
    """Executes `purge old activity logs` operation."""
    deleted_count = AuditRepository.purge_older_than(db, older_than_days=older_than_days)
    record_audit(
        db,
        action="activity_purged",
        user_id=admin_user.id,
        user_email=admin_user.email,
        details=f"Purged {deleted_count} entries older than {older_than_days} days",
        request=request,
    )
    return PurgeResultRead(deleted_count=deleted_count, older_than_days=older_than_days)


@router.get("/security", response_model=SecurityOverviewRead)
def get_security_overview(
    min_failures: int = Query(default=3, ge=1, le=50),
    hours: int = Query(default=24, ge=1, le=720),
    db: Session = Depends(get_db),
    _admin: AppUser = Security(get_current_user, scopes=["stats:read"]),
) -> SecurityOverviewRead:
    """Executes `get security overview` operation."""
    return AuditRepository.get_security_overview(
        db, min_failures=min_failures, hours=hours
    )
