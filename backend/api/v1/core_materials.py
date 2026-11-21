"""Core Materials — FastAPI HTTP Router (ECB Boundary Layer)."""
from fastapi import APIRouter, Depends, Query, Response, Security, status
from sqlalchemy.orm import Session

from core.database import get_db
from dependencies.auth import get_current_user
from models.app_user import AppUser
from schemas.common import MaterialType, PaginatedResponse
from schemas.core_material import (
    CoreMaterialCreate,
    CoreMaterialRead,
    CoreMaterialUpdate,
)
from services.core_material import CoreMaterialService

router = APIRouter(tags=["Core Materials"])


@router.get(
    "/courses/{course_id}/core-materials",
    response_model=PaginatedResponse[CoreMaterialRead],
)
def list_core_materials(
    course_id: int,
    type: MaterialType | None = Query(
        default=None,
        description="Filter core materials by type (slides, notes, past_paper, book, other)",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PaginatedResponse[CoreMaterialRead]:
    """Executes `list core materials` operation."""
    return CoreMaterialService.list_core_materials(
        db,
        course_id=course_id,
        material_type=type,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/courses/{course_id}/core-materials",
    response_model=CoreMaterialRead,
    status_code=status.HTTP_201_CREATED,
)
def create_core_material(
    course_id: int,
    data: CoreMaterialCreate,
    db: Session = Depends(get_db),
    _current_user: AppUser = Security(get_current_user, scopes=["materials:write"]),
) -> CoreMaterialRead:
    """Executes `create core material` operation."""
    material = CoreMaterialService.create_core_material(
        db, course_id=course_id, data=data
    )
    return CoreMaterialRead.model_validate(material)


@router.get(
    "/core-materials/{material_id}",
    response_model=CoreMaterialRead,
)
def get_core_material(
    material_id: int,
    db: Session = Depends(get_db),
) -> CoreMaterialRead:
    """Executes `get core material` operation."""
    material = CoreMaterialService.get_core_material(db, material_id)
    return CoreMaterialRead.model_validate(material)


@router.put(
    "/core-materials/{material_id}",
    response_model=CoreMaterialRead,
)
def update_core_material(
    material_id: int,
    data: CoreMaterialUpdate,
    db: Session = Depends(get_db),
    _current_user: AppUser = Security(get_current_user, scopes=["materials:write"]),
) -> CoreMaterialRead:
    """Executes `update core material` operation."""
    material = CoreMaterialService.update_core_material(
        db, material_id=material_id, data=data
    )
    return CoreMaterialRead.model_validate(material)


@router.delete(
    "/core-materials/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_core_material(
    material_id: int,
    db: Session = Depends(get_db),
    _current_user: AppUser = Security(get_current_user, scopes=["materials:write"]),
) -> Response:
    """Executes `delete core material` operation."""
    CoreMaterialService.delete_core_material(db, material_id=material_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
