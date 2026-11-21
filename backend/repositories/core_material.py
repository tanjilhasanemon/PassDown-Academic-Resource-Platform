"""Core Material — Data-Access Repository (ECB Entity Layer)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.core_material import CoreMaterial
from schemas.core_material import CoreMaterialCreate, CoreMaterialUpdate


class CoreMaterialRepository:
    """Represents `CoreMaterialRepository` in the PassDown backend."""
    @staticmethod
    def list_by_course(
        db: Session,
        course_id: int,
        material_type: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[CoreMaterial], int]:
        """Executes `list by course` operation."""
        stmt = select(CoreMaterial).where(CoreMaterial.course_id == course_id)
        count_stmt = (
            select(func.count())
            .select_from(CoreMaterial)
            .where(CoreMaterial.course_id == course_id)
        )

        if material_type:
            stmt = stmt.where(CoreMaterial.type == material_type)
            count_stmt = count_stmt.where(CoreMaterial.type == material_type)

        total = db.scalar(count_stmt) or 0
        items = list(
            db.scalars(
                stmt.order_by(CoreMaterial.created_at.desc(), CoreMaterial.id.desc())
                .limit(limit)
                .offset(offset)
            ).all()
        )
        return items, total

    @staticmethod
    def get_by_id(db: Session, material_id: int) -> CoreMaterial | None:
        """Executes `get by id` operation."""
        return db.get(CoreMaterial, material_id)

    @staticmethod
    def create(db: Session, course_id: int, data: CoreMaterialCreate) -> CoreMaterial:
        """Executes `create` operation."""
        material = CoreMaterial(
            course_id=course_id,
            title=data.title,
            type=data.type,
            url=data.url,
            description=data.description,
        )
        db.add(material)
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def update(
        db: Session, material: CoreMaterial, data: CoreMaterialUpdate
    ) -> CoreMaterial:
        """Executes `update` operation."""
        material.title = data.title
        material.type = data.type
        material.url = data.url
        material.description = data.description
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def delete(db: Session, material: CoreMaterial) -> None:
        """Executes `delete` operation."""
        db.delete(material)
        db.commit()
