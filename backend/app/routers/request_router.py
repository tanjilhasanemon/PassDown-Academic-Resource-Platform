"""Request Fulfillment and Deletion HTTP Router (ECB Boundary Layer)."""

from fastapi import APIRouter, Depends, Security, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SCOPE_REQUESTS_WRITE, get_current_user
from app.schemas.auth_schema import UserRead
from app.schemas.request_schema import RequestRead
from app.services.request_service import RequestService

router = APIRouter(prefix="/requests", tags=["Requests (FR-12)"])


@router.patch(
    "/{request_id}/fulfill",
    response_model=RequestRead,
    status_code=status.HTTP_200_OK,
    summary="Fulfill an owned request or an Admin-managed request (FR-12)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller is not the owner or an Admin."},
        404: {"description": "The request does not exist."},
        409: {"description": "The request is already fulfilled."},
    },
)
def fulfill_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_REQUESTS_WRITE]
    ),
) -> RequestRead:
    """Marks an open request fulfilled for its owner or an authorized Admin."""
    user = UserRead.model_validate(current_user)
    return RequestService.fulfill_request(
        db,
        request_id=request_id,
        acting_user_id=user.id,
        acting_user_role=user.role,
    )


@router.delete(
    "/{request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an owned request or an Admin-managed request (FR-12)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller is not the owner or an Admin."},
        404: {"description": "The request does not exist."},
    },
)
def delete_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_REQUESTS_WRITE]
    ),
) -> None:
    """Deletes a request without affecting its course or other resources."""
    user = UserRead.model_validate(current_user)
    RequestService.delete_request(
        db,
        request_id=request_id,
        acting_user_id=user.id,
        acting_user_role=user.role,
    )