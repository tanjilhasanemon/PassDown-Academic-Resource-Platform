"""Contribution Repository Module (ECB Entity Layer).

Provides database persistence operations for Contribution entities under FR-07.
"""

from sqlalchemy.orm import Session

from app.models.contribution import Contribution


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
        description: str,
    ) -> Contribution:
        """Persists and returns a new pending Contribution.

        Args:
            db (Session): Active SQLAlchemy database session.
            course_id (int): Existing course associated with the submission.
            submitted_by (int): Authenticated user's database identifier.
            title (str): Validated contribution title.
            type (str): Validated contribution type.
            url (str): Validated HTTPS resource URL.
            description (str): Validated contribution description.

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
