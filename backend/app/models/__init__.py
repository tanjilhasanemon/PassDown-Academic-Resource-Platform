"""SQLAlchemy ORM Entity Models (ECB Entity Layer).

Exports the relational entities required by PassDown SRS §3.3.3.
"""

from app.models.course import Course
from app.models.user import User

__all__ = ["Course", "User"]
