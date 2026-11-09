"""Contribution Repository Module (ECB Entity Layer).

Provides persistence, moderation, and ownership queries for Contribution
entities under FR-07, FR-08, and FR-09.
"""

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.contribution import Contribution
from app.models.user import User


class ContributionRepository:
    """Encapsulates SQLAlchemy persistence operations for Contribution entities."""

    @staticmethod
    def create(
        db: Session,
        *,
        course_id: int,
        submitted_by: int,
        title: str,
        type: str,
        url: str,
        description: str | None,
    ) -> Contribution:
        """Persists and returns a new pending Contribution.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Existing course associated with the submission.
            submitted_by (int): Authenticated user's database identifier.
            title (str): Validated contribution title.
            type (str): Validated contribution type.
            url (str): Validated HTTPS resource URL.
            description (str | None): Optional validated contribution description.

        Returns:
            Contribution: Newly created and refreshed Contribution entity.
        """
        contribution = Contribution(
            course_id=course_id,
            submitted_by=submitted_by,
            title=title,
            type=type,
            url=url,
            description=description,
            status="pending",
        )
        db.add(contribution)
        db.commit()
        db.refresh(contribution)
        return contribution

    @staticmethod
    def list_pending_with_metadata(
        db: Session,
    ) -> list[tuple[Contribution, Course, User]]:
        """Lists pending Contributions with their course and submitter records.

        Args:
            db (Session): Active SQLAlchemy database session.

        Returns:
            list[tuple[Contribution, Course, User]]: Pending records in
                submission order, joined to course and submitter metadata.
        """
        stmt = (
            select(Contribution, Course, User)
            .join(Course, Contribution.course_id == Course.id)
            .join(User, Contribution.submitted_by == User.id)
            .where(Contribution.status == "pending")
            .order_by(Contribution.created_at.asc(), Contribution.id.asc())
        )
        return list(db.execute(stmt).all())

    @staticmethod
    def get_by_id(db: Session, contribution_id: int) -> Contribution | None:
        """Retrieves a Contribution by its primary key ID.

        Args:
            db (Session): Active SQLAlchemy database session.
            contribution_id (int): Unique primary key of the contribution.

        Returns:
            Contribution | None: Matching entity, or None when not found.
        """
        stmt = select(Contribution).where(Contribution.id == contribution_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def list_by_submitter(db: Session, submitted_by: int) -> list[Contribution]:
        """Lists a user's Contributions, newest first.

        Args:
            db (Session): Active SQLAlchemy database session.
            submitted_by (int): User whose Contributions are requested.

        Returns:
            list[Contribution]: The user's Contributions in reverse submission
                order.
        """
        stmt = (
            select(Contribution)
            .where(Contribution.submitted_by == submitted_by)
            .order_by(Contribution.created_at.desc(), Contribution.id.desc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def list_approved_by_course(db: Session, course_id: int) -> list[Contribution]:
        """Lists only approved Contributions belonging to a course.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Course whose public Contributions are requested.

        Returns:
            list[Contribution]: Approved Contributions in submission order.
        """
        stmt = (
            select(Contribution)
            .where(
                Contribution.course_id == course_id,
                Contribution.status == "approved",
            )
            .order_by(Contribution.created_at.desc(), Contribution.id.desc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def update_status_if_pending(
        db: Session, *, contribution_id: int, new_status: str
    ) -> Contribution | None:
        """Atomically transitions a pending Contribution to a moderation status.

        Args:
            db (Session): Active SQLAlchemy database session.
            contribution_id (int): Contribution to transition.
            new_status (str): Server-selected approved or rejected status.

        Returns:
            Contribution | None: Updated entity, or None if it was not pending.
        """
        stmt = (
            update(Contribution)
            .where(
                Contribution.id == contribution_id,
                Contribution.status == "pending",
            )
            .values(status=new_status)
            .execution_options(synchronize_session=False)
        )
        result = db.execute(stmt)
        if result.rowcount != 1:
            return None

        db.commit()
        return ContributionRepository.get_by_id(db, contribution_id)

    @staticmethod
    def update_if_pending(
        db: Session,
        *,
        contribution_id: int,
        submitted_by: int,
        title: str,
        type: str,
        url: str,
        description: str | None,
    ) -> Contribution | None:
        """Updates an owner's pending Contribution without changing its status.

        Args:
            db (Session): Active SQLAlchemy database session.
            contribution_id (int): Contribution to update.
            submitted_by (int): Owner authorized to edit the record.
            title (str): Validated contribution title.
            type (str): Validated contribution type.
            url (str): Validated HTTPS resource URL.
            description (str | None): Optional validated description.

        Returns:
            Contribution | None: Updated entity, or None if ownership or status
                no longer matches.
        """
        stmt = (
            update(Contribution)
            .where(
                Contribution.id == contribution_id,
                Contribution.submitted_by == submitted_by,
                Contribution.status == "pending",
            )
            .values(
                title=title,
                type=type,
                url=url,
                description=description,
            )
            .execution_options(synchronize_session=False)
        )
        result = db.execute(stmt)
        if result.rowcount != 1:
            return None

        db.commit()
        return ContributionRepository.get_by_id(db, contribution_id)

    @staticmethod
    def delete_by_id(
        db: Session,
        *,
        contribution_id: int,
        submitted_by: int | None = None,
        pending_only: bool = False,
    ) -> bool:
        """Deletes a Contribution, optionally restricting deletion to its owner.

        Args:
            db (Session): Active SQLAlchemy database session.
            contribution_id (int): Contribution to delete.
            submitted_by (int | None): Required owner for Student deletion.
            pending_only (bool): Whether the record must still be pending.

        Returns:
            bool: True if a record was deleted; otherwise False.
        """
        stmt = delete(Contribution).where(Contribution.id == contribution_id)
        if submitted_by is not None:
            stmt = stmt.where(Contribution.submitted_by == submitted_by)
        if pending_only:
            stmt = stmt.where(Contribution.status == "pending")

        result = db.execute(stmt)
        if result.rowcount != 1:
            return False

        db.commit()
        return True
