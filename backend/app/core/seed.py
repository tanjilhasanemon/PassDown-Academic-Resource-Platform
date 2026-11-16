"""Controlled Initial Database Seeder.

Provisions initial Admin and Student accounts alongside 8 university courses,
curated Core Materials, Approved/Pending Contributions, and Open/Fulfilled
Requests idempotently.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_STUDENT, hash_password
from app.models.contribution import Contribution
from app.models.core_material import CoreMaterial
from app.models.request import Request
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository

DEFAULT_COURSES: list[dict[str, str]] = [
    {
        "code": "CS 101",
        "title": "Introduction to Computer Science",
        "department": "CS",
        "semester_offered": "Spring 2027",
    },
    {
        "code": "CSE 203",
        "title": "Data Structures",
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
        "code": "CSE 303",
        "title": "Database Management Systems",
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
        "code": "CSE 451",
        "title": "Software Engineering",
        "department": "CSE",
        "semester_offered": "Spring 2027",
    },
    {
        "code": "EEE 131",
        "title": "Electrical Circuits I",
        "department": "EEE",
        "semester_offered": "Spring 2027",
    },
    {
        "code": "MAT 104",
        "title": "Linear Algebra & Differential Equations",
        "department": "MAT",
        "semester_offered": "Spring 2027",
    },
]


def seed_initial_data(db: Session) -> dict[str, int]:
    """Idempotently seeds default Admin/Student users, 8 courses, and sample resources.

    Args:
        db: Active SQLAlchemy database session.

    Returns:
        dict[str, int]: Summary counts of newly created users and courses.
    """
    users_created = 0
    courses_created = 0

    admin = UserRepository.get_by_email(db, "admin@iub.edu.bd")
    if not admin:
        admin = UserRepository.create(
            db,
            name="IUB Course Curator",
            email="admin@iub.edu.bd",
            password_hash=hash_password("AdminPass123!"),
            role=ROLE_ADMIN,
        )
        users_created += 1

    student = UserRepository.get_by_email(db, "2331024@iub.edu.bd")
    if not student:
        student = UserRepository.create(
            db,
            name="Tanjil Hasan Emon",
            email="2331024@iub.edu.bd",
            password_hash=hash_password("StudentPass123!"),
            role=ROLE_STUDENT,
        )
        users_created += 1

    for course_data in DEFAULT_COURSES:
        if not CourseRepository.get_by_code(db, course_data["code"]):
            CourseRepository.create(db, **course_data)
            courses_created += 1

    cse451 = CourseRepository.get_by_code(db, "CSE 451")
    cse309 = CourseRepository.get_by_code(db, "CSE 309")
    cse303 = CourseRepository.get_by_code(db, "CSE 303")

    if cse451 and student:
        existing_core = (
            db.execute(
                select(CoreMaterial).where(CoreMaterial.course_id == cse451.id)
            )
            .scalars()
            .first()
        )
        if not existing_core:
            db.add_all(
                [
                    CoreMaterial(
                        course_id=cse451.id,
                        title="Lecture 01 — Software Engineering & IEEE 830 Requirements",
                        type="slides",
                        url="https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki/SRS---Software-Requirements-Specification",
                        description="Official lecture slides covering software engineering fundamentals and requirements specification.",
                    ),
                    CoreMaterial(
                        course_id=cse451.id,
                        title="Lecture 02 — Entity-Control-Boundary Architecture & UML Modeling",
                        type="notes",
                        url="https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki/SDS---Software-Design-Specification",
                        description="Comprehensive design specification guide covering layered architecture, DFDs, and state machines.",
                    ),
                    CoreMaterial(
                        course_id=cse451.id,
                        title="Midterm & Final Examination Past Question Archive",
                        type="past_paper",
                        url="https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki",
                        description="Curated archive of past examination questions and evaluation rubrics.",
                    ),
                ]
            )
            db.commit()

        existing_contrib = (
            db.execute(
                select(Contribution).where(Contribution.course_id == cse451.id)
            )
            .scalars()
            .first()
        )
        if not existing_contrib:
            db.add_all(
                [
                    Contribution(
                        course_id=cse451.id,
                        submitted_by=student.id,
                        title="Jakob Nielsen's 10 Usability Heuristics Summary Notes",
                        type="notes",
                        url="https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki/UI-Design-and-Nielsen-Heuristics",
                        description="Concise study guide on applying usability heuristics to web interfaces.",
                        status="approved",
                    ),
                    Contribution(
                        course_id=cse451.id,
                        submitted_by=student.id,
                        title="Pytest & FastAPI TestClient Integration Handbook",
                        type="slides",
                        url="https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki/Unit-Testing-Documentation-(Pytest)",
                        description="Walkthrough of unit and integration testing patterns (awaiting moderator review).",
                        status="pending",
                    ),
                ]
            )
            db.commit()

        existing_req = (
            db.execute(select(Request).where(Request.course_id == cse451.id))
            .scalars()
            .first()
        )
        if not existing_req:
            db.add_all(
                [
                    Request(
                        course_id=cse451.id,
                        submitted_by=student.id,
                        description="Looking for worked examples of DFD Level 0, Level 1, and Level 2 decomposition.",
                        status="open",
                    ),
                    Request(
                        course_id=cse451.id,
                        submitted_by=student.id,
                        description="Need sample acceptance criteria templates for user story verification.",
                        status="fulfilled",
                    ),
                ]
            )
            db.commit()

    if cse309 and student:
        existing_cse309 = (
            db.execute(
                select(CoreMaterial).where(CoreMaterial.course_id == cse309.id)
            )
            .scalars()
            .first()
        )
        if not existing_cse309:
            db.add_all(
                [
                    CoreMaterial(
                        course_id=cse309.id,
                        title="React + TypeScript + FastAPI Full-Stack Architecture Notes",
                        type="notes",
                        url="https://react.dev/learn/typescript",
                        description="Reference guide for building type-safe SPA clients backed by REST APIs.",
                    ),
                    CoreMaterial(
                        course_id=cse309.id,
                        title="HTTP, OAuth2 Bearer JWT & REST API Design Slides",
                        type="slides",
                        url="https://fastapi.tiangolo.com/tutorial/security/",
                        description="Lecture deck on stateless JWT authentication and role-based scopes.",
                    ),
                ]
            )
            db.commit()

    if cse303 and student:
        existing_cse303 = (
            db.execute(
                select(CoreMaterial).where(CoreMaterial.course_id == cse303.id)
            )
            .scalars()
            .first()
        )
        if not existing_cse303:
            db.add(
                CoreMaterial(
                    course_id=cse303.id,
                    title="SQLAlchemy 2.0 ORM & Relational Schema Design Reference",
                    type="book",
                    url="https://docs.sqlalchemy.org/en/20/",
                    description="Core reading on relational schema design, foreign keys, and B-Tree indexing.",
                )
            )
            db.commit()

    return {"users_created": users_created, "courses_created": courses_created}
