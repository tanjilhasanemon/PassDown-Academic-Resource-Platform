"""Core Material — Business Logic Service (ECB Control Layer)."""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.core_material import CoreMaterial
from repositories.core_material import CoreMaterialRepository
from schemas.common import PaginatedResponse
from schemas.core_material import (
    CoreMaterialCreate,
    CoreMaterialRead,
    CoreMaterialUpdate,
)
from services.course import CourseService


class CoreMaterialService:
    """Represents `CoreMaterialService` in the PassDown backend."""
    @staticmethod
    def list_core_materials(
        db: Session,
        course_id: int,
        material_type: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> PaginatedResponse[CoreMaterialRead]:
        """Executes `list core materials` operation."""
        CourseService.get_course(db, course_id)
        items, total = CoreMaterialRepository.list_by_course(
            db,
            course_id=course_id,
            material_type=material_type,
            limit=limit,
            offset=offset,
        )
        return PaginatedResponse[CoreMaterialRead](
            items=[CoreMaterialRead.model_validate(item) for item in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def get_core_material(db: Session, material_id: int) -> CoreMaterial:
        """Executes `get core material` operation."""
        material = CoreMaterialRepository.get_by_id(db, material_id)
        if not material:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Core material not found",
            )
        return material

    @staticmethod
    def create_core_material(
        db: Session, course_id: int, data: CoreMaterialCreate
    ) -> CoreMaterial:
        """Executes `create core material` operation."""
        CourseService.get_course(db, course_id)
        return CoreMaterialRepository.create(db, course_id=course_id, data=data)

    @staticmethod
    def update_core_material(
        db: Session, material_id: int, data: CoreMaterialUpdate
    ) -> CoreMaterial:
        """Executes `update core material` operation."""
        material = CoreMaterialService.get_core_material(db, material_id)
        return CoreMaterialRepository.update(db, material=material, data=data)

    @staticmethod
    def delete_core_material(db: Session, material_id: int) -> None:
        """Executes `delete core material` operation."""
        material = CoreMaterialService.get_core_material(db, material_id)
        CoreMaterialRepository.delete(db, material=material)
