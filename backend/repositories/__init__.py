"""Init — Data-Access Repository (ECB Entity Layer)."""
from repositories.contribution import ContributionRepository
from repositories.core_material import CoreMaterialRepository
from repositories.course import CourseRepository
from repositories.request import RequestRepository
from repositories.stats import StatsRepository
from repositories.user import UserRepository

__all__ = [
    "CourseRepository",
    "CoreMaterialRepository",
    "ContributionRepository",
    "RequestRepository",
    "UserRepository",
    "StatsRepository",
]
