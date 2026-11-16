"""Core Material HTTP Router (ECB Boundary Layer).

Exposes public listing/filtering and Admin CRUD operations.
"""

from fastapi import APIRouter, Depends, Query, Security, status, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SCOPE_MATERIALS_WRITE, get_current_user
from app.schemas.core_material_schema import (
    CoreMaterialCreate,
    CoreMaterialRead,
    CoreMaterialUpdate,
)
from app.services.core_material_service import CoreMaterialService

router = APIRouter(tags=["Core Materials"])


# --- Public Endpoints ---
@router.get(
    "/courses/{course_id}/core-materials",
    response_model=list[CoreMaterialRead],
    status_code=status.HTTP_200_OK,
    summary="List public core materials for a course",
    responses={404: {"description": "The course does not exist."}},
)
def list_core_materials(
    course_id: int,
    material_type: str | None = Query(
        default=None,
        description="Optional filter by type (slides, notes, past_paper, book, other).",
    ),
    db: Session = Depends(get_db),
) -> list[CoreMaterialRead]:
    """Returns public core materials for a course, optionally filtered by type."""
    return CoreMaterialService.list_public_materials(
        db, course_id=course_id, material_type=material_type
    )


# --- Admin Endpoints ---
@router.post(
    "/courses/{course_id}/core-materials",
    response_model=CoreMaterialRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new core material to a course (Admin only)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks materials:write permission."},
        404: {"description": "The course does not exist."},
    },
)
def add_core_material(
    course_id: int,
    payload: CoreMaterialCreate,
    db: Session = Depends(get_db),
    _current_user: object = Security(get_current_user, scopes=[SCOPE_MATERIALS_WRITE]),
) -> CoreMaterialRead:
    """Adds a new core material. Requires Admin privileges (materials:write)."""
    return CoreMaterialService.add_material(db, course_id=course_id, payload=payload)


@router.put(
    "/core-materials/{material_id}",
    response_model=CoreMaterialRead,
    status_code=status.HTTP_200_OK,
    summary="Update an existing core material (Admin only)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks materials:write permission."},
        404: {"description": "The material does not exist."},
    },
)
def update_core_material(
    material_id: int,
    payload: CoreMaterialUpdate,
    db: Session = Depends(get_db),
    _current_user: object = Security(get_current_user, scopes=[SCOPE_MATERIALS_WRITE]),
) -> CoreMaterialRead:
    """Updates a core material's metadata. Requires Admin privileges."""
    return CoreMaterialService.update_material(db, material_id=material_id, payload=payload)


@router.delete(
    "/core-materials/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an existing core material (Admin only)",
    responses={
        401: {"description": "Authentication is required."},
        403: {"description": "The caller lacks materials:write permission."},
        404: {"description": "The material does not exist."},
    },
)
def delete_core_material(
    material_id: int,
    db: Session = Depends(get_db),
    _current_user: object = Security(get_current_user, scopes=[SCOPE_MATERIALS_WRITE]),
) -> Response:
    """Deletes a core material. Requires Admin privileges."""
    CoreMaterialService.delete_material(db, material_id=material_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)