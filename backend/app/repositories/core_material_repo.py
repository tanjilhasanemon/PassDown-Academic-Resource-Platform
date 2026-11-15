"""Core Material Repository Module (ECB Entity Layer).

Provides persistence and querying operations for CoreMaterial entities,
supporting both Admin CRUD (FR-06) and Public listing/filtering (FR-05).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core_material import CoreMaterial


class CoreMaterialRepository:
    """Encapsulates SQLAlchemy persistence operations for CoreMaterial entities."""

    @staticmethod
    def get_by_id(db: Session, material_id: int) -> CoreMaterial | None:
        """Retrieves a Core Material by its primary key ID.

        Args:
            db (Session): Active SQLAlchemy database session.
            material_id (int): Unique primary key of the core material.

        Returns:
            CoreMaterial | None: Matching entity, or None if not found.
        """
        stmt = select(CoreMaterial).where(CoreMaterial.id == material_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def list_by_course(
        db: Session, course_id: int, material_type: str | None = None
    ) -> list[CoreMaterial]:
        """Lists Core Materials for a specific course, optionally filtered by type.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course whose materials are requested.
            material_type (str | None): Optional type filter (e.g., 'slides').

        Returns:
            list[CoreMaterial]: Matching materials, newest first.
        """
        stmt = select(CoreMaterial).where(CoreMaterial.course_id == course_id)
        
        if material_type and material_type != "all":
            stmt = stmt.where(CoreMaterial.type == material_type)
            
        stmt = stmt.order_by(CoreMaterial.created_at.desc(), CoreMaterial.id.desc())
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def create(
        db: Session,
        *,
        course_id: int,
        title: str,
        type: str,
        url: str,
        description: str | None,
    ) -> CoreMaterial:
        """Persists and returns a new Core Material.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course associated with the material.
            title (str): Short title describing the resource.
            type (str): Resource type (slides, notes, etc.).
            url (str): Validated HTTPS resource URL.
            description (str | None): Optional additional details.

        Returns:
            CoreMaterial: Newly created and refreshed CoreMaterial entity.
        """
        material = CoreMaterial(
            course_id=course_id,
            title=title,
            type=type,
            url=str(url),
            description=description,
        )
        db.add(material)
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def update(
        db: Session,
        material: CoreMaterial,
        *,
        title: str | None = None,
        type: str | None = None,
        url: str | None = None,
        description: str | None = None,
    ) -> CoreMaterial:
        """Updates an existing Core Material with provided non-None fields.

        Args:
            db (Session): Active SQLAlchemy database session.
            material (CoreMaterial): The entity to update.
            title (str | None): New title if provided.
            type (str | None): New type if provided.
            url (str | None): New HTTPS URL if provided.
            description (str | None): New description if provided.

        Returns:
            CoreMaterial: The updated and refreshed entity.
        """
        if title is not None:
            material.title = title.strip()
        if type is not None:
            material.type = type
        if url is not None:
            material.url = str(url)
        if description is not None:
            material.description = description.strip() if description else None

        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def delete(db: Session, material: CoreMaterial) -> None:
        """Deletes a Core Material record from the database.

        Args:
            db (Session): Active SQLAlchemy database session.
            material (CoreMaterial): The entity to delete.
        """
        db.delete(material)
        db.commit()