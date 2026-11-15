"""Database Access Repositories (ECB Entity Layer).

Encapsulates all SQLAlchemy persistence operations so Services and Routers
remain decoupled from raw SQL queries (SRS §2.1 & NFR-09).
"""

from app.repositories.core_material_repo import CoreMaterialRepository
from app.repositories.course_repo import CourseRepository
from app.repositories.contribution_repo import ContributionRepository
from app.repositories.request_repo import RequestRepository
from app.repositories.user_repo import UserRepository

__all__ = [
    "CoreMaterialRepository",
    "ContributionRepository",
    "CourseRepository",
    "RequestRepository",
    "UserRepository",
]