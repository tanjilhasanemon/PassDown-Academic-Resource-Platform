"""Stats — Data-Access Repository (ECB Entity Layer)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.app_user import AppUser
from models.contribution import Contribution
from models.core_material import CoreMaterial
from models.course import Course
from models.request import MaterialRequest
from schemas.stats import (
    ContributionStatusCounts,
    PlatformStatsRead,
    RequestStatusCounts,
    UserSummaryRead,
)


class StatsRepository:
    """Represents `StatsRepository` in the PassDown backend."""
    @staticmethod
    def get_user_summary(db: Session, user_id: int) -> UserSummaryRead:
        """Executes `get user summary` operation."""
        contrib_rows = db.execute(
            select(Contribution.status, func.count())
            .where(Contribution.author_id == user_id)
            .group_by(Contribution.status)
        ).all()
        contrib_map = {str(status): int(count) for status, count in contrib_rows}

        req_rows = db.execute(
            select(MaterialRequest.status, func.count())
            .where(MaterialRequest.author_id == user_id)
            .group_by(MaterialRequest.status)
        ).all()
        req_map = {str(status): int(count) for status, count in req_rows}

        return UserSummaryRead(
            contributions=ContributionStatusCounts(
                pending=contrib_map.get("pending", 0),
                approved=contrib_map.get("approved", 0),
                rejected=contrib_map.get("rejected", 0),
            ),
            requests=RequestStatusCounts(
                open=req_map.get("open", 0),
                fulfilled=req_map.get("fulfilled", 0),
            ),
        )

    @staticmethod
    def get_platform_stats(db: Session) -> PlatformStatsRead:
        """Executes `get platform stats` operation."""
        users_count = db.scalar(select(func.count()).select_from(AppUser)) or 0
        courses_count = db.scalar(select(func.count()).select_from(Course)) or 0
        materials_count = (
            db.scalar(select(func.count()).select_from(CoreMaterial)) or 0
        )

        contrib_rows = db.execute(
            select(Contribution.status, func.count()).group_by(Contribution.status)
        ).all()
        contrib_map = {str(status): int(count) for status, count in contrib_rows}

        req_rows = db.execute(
            select(MaterialRequest.status, func.count()).group_by(MaterialRequest.status)
        ).all()
        req_map = {str(status): int(count) for status, count in req_rows}

        return PlatformStatsRead(
            users=int(users_count),
            courses=int(courses_count),
            core_materials=int(materials_count),
            contributions=ContributionStatusCounts(
                pending=contrib_map.get("pending", 0),
                approved=contrib_map.get("approved", 0),
                rejected=contrib_map.get("rejected", 0),
            ),
            requests=RequestStatusCounts(
                open=req_map.get("open", 0),
                fulfilled=req_map.get("fulfilled", 0),
            ),
        )
