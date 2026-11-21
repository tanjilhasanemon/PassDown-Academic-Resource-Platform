"""Me — FastAPI HTTP Router (ECB Boundary Layer)."""
from fastapi import APIRouter, Depends, Query, Request, Response, Security, status
from sqlalchemy.orm import Session

from core.audit import record_audit
from core.database import get_db
from dependencies.auth import get_current_user
from models.app_user import AppUser
from schemas.auth import SessionRead
from schemas.common import ContributionStatus, PaginatedResponse, RequestStatus
from schemas.contribution import ContributionRead
from schemas.request import MaterialRequestRead
from schemas.stats import UserSummaryRead
from schemas.user import UserPasswordUpdate, UserProfileUpdate, UserRead
from services.session import SessionService
from services.stats import StatsService
from services.user import UserService

router = APIRouter(prefix="/me", tags=["Profile & Dashboard"])


@router.get("", response_model=UserRead)
def get_my_profile(
    current_user: AppUser = Security(get_current_user, scopes=["profile:read"]),
) -> UserRead:
    """Executes `get my profile` operation."""
    return UserRead.model_validate(current_user)


@router.patch("", response_model=UserRead)
def update_my_profile(
    data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> UserRead:
    """Executes `update my profile` operation."""
    updated = UserService.update_profile(db, current_user=current_user, data=data)
    return UserRead.model_validate(updated)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    request: Request,
    data: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> Response:
    """Executes `change my password` operation."""
    try:
        UserService.change_password(db, current_user=current_user, data=data)
    except Exception:
        record_audit(
            db,
            action="password_change_failed",
            user=current_user,
            details="Incorrect current password",
            request=request,
        )
        raise
    record_audit(
        db,
        action="password_changed",
        user=current_user,
        details="Password updated",
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions", response_model=list[SessionRead])
def list_my_sessions(
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:read"]),
) -> list[SessionRead]:
    """Executes `list my sessions` operation."""
    sessions = SessionService.list_user_sessions(db, current_user.id)
    return [SessionRead.model_validate(s) for s in sessions]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_my_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:write"]),
) -> Response:
    """Executes `revoke my session` operation."""
    SessionService.revoke_user_session(db, current_user.id, session_id)
    record_audit(
        db,
        action="session_revoked",
        user=current_user,
        details=f"Revoked session #{session_id}",
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/summary", response_model=UserSummaryRead)
def get_my_summary(
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:read"]),
) -> UserSummaryRead:
    """Executes `get my summary` operation."""
    return StatsService.get_my_summary(db, current_user=current_user)


@router.get("/contributions", response_model=PaginatedResponse[ContributionRead])
def list_my_contributions(
    status: ContributionStatus | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:read"]),
) -> PaginatedResponse[ContributionRead]:
    """Executes `list my contributions` operation."""
    return UserService.list_my_contributions(
        db,
        current_user=current_user,
        status_filter=status,
        limit=limit,
        offset=offset,
    )


@router.get("/requests", response_model=PaginatedResponse[MaterialRequestRead])
def list_my_requests(
    status: RequestStatus | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["profile:read"]),
) -> PaginatedResponse[MaterialRequestRead]:
    """Executes `list my requests` operation."""
    return UserService.list_my_requests(
        db,
        current_user=current_user,
        status_filter=status,
        limit=limit,
        offset=offset,
    )
