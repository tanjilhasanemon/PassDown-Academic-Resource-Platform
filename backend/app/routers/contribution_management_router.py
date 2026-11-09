"""Contribution Ownership HTTP Router (ECB Boundary Layer).

Exposes authenticated FR-09 Contribution listing, editing, and deletion.
"""

from fastapi import APIRouter, Depends, Security, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SCOPE_CONTRIBUTIONS_WRITE, get_current_user
from app.schemas.auth_schema import UserRead
from app.schemas.contribution_schema import ContributionRead, ContributionUpdate
from app.services.contribution_service import ContributionService

router = APIRouter(prefix="/contributions", tags=["Contribution Management (FR-09)"])


@router.get(
    "/mine",
    response_model=list[ContributionRead],
    status_code=status.HTTP_200_OK,
    summary="List the authenticated user's Contributions (FR-09)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks contributions:write permission."},
    },
)
def list_my_contributions(
    db: Session = Depends(get_db),
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_WRITE]
    ),
) -> list[ContributionRead]:
    """Returns the authenticated user's Contributions and their statuses."""
    user = UserRead.model_validate(current_user)
    return ContributionService.list_my_contributions(db, submitted_by=user.id)


@router.put(
    "/{contribution_id}",
    response_model=ContributionRead,
    status_code=status.HTTP_200_OK,
    summary="Edit an owned pending Contribution (FR-09)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The authenticated user does not own this Contribution."},
        404: {"description": "The Contribution does not exist."},
        409: {"description": "Only pending Contributions can be edited."},
        422: {"description": "The Contribution payload is invalid."},
    },
)
def update_own_contribution(
    contribution_id: int,
    payload: ContributionUpdate,
    db: Session = Depends(get_db),
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_WRITE]
    ),
) -> ContributionRead:
    """Updates editable fields on the authenticated user's pending Contribution."""
    user = UserRead.model_validate(current_user)
    return ContributionService.update_own_contribution(
        db,
        contribution_id=contribution_id,
        submitted_by=user.id,
        payload=payload,
    )


@router.delete(
    "/{contribution_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Withdraw an owned Contribution or delete one as Admin (FR-09)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The authenticated user does not own this Contribution."},
        404: {"description": "The Contribution does not exist."},
        409: {"description": "Only pending Contributions can be deleted by the owner."},
    },
)
def delete_contribution(
    contribution_id: int,
    db: Session = Depends(get_db),
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_WRITE]
    ),
) -> Response:
    """Deletes an owned pending Contribution or any Contribution as Admin."""
    user = UserRead.model_validate(current_user)
    ContributionService.delete_contribution(
        db,
        contribution_id=contribution_id,
        requester_id=user.id,
        requester_role=user.role,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
