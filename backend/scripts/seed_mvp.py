import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.database import Base, SessionLocal, engine
from models.app_user import AppUser
from models.contribution import Contribution
from models.core_material import CoreMaterial
from models.course import Course
from models.request import MaterialRequest
from scripts.seed_admin import seed_admin_user, seed_demo_student


def seed_mvp_data(db: Session) -> bool:
    """Seed realistic IUB course data if the course table is empty. Returns True if seeded."""
    existing_count = db.scalar(select(func.count()).select_from(Course)) or 0
    if existing_count > 0:
        return False

    demo_student: AppUser = seed_demo_student(db)

    cse309 = Course(
        code="CSE309",
        title="Web Applications & Internet",
        department="CSE",
        semester_offered="Autumn 2026",
    )
    cse433 = Course(
        code="CSE433",
        title="Artificial Intelligence",
        department="CSE",
        semester_offered="Autumn 2026",
    )
    cse303 = Course(
        code="CSE303",
        title="Database Management Systems",
        department="CSE",
        semester_offered="Summer 2026",
    )
    mat101 = Course(
        code="MAT101",
        title="Differential & Integral Calculus",
        department="MAT",
        semester_offered="Autumn 2026",
    )

    db.add_all([cse309, cse433, cse303, mat101])
    db.flush()

    core_materials = [
        CoreMaterial(
            course_id=cse309.id,
            title="FastAPI + React Full-Stack Architecture Slides (Weeks 1–6)",
            type="slides",
            url="https://fastapi.tiangolo.com/tutorial/",
            description="Official lecture slides covering REST APIs, Pydantic v2 validation, SQLAlchemy 2.0 ORM, and React TypeScript integration.",
        ),
        CoreMaterial(
            course_id=cse309.id,
            title="HTTP Status Codes & RESTful API Design Reference Note",
            type="notes",
            url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Status",
            description="Complete guide to 200, 201, 204, 400, 401, 403, 404, 409, 422, and 429 status codes.",
        ),
        CoreMaterial(
            course_id=cse309.id,
            title="CSE 309 Practice Problem Set & Viva Guide",
            type="past_paper",
            url="https://github.com/tanjilhasanemon/passdown/tree/main/docs",
            description="Viva checklists, CRUD request flow walkthroughs, and RBAC permission exercises.",
        ),
        CoreMaterial(
            course_id=cse433.id,
            title="AIMA: Uninformed & Heuristic Search Lecture Slides",
            type="slides",
            url="https://aima.cs.berkeley.edu/",
            description="BFS, DFS, Uniform Cost Search, A* Search, and admissibility proofs.",
        ),
        CoreMaterial(
            course_id=cse303.id,
            title="ER Modeling, Normalization (1NF–BCNF) & SQL Joins Notes",
            type="notes",
            url="https://www.postgresql.org/docs/current/tutorial.html",
            description="Comprehensive SQL and relational schema normalization study notes.",
        ),
        CoreMaterial(
            course_id=mat101.id,
            title="Limits, Continuity & Integration Techniques Formula Book",
            type="book",
            url="https://openstax.org/details/books/calculus-volume-1",
            description="OpenStax Calculus Volume 1 reference textbook with worked examples.",
        ),
    ]

    contributions = [
        Contribution(
            course_id=cse309.id,
            author_id=demo_student.id,
            author_name=demo_student.name,
            title="Complete React TypeScript + Axios Cheat Sheet",
            type="notes",
            url="https://react.dev/learn/typescript",
            description="Summary of functional hooks (useState, useEffect, useCallback), typed props, and Axios interceptors.",
            status="approved",
        ),
        Contribution(
            course_id=cse309.id,
            author_id=demo_student.id,
            author_name=demo_student.name,
            title="SQLAlchemy 2.0 Mapped Columns & Relationships Notes",
            type="notes",
            url="https://docs.sqlalchemy.org/en/20/orm/quickstart.html",
            description="Step-by-step examples of one-to-many relationships and ON DELETE CASCADE.",
            status="pending",
        ),
        Contribution(
            course_id=cse433.id,
            author_id=demo_student.id,
            author_name=demo_student.name,
            title="Solved Minimax & Alpha-Beta Pruning Past Questions",
            type="past_paper",
            url="https://inst.eecs.berkeley.edu/~cs188/",
            description="Worked solutions for game-tree pruning from previous semesters.",
            status="approved",
        ),
        Contribution(
            course_id=cse303.id,
            author_id=demo_student.id,
            author_name=demo_student.name,
            title="Indexing & Query Execution Plan Summary Slides",
            type="slides",
            url="https://use-the-index-luke.com/",
            description="B-Tree indexing guide for faster query performance.",
            status="pending",
        ),
    ]

    requests = [
        MaterialRequest(
            course_id=cse309.id,
            author_id=demo_student.id,
            author_name=demo_student.name,
            title="Looking for Spring 2026 Final Exam Postman Collection",
            description="If anyone exported their CRUD + Auth test collection for CSE 309, please share the link!",
            status="open",
        ),
        MaterialRequest(
            course_id=cse309.id,
            author_id=demo_student.id,
            author_name=demo_student.name,
            title="Need FastAPI Pydantic v2 Field Validator Examples",
            description="Specifically looking for custom URL and uppercase string validator examples.",
            status="fulfilled",
        ),
    ]

    db.add_all(core_materials)
    db.add_all(contributions)
    db.add_all(requests)
    db.commit()
    return True


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_admin_user(session)
        seed_demo_student(session)
        seeded = seed_mvp_data(session)
        if seeded:
            print("Seeded PassDown database with IUB courses, materials, contributions, and requests.")
        else:
            print("Database already contains courses; skipping seed.")


if __name__ == "__main__":
    main()
