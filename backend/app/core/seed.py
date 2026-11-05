"""Controlled Database Seeder for Demo Accounts and IUB Courses (SRS §1.5 & §4.4).

Provisions the trusted Admin curator account, a sample Student account, and
baseline Independent University, Bangladesh (IUB) courses idempotently.
"""

from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_STUDENT, hash_password
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository

DEFAULT_COURSES: list[dict[str, str]] = [
    {
        "code": "CSE 451",
        "title": "Software Engineering",
        "department": "CSE",
        "semester_offered": "Spring 2027",
    },
    {
        "code": "CSE 303",
        "title": "Database Management Systems",
        "department": "CSE",
        "semester_offered": "Spring 2027",
    },
    {
        "code": "CSE 211",
        "title": "Algorithms",
        "department": "CSE",
        "semester_offered": "Spring 2027",
    },
    {
        "code": "CSE 203",
        "title": "Data Structures",
        "department": "CSE",
        "semester_offered": "Spring 2027",
    },
    {
        "code": "CSE 309",
        "title": "Web Application and Internet",
        "department": "CSE",
        "semester_offered": "Spring 2027",
    },
    {
        "code": "EEE 131",
        "title": "Electrical Circuits I",
        "department": "EEE",
        "semester_offered": "Spring 2027",
    },
]


def seed_initial_data(db: Session) -> dict[str, int]:
    """Seeds default Admin/Student accounts and IUB courses if not already present.

    Args:
        db (Session): Active SQLAlchemy database session.

    Returns:
        dict[str, int]: Counts of newly created users and courses.
    """
    created_users = 0
    created_courses = 0

    if UserRepository.get_by_email(db, "admin@iub.edu.bd") is None:
        UserRepository.create(
            db,
            name="PassDown Curator Admin",
            email="admin@iub.edu.bd",
            password_hash=hash_password("AdminPass123!"),
            role=ROLE_ADMIN,
        )
        created_users += 1

    if UserRepository.get_by_email(db, "2331024@iub.edu.bd") is None:
        UserRepository.create(
            db,
            name="Tanjil Hasan Emon",
            email="2331024@iub.edu.bd",
            password_hash=hash_password("StudentPass123!"),
            role=ROLE_STUDENT,
        )
        created_users += 1

    for item in DEFAULT_COURSES:
        if CourseRepository.get_by_code(db, item["code"]) is None:
            CourseRepository.create(
                db,
                code=item["code"],
                title=item["title"],
                department=item["department"],
                semester_offered=item["semester_offered"],
            )
            created_courses += 1

    return {"users_created": created_users, "courses_created": created_courses}
