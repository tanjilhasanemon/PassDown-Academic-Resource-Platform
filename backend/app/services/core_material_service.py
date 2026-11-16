"""Core Material Service (ECB Control Layer).

Enforces business rules for PassDown SRS FR-05 (Public listing/filtering) and
FR-06 (Admin CRUD operations).
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.core_material_repo import CoreMaterialRepository
from app.repositories.course_repo import CourseRepository
from app.schemas.core_material_schema import (
    CoreMaterialCreate,
    CoreMaterialRead,
    CoreMaterialUpdate,
)


class CoreMaterialService:
    """Control-layer service orchestrating Core Material CRUD and public listing."""

    @staticmethod
    def list_public_materials(
        db: Session, course_id: int, material_type: str | None = None
    ) -> list[CoreMaterialRead]:
        """Lists Core Materials for a course, optionally filtered by type.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course whose materials are requested.
            material_type (str | None): Optional type filter.

        Raises:
            HTTPException (404): If the requested course does not exist.

        Returns:
            list[CoreMaterialRead]: Public list of matching materials.
        """
        # Verify course exists first
        if CourseRepository.get_by_id(db, course_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – cannot load materials for an unknown course.",
            )

        materials = CoreMaterialRepository.list_by_course(
            db, course_id=course_id, material_type=material_type
        )
        return [CoreMaterialRead.model_validate(m) for m in materials]

    @staticmethod
    def add_material(
        db: Session, course_id: int, payload: CoreMaterialCreate
    ) -> CoreMaterialRead:
        """Adds a new Core Material to an existing course.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Target course ID.
            payload (CoreMaterialCreate): Validated material data.

        Raises:
            HTTPException (404): If the target course does not exist.

        Returns:
            CoreMaterialRead: The newly created material.
        """
        if CourseRepository.get_by_id(db, course_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found – cannot add material to an unknown course.",
            )

        material = CoreMaterialRepository.create(
            db,
            course_id=course_id,
            title=payload.title,
            type=payload.type,
            url=str(payload.url),
            description=payload.description,
        )
        return CoreMaterialRead.model_validate(material)

    @staticmethod
    def update_material(
        db: Session, material_id: int, payload: CoreMaterialUpdate
    ) -> CoreMaterialRead:
        """Updates an existing Core Material.

        Args:
            db (Session): Active SQLAlchemy database session.
            material_id (int): The ID of the material to update.
            payload (CoreMaterialUpdate): Validated partial update data.

        Raises:
            HTTPException (404): If the material does not exist.

        Returns:
            CoreMaterialRead: The updated material.
        """
        material = CoreMaterialRepository.get_by_id(db, material_id)
        if material is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Core Material not found – the requested material does not exist.",
            )

        updated = CoreMaterialRepository.update(
            db,
            material,
            title=payload.title,
            type=payload.type,
            url=str(payload.url) if payload.url else None,
            description=payload.description,
        )
        return CoreMaterialRead.model_validate(updated)

    @staticmethod
    def delete_material(db: Session, material_id: int) -> None:
        """Deletes an existing Core Material.

        Args:
            db (Session): Active SQLAlchemy database session.
            material_id (int): The ID of the material to delete.

        Raises:
            HTTPException (404): If the material does not exist.
        """
        material = CoreMaterialRepository.get_by_id(db, material_id)
        if material is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Core Material not found – the requested material does not exist.",
            )

        CoreMaterialRepository.delete(db, material)