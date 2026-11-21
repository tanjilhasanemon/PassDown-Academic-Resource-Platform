"""Request — Data-Access Repository (ECB Entity Layer)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from models.app_user import AppUser
from models.request import MaterialRequest
from schemas.request import MaterialRequestCreate, MaterialRequestUpdate


class RequestRepository:
    """Represents `RequestRepository` in the PassDown backend."""
    @staticmethod
    def list_by_course(
        db: Session,
        course_id: int,
        status_filter: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[MaterialRequest], int]:
        """Executes `list by course` operation."""
        filters = [MaterialRequest.course_id == course_id]
        if status_filter:
            filters.append(MaterialRequest.status == status_filter)

        count_stmt = select(func.count()).select_from(MaterialRequest).where(*filters)
        stmt = (
            select(MaterialRequest)
            .options(joinedload(MaterialRequest.course))
            .where(*filters)
            .order_by(MaterialRequest.created_at.desc(), MaterialRequest.id.desc())
            .limit(limit)
            .offset(offset)
        )

        total = db.scalar(count_stmt) or 0
        items = list(db.scalars(stmt).all())
        return items, total

    @staticmethod
    def list_all(
        db: Session,
        status_filter: str | None = None,
        course_id: int | None = None,
        only_new_course_requests: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[MaterialRequest], int]:
        """Executes `list all` operation."""
        filters = []
        if status_filter:
            filters.append(MaterialRequest.status == status_filter)
        if course_id is not None:
            filters.append(MaterialRequest.course_id == course_id)
        if only_new_course_requests:
            filters.append(MaterialRequest.course_id.is_(None))

        count_stmt = select(func.count()).select_from(MaterialRequest)
        stmt = select(MaterialRequest).options(joinedload(MaterialRequest.course))
        if filters:
            count_stmt = count_stmt.where(*filters)
            stmt = stmt.where(*filters)

        total = db.scalar(count_stmt) or 0
        items = list(
            db.scalars(
                stmt.order_by(MaterialRequest.created_at.desc(), MaterialRequest.id.desc())
                .limit(limit)
                .offset(offset)
            ).all()
        )
        return items, total

    @staticmethod
    def list_by_author(
        db: Session,
        author_id: int,
        status_filter: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[MaterialRequest], int]:
        """Executes `list by author` operation."""
        filters = [MaterialRequest.author_id == author_id]
        if status_filter:
            filters.append(MaterialRequest.status == status_filter)

        count_stmt = select(func.count()).select_from(MaterialRequest).where(*filters)
        stmt = (
            select(MaterialRequest)
            .options(joinedload(MaterialRequest.course))
            .where(*filters)
            .order_by(MaterialRequest.created_at.desc(), MaterialRequest.id.desc())
            .limit(limit)
            .offset(offset)
        )

        total = db.scalar(count_stmt) or 0
        items = list(db.scalars(stmt).all())
        return items, total

    @staticmethod
    def get_by_id(db: Session, request_id: int) -> MaterialRequest | None:
        """Executes `get by id` operation."""
        stmt = (
            select(MaterialRequest)
            .options(joinedload(MaterialRequest.course))
            .where(MaterialRequest.id == request_id)
        )
        return db.scalar(stmt)

    @staticmethod
    def create(
        db: Session,
        course_id: int | None,
        data: MaterialRequestCreate,
        author: AppUser,
    ) -> MaterialRequest:
        """Executes `create` operation."""
        material_request = MaterialRequest(
            course_id=course_id,
            author_id=author.id,
            author_name=author.name,
            title=data.title,
            description=data.description,
            status="open",
        )
        db.add(material_request)
        db.commit()
        db.refresh(material_request)
        return RequestRepository.get_by_id(db, material_request.id) or material_request

    @staticmethod
    def update(
        db: Session,
        material_request: MaterialRequest,
        data: MaterialRequestUpdate,
    ) -> MaterialRequest:
        """Executes `update` operation."""
        material_request.title = data.title
        material_request.description = data.description
        db.commit()
        db.refresh(material_request)
        return RequestRepository.get_by_id(db, material_request.id) or material_request

    @staticmethod
    def mark_fulfilled(
        db: Session, material_request: MaterialRequest
    ) -> MaterialRequest:
        """Executes `mark fulfilled` operation."""
        material_request.status = "fulfilled"
        db.commit()
        db.refresh(material_request)
        return RequestRepository.get_by_id(db, material_request.id) or material_request

    @staticmethod
    def delete(db: Session, material_request: MaterialRequest) -> None:
        """Executes `delete` operation."""
        db.delete(material_request)
        db.commit()
