"""Controlled Initial Database Seeder.

Provisions initial Admin and Student accounts alongside 8 university courses,
curated Core Materials, Approved/Pending Contributions, and Open/Fulfilled
Requests across all 8 courses idempotently.
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

SEED_CORE_MATERIALS: dict[str, list[dict[str, str]]] = {
    "CS 101": [
        {
            "title": "Introduction to Computing & Problem Solving Slides",
            "type": "slides",
            "url": "https://cs50.harvard.edu/x/",
            "description": "Foundational lectures on binary representation, control flow, and algorithmic thinking.",
        },
        {
            "title": "C & Python Syntax Quick Reference Sheet",
            "type": "notes",
            "url": "https://docs.python.org/3/tutorial/",
            "description": "Concise syntax notes for loops, functions, arrays, and debugging.",
        },
    ],
    "CSE 203": [
        {
            "title": "Linked Lists, Stacks, Queues & Binary Trees Lecture Deck",
            "type": "slides",
            "url": "https://visualgo.net/en",
            "description": "Visual walkthroughs of pointer manipulation, tree traversals, and hash tables.",
        },
        {
            "title": "CSE 203 Midterm Past Question Paper Bundle",
            "type": "past_paper",
            "url": "https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki",
            "description": "Worked past exam problems on complexity analysis and recursion.",
        },
    ],
    "CSE 211": [
        {
            "title": "CLRS Divide-and-Conquer, Greedy & Dynamic Programming Notes",
            "type": "notes",
            "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/",
            "description": "Complete recurrence relations, Master Theorem proofs, and DP state transitions.",
        },
        {
            "title": "Graph Algorithms (BFS, DFS, Dijkstra, MST) Reference Book",
            "type": "book",
            "url": "https://cp-algorithms.com/",
            "description": "Step-by-step shortest-path and minimum spanning tree implementations.",
        },
    ],
    "CSE 303": [
        {
            "title": "ER Modeling, Normalization (1NF–BCNF) & SQL Joins Notes",
            "type": "notes",
            "url": "https://www.postgresql.org/docs/current/tutorial.html",
            "description": "Comprehensive relational schema normalization and SQL query optimization guide.",
        },
        {
            "title": "SQLAlchemy 2.0 ORM & PostgreSQL Indexing Reference",
            "type": "book",
            "url": "https://docs.sqlalchemy.org/en/20/",
            "description": "Core reading on relational schema design, foreign keys, and B-Tree indexing.",
        },
    ],
    "CSE 309": [
        {
            "title": "FastAPI + React Full-Stack Architecture Slides (Weeks 1–6)",
            "type": "slides",
            "url": "https://fastapi.tiangolo.com/tutorial/",
            "description": "Official lecture slides covering REST APIs, Pydantic v2 validation, and React TypeScript.",
        },
        {
            "title": "HTTP Status Codes & RESTful API Design Reference Note",
            "type": "notes",
            "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status",
            "description": "Complete guide to 200, 201, 204, 401, 403, 404, 409, and 422 status codes.",
        },
    ],
    "CSE 451": [
        {
            "title": "Lecture 01 — Software Engineering & IEEE 830 Requirements",
            "type": "slides",
            "url": "https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki/SRS---Software-Requirements-Specification",
            "description": "Official lecture slides covering software engineering fundamentals and requirements specification.",
        },
        {
            "title": "Lecture 02 — Entity-Control-Boundary Architecture & UML Modeling",
            "type": "notes",
            "url": "https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki/SDS---Software-Design-Specification",
            "description": "Comprehensive design specification guide covering layered architecture, DFDs, and state machines.",
        },
        {
            "title": "Midterm & Final Examination Past Question Archive",
            "type": "past_paper",
            "url": "https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform/wiki",
            "description": "Curated archive of past examination questions and evaluation rubrics.",
        },
    ],
    "EEE 131": [
        {
            "title": "Ohm's Law, Kirchhoff's Laws & Nodal/Mesh Analysis Slides",
            "type": "slides",
            "url": "https://ocw.mit.edu/courses/6-002-circuits-and-electronics-spring-2007/",
            "description": "Introductory DC/AC circuit theorems, Thevenin/Norton equivalents, and op-amps.",
        },
    ],
    "MAT 104": [
        {
            "title": "Matrices, Eigenvalues & First-Order ODEs Formula Book",
            "type": "book",
            "url": "https://openstax.org/details/books/calculus-volume-1",
            "description": "OpenStax reference textbook with worked linear algebra and differential equation examples.",
        },
    ],
}


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

    courses_by_code = {}
    for course_data in DEFAULT_COURSES:
        course = CourseRepository.get_by_code(db, course_data["code"])
        if not course:
            course = CourseRepository.create(db, **course_data)
            courses_created += 1
        courses_by_code[course.code] = course

    for code, materials in SEED_CORE_MATERIALS.items():
        course = courses_by_code.get(code)
        if not course:
            continue
        existing_core = (
            db.execute(
                select(CoreMaterial).where(CoreMaterial.course_id == course.id)
            )
            .scalars()
            .first()
        )
        if not existing_core:
            db.add_all(
                [
                    CoreMaterial(
                        course_id=course.id,
                        title=mat["title"],
                        type=mat["type"],
                        url=mat["url"],
                        description=mat["description"],
                    )
                    for mat in materials
                ]
            )
            db.commit()

    cse451 = courses_by_code.get("CSE 451")
    cse309 = courses_by_code.get("CSE 309")

    if cse451 and student:
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
        existing_309_contrib = (
            db.execute(
                select(Contribution).where(Contribution.course_id == cse309.id)
            )
            .scalars()
            .first()
        )
        if not existing_309_contrib:
            db.add_all(
                [
                    Contribution(
                        course_id=cse309.id,
                        submitted_by=student.id,
                        title="Complete React TypeScript + Fetch Interceptor Cheat Sheet",
                        type="notes",
                        url="https://react.dev/learn/typescript",
                        description="Summary of React hooks, typed props, and in-memory JWT interceptors.",
                        status="approved",
                    ),
                    Contribution(
                        course_id=cse309.id,
                        submitted_by=student.id,
                        title="SQLAlchemy 2.0 Mapped Columns & Relationships Guide",
                        type="notes",
                        url="https://docs.sqlalchemy.org/en/20/orm/quickstart.html",
                        description="Examples of relational constraints and query optimization (pending review).",
                        status="pending",
                    ),
                ]
            )
            db.commit()

    return {"users_created": users_created, "courses_created": courses_created}
