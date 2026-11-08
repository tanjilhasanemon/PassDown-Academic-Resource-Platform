"""Contribution Submission HTTP Router (ECB Boundary Layer).

Exposes the authenticated FR-07 course contribution submission endpoint.
"""

from fastapi import APIRouter, Depends, Security, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SCOPE_CONTRIBUTIONS_WRITE, get_current_user
from app.schemas.auth_schema import UserRead
from app.schemas.contribution_schema import ContributionCreate, ContributionRead
from app.services.contribution_service import ContributionService

router = APIRouter(
    prefix="/courses/{course_id}/contributions",
    tags=["Contributions (FR-07)"],
)


@router.post(
    "",
    response_model=ContributionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a pending contribution for a course (FR-07)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks contributions:write permission."},
        404: {"description": "The course does not exist."},
        422: {"description": "The contribution payload is invalid."},
    },
)
def submit_course_contribution(
    course_id: int,
    payload: ContributionCreate,
    db: Session = Depends(get_db),
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_WRITE]
    ),
) -> ContributionRead:
    """Creates a pending contribution for the authenticated Student or Admin."""
    user = UserRead.model_validate(current_user)
    return ContributionService.submit_contribution(
        db,
        course_id=course_id,
        submitted_by=user.id,
        payload=payload,
    )
