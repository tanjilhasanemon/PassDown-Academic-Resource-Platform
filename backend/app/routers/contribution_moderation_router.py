"""Contribution Moderation HTTP Router (ECB Boundary Layer).

Exposes Admin-scoped FR-08 pending queue, approval, and rejection endpoints.
"""

from fastapi import APIRouter, Depends, Security, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SCOPE_CONTRIBUTIONS_MODERATE, get_current_user
from app.schemas.contribution_schema import (
    ContributionModerationRead,
    ContributionRead,
)
from app.services.contribution_service import ContributionService

router = APIRouter(prefix="/contributions", tags=["Contribution Moderation (FR-08)"])


@router.get(
    "/pending",
    response_model=list[ContributionModerationRead],
    status_code=status.HTTP_200_OK,
    summary="List pending Contributions for Admin moderation (FR-08)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks contributions:moderate permission."},
    },
)
def list_pending_contributions(
    db: Session = Depends(get_db),
    _current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_MODERATE]
    ),
) -> list[ContributionModerationRead]:
    """Returns the pending queue with course and submitter metadata."""
    return ContributionService.list_pending_contributions(db)


@router.patch(
    "/{contribution_id}/approve",
    response_model=ContributionRead,
    status_code=status.HTTP_200_OK,
    summary="Approve a pending Contribution (FR-08)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks contributions:moderate permission."},
        404: {"description": "The contribution does not exist."},
        409: {"description": "The contribution is no longer pending."},
    },
)
def approve_contribution(
    contribution_id: int,
    db: Session = Depends(get_db),
    _current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_MODERATE]
    ),
) -> ContributionRead:
    """Transitions a pending Contribution to approved."""
    return ContributionService.moderate_contribution(
        db,
        contribution_id=contribution_id,
        new_status="approved",
    )


@router.patch(
    "/{contribution_id}/reject",
    response_model=ContributionRead,
    status_code=status.HTTP_200_OK,
    summary="Reject a pending Contribution (FR-08)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks contributions:moderate permission."},
        404: {"description": "The contribution does not exist."},
        409: {"description": "The contribution is no longer pending."},
    },
)
def reject_contribution(
    contribution_id: int,
    db: Session = Depends(get_db),
    _current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_MODERATE]
    ),
) -> ContributionRead:
    """Transitions a pending Contribution to rejected."""
    return ContributionService.moderate_contribution(
        db,
        contribution_id=contribution_id,
        new_status="rejected",
    )
