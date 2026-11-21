"""Stats — Business Logic Service (ECB Control Layer)."""
from sqlalchemy.orm import Session

from models.app_user import AppUser
from repositories.stats import StatsRepository
from schemas.stats import PlatformStatsRead, UserSummaryRead


class StatsService:
    """Represents `StatsService` in the PassDown backend."""
    @staticmethod
    def get_my_summary(db: Session, current_user: AppUser) -> UserSummaryRead:
        """Executes `get my summary` operation."""
        return StatsRepository.get_user_summary(db, user_id=current_user.id)

    @staticmethod
    def get_platform_stats(db: Session) -> PlatformStatsRead:
        """Executes `get platform stats` operation."""
        return StatsRepository.get_platform_stats(db)
