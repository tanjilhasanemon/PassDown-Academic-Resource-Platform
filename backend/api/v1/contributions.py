"""Contributions — FastAPI HTTP Router (ECB Boundary Layer)."""
from fastapi import APIRouter, Depends, Query, Request, Response, Security, status
from sqlalchemy.orm import Session

from core.audit import record_audit
from core.database import get_db
from dependencies.auth import get_current_user
from models.app_user import AppUser
from schemas.common import ContributionStatus, MaterialType, PaginatedResponse
from schemas.contribution import (
    ContributionCreate,
    ContributionRead,
    ContributionStatusUpdate,
    ContributionUpdate,
)
from services.contribution import ContributionService

router = APIRouter(tags=["Contributions"])


@router.get(
    "/courses/{course_id}/contributions",
    response_model=PaginatedResponse[ContributionRead],
)
def list_course_contributions(
    course_id: int,
    type: MaterialType | None = Query(
        default=None,
        description="Filter approved contributions by material type",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedResponse[ContributionRead]:
    """Executes `list course contributions` operation."""
    return ContributionService.list_approved_for_course(
        db,
        course_id=course_id,
        material_type=type,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/courses/{course_id}/contributions",
    response_model=ContributionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contribution(
    course_id: int,
    data: ContributionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["contributions:write"]),
) -> ContributionRead:
    """Executes `create contribution` operation."""
    contribution = ContributionService.create_contribution(
        db, course_id=course_id, data=data, current_user=current_user
    )
    record_audit(
        db,
        action="contribution_submitted",
        user_id=current_user.id,
        user_email=current_user.email,
        details=f"{contribution.title}",
        request=request,
    )
    return ContributionRead.model_validate(contribution)


@router.get(
    "/contributions",
    response_model=PaginatedResponse[ContributionRead],
)
def list_all_contributions(
    status: ContributionStatus | None = Query(
        default=None,
        description="Filter contributions across all courses by status (pending, approved, rejected)",
    ),
    course_id: int | None = Query(
        default=None,
        description="Filter contributions by course ID",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _current_user: AppUser = Security(
        get_current_user, scopes=["contributions:moderate"]
    ),
) -> PaginatedResponse[ContributionRead]:
    """Executes `list all contributions` operation."""
    return ContributionService.list_all_contributions(
        db,
        status_filter=status,
        course_id=course_id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/contributions/{contribution_id}",
    response_model=ContributionRead,
)
def get_contribution(
    contribution_id: int,
    db: Session = Depends(get_db),
) -> ContributionRead:
    """Executes `get contribution` operation."""
    contribution = ContributionService.get_contribution(db, contribution_id)
    return ContributionRead.model_validate(contribution)


@router.put(
    "/contributions/{contribution_id}",
    response_model=ContributionRead,
)
def update_contribution(
    contribution_id: int,
    data: ContributionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["contributions:write"]),
) -> ContributionRead:
    """Executes `update contribution` operation."""
    contribution = ContributionService.update_contribution(
        db,
        contribution_id=contribution_id,
        data=data,
        current_user=current_user,
    )
    record_audit(
        db,
        action="contribution_updated",
        user_id=current_user.id,
        user_email=current_user.email,
        details=f"{contribution.title}",
        request=request,
    )
    return ContributionRead.model_validate(contribution)


@router.patch(
    "/contributions/{contribution_id}/status",
    response_model=ContributionRead,
)
def update_contribution_status(
    contribution_id: int,
    data: ContributionStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(
        get_current_user, scopes=["contributions:moderate"]
    ),
) -> ContributionRead:
    """Executes `update contribution status` operation."""
    contribution = ContributionService.update_contribution_status(
        db, contribution_id=contribution_id, data=data
    )
    record_audit(
        db,
        action=f"contribution_{data.status}",
        user_id=current_user.id,
        user_email=current_user.email,
        details=f"{contribution.title}",
        request=request,
    )
    return ContributionRead.model_validate(contribution)


@router.delete(
    "/contributions/{contribution_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_contribution(
    contribution_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: AppUser = Security(get_current_user, scopes=["contributions:write"]),
) -> Response:
    """Executes `delete contribution` operation."""
    contribution = ContributionService.get_contribution(db, contribution_id)
    title = contribution.title
    ContributionService.delete_contribution(
        db, contribution_id=contribution_id, current_user=current_user
    )
    record_audit(
        db,
        action="contribution_deleted",
        user_id=current_user.id,
        user_email=current_user.email,
        details=title,
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
