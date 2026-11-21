"""Idempotent demo & showcase seeder for PassDown (IUB CSE 451).

Seeds (only when missing — safe to run repeatedly on every cold start):
- 9 user accounts (2 Admins + 7 Students, including the CSE 451 team)
- 11 IUB courses across CSE, MAT, BBA, PHY, and ENG (levels 100-400)
- Core materials, approved/pending contributions, and open/fulfilled requests
- 4 collaborative Study Groups with mixed member permissions and shared resources
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from core.database import SessionLocal, init_db
from core.security import hash_password
from models.app_user import AppUser
from models.contribution import Contribution
from models.core_material import CoreMaterial
from models.course import Course
from models.request import MaterialRequest
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupResource

DEMO_USERS = [
    ("PassDown Admin", "admin@passdown.edu", "Admin1234", "admin"),
    ("Academic Moderator", "admin2@passdown.edu", "Admin1234", "admin"),
    ("Rafiqul Islam", "student@passdown.edu", "Student1234", "student"),
    ("Sadia Rahman", "student2@passdown.edu", "Student1234", "student"),
    ("Mehedi Hasan", "student3@passdown.edu", "Student1234", "student"),
    ("Tanjil Hasan Emon", "tanjil.emon@iub.edu.bd", "Student1234", "student"),
    ("Tanjil Sarkar", "tanjil.sarkar@iub.edu.bd", "Student1234", "student"),
    ("Md Jawad Abdullah", "jawad.abdullah@iub.edu.bd", "Student1234", "student"),
    ("S M Mashraful Islam", "mashraful.islam@iub.edu.bd", "Student1234", "student"),
]

EXTRA_COURSES = [
    ("CSE451", "Software Engineering", "CSE", "Autumn 2026"),
    ("CSE315", "Design & Analysis of Algorithms", "CSE", "Autumn 2026"),
    ("CSE213", "Object Oriented Programming", "CSE", "Summer 2026"),
    ("CSE203", "Data Structures", "CSE", "Spring 2026"),
    ("BBA101", "Principles of Management", "BBA", "Autumn 2026"),
    ("PHY101", "University Physics I", "PHY", "Autumn 2026"),
    ("ENG101", "English Listening & Speaking", "ENG", "Summer 2026"),
]

EXTRA_CORE_MATERIALS = [
    (
        "CSE451",
        "IEEE 830 SRS & Software Design Specification (SDS) Guide",
        "slides",
        "https://www.iso.org/standard/72089.html",
        "Lecture deck covering functional/non-functional requirements, UML Use Case & State diagrams, and Level-0 DFDs.",
    ),
    (
        "CSE451",
        "Entity-Control-Boundary (ECB) Architecture & Pytest Testing Handbook",
        "notes",
        "https://docs.pytest.org/en/stable/getting-started.html",
        "Reference notes on layered ECB design, automated unit/integration testing, Ruff/Bandit code review, and Sphinx docs.",
    ),
    (
        "CSE315",
        "Dynamic Programming, Greedy Algorithms & Graph Shortest Paths",
        "slides",
        "https://cp-algorithms.com/",
        "Comprehensive algorithm design slides covering memoization, Dijkstra, Bellman-Ford, and MST proofs.",
    ),
    (
        "CSE213",
        "Java & TypeScript Object-Oriented Design Principles (SOLID)",
        "notes",
        "https://docs.oracle.com/javase/tutorial/java/concepts/",
        "Core OOP concepts including encapsulation, inheritance, polymorphism, interfaces, and UML class diagrams.",
    ),
    (
        "CSE203",
        "Trees, Heaps, Hash Tables & Balanced BST Visualization Notes",
        "notes",
        "https://visualgo.net/en",
        "Interactive walkthrough of pointer-based data structures, AVL rotations, and time-complexity bounds.",
    ),
    (
        "BBA101",
        "Organizational Planning, Leadership & Decision Frameworks",
        "slides",
        "https://openstax.org/details/books/principles-management",
        "Open-access lecture material covering management functions, SWOT analysis, and team coordination.",
    ),
    (
        "PHY101",
        "Newtonian Mechanics, Kinematics & Conservation Laws Formula Sheet",
        "past_paper",
        "https://openstax.org/details/books/university-physics-volume-1",
        "Compiled midterm formula sheet and worked free-body diagram practice problems.",
    ),
    (
        "ENG101",
        "Academic Presentation & Technical Communication Rubric",
        "book",
        "https://owl.purdue.edu/owl/general_writing/academic_writing/index.html",
        "Guidelines for clear technical writing, structured oral presentations, and citation standards.",
    ),
]

EXTRA_CONTRIBUTIONS = [
    (
        "CSE451",
        "tanjil.emon@iub.edu.bd",
        "Nielsen's 10 Usability Heuristics Evaluation Checklist",
        "notes",
        "https://www.nngroup.com/articles/ten-usability-heuristics/",
        "Practical UX audit checklist used during PassDown frontend usability evaluation.",
        "approved",
    ),
    (
        "CSE451",
        "tanjil.sarkar@iub.edu.bd",
        "GitHub Actions CI/CD & CodeQL Security Pipeline Notes",
        "slides",
        "https://docs.github.com/en/actions",
        "Step-by-step setup notes for automated Ruff, Bandit, Pytest, and Vite CI workflows.",
        "approved",
    ),
    (
        "CSE315",
        "jawad.abdullah@iub.edu.bd",
        "Master Theorem & Recurrence Relation Solved Practice Set",
        "past_paper",
        "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/",
        "20 worked recurrence problems for CSE315 midterm preparation.",
        "pending",
    ),
    (
        "CSE213",
        "mashraful.islam@iub.edu.bd",
        "UML Sequence & State Diagram Quick Reference",
        "notes",
        "https://www.uml-diagrams.org/",
        "Concise visual examples of state transitions and actor-boundary interactions.",
        "pending",
    ),
]

EXTRA_REQUESTS = [
    (
        "CSE451",
        "tanjil.emon@iub.edu.bd",
        "Sample Sphinx + TypeDoc HTML Documentation Screenshots",
        "Looking for clean examples of Sphinx autodoc generated from Google-style Python docstrings.",
        "fulfilled",
    ),
    (
        "CSE315",
        "student2@passdown.edu",
        "NP-Completeness Reduction Examples for Final Exam",
        "Need worked polynomial-time reduction examples (3-SAT to Clique and Vertex Cover).",
        "open",
    ),
    (
        "PHY101",
        "student3@passdown.edu",
        "Autumn 2025 Midterm Past Paper with Solutions",
        "Requesting solved past midterm questions on rotational kinematics and work-energy theorem.",
        "open",
    ),
]


def ensure_final_demo_data(db: Session | None = None) -> None:
    """Idempotently seed demo users, IUB courses, materials, requests, and study groups."""
    owns_session = db is None
    if db is None:
        init_db()
        db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # 1. Users
        users_by_email: dict[str, AppUser] = {}
        for name, email, raw_pw, role in DEMO_USERS:
            user = db.query(AppUser).filter(AppUser.email == email).first()
            if not user:
                user = AppUser(
                    name=name,
                    email=email,
                    password_hash=hash_password(raw_pw),
                    role=role,
                    is_active=True,
                )
                db.add(user)
                db.flush()
            users_by_email[email] = user

        # 2. Additional IUB Courses
        courses_by_code: dict[str, Course] = {
            c.code: c for c in db.query(Course).all()
        }
        for code, title, dept, sem in EXTRA_COURSES:
            if code not in courses_by_code:
                course = Course(
                    code=code,
                    title=title,
                    department=dept,
                    semester_offered=sem,
                )
                db.add(course)
                db.flush()
                courses_by_code[code] = course

        # 3. Core Materials (idempotent by course_id + title)
        for code, title, mat_type, url, desc in EXTRA_CORE_MATERIALS:
            course = courses_by_code.get(code)
            if not course:
                continue
            exists = (
                db.query(CoreMaterial)
                .filter(CoreMaterial.course_id == course.id, CoreMaterial.title == title)
                .first()
            )
            if not exists:
                db.add(
                    CoreMaterial(
                        course_id=course.id,
                        title=title,
                        type=mat_type,
                        url=url,
                        description=desc,
                    )
                )

        # 4. Community Contributions (idempotent by course_id + title)
        for code, author_email, title, mat_type, url, desc, status_val in EXTRA_CONTRIBUTIONS:
            course = courses_by_code.get(code)
            author = users_by_email.get(author_email)
            if not course or not author:
                continue
            exists = (
                db.query(Contribution)
                .filter(Contribution.course_id == course.id, Contribution.title == title)
                .first()
            )
            if not exists:
                db.add(
                    Contribution(
                        course_id=course.id,
                        author_id=author.id,
                        author_name=author.name,
                        title=title,
                        type=mat_type,
                        url=url,
                        description=desc,
                        status=status_val,
                    )
                )

        # 5. Material Requests (idempotent by course_id + title)
        for code, author_email, title, desc, status_val in EXTRA_REQUESTS:
            course = courses_by_code.get(code)
            author = users_by_email.get(author_email)
            if not course or not author:
                continue
            exists = (
                db.query(MaterialRequest)
                .filter(MaterialRequest.course_id == course.id, MaterialRequest.title == title)
                .first()
            )
            if not exists:
                db.add(
                    MaterialRequest(
                        course_id=course.id,
                        author_id=author.id,
                        author_name=author.name,
                        title=title,
                        description=desc,
                        status=status_val,
                    )
                )

        # 6. Study Groups (keep CSE309 group intact for RBAC tests + add 3 more groups)
        owner = users_by_email["student@passdown.edu"]
        editor = users_by_email["student2@passdown.edu"]
        assigner = users_by_email["student3@passdown.edu"]
        emon = users_by_email["tanjil.emon@iub.edu.bd"]
        sarkar = users_by_email["tanjil.sarkar@iub.edu.bd"]
        jawad = users_by_email["jawad.abdullah@iub.edu.bd"]
        mashraful = users_by_email["mashraful.islam@iub.edu.bd"]

        groups_spec = [
            (
                "CSE309 Final Defence Study Group",
                "CSE309",
                "Shared final-exam prep archive with mixed member permissions (Create/Edit vs Assign-only).",
                owner,
                [
                    (editor, True, True, False),
                    (assigner, False, False, True),
                ],
                [
                    (
                        "FastAPI JWT & Refresh Token Rotation Notes",
                        "https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/",
                        "notes",
                        "Covers 15-min access tokens, Argon2id pepper, and session revocation.",
                        "open",
                        owner,
                        editor,
                    ),
                    (
                        "SQLAlchemy 2.0 RBAC & Query Optimization Cheat Sheet",
                        "https://docs.sqlalchemy.org/en/20/orm/quickstart.html",
                        "slides",
                        "Summary of relational constraints and cascade rules.",
                        "done",
                        editor,
                        assigner,
                    ),
                ],
            ),
            (
                "CSE451 Software Engineering Project Team",
                "CSE451",
                "PassDown core engineering group coordinating SRS, SDS, Sphinx docs, CI/CD, and final submission.",
                emon,
                [
                    (sarkar, True, True, True),
                    (jawad, True, True, False),
                    (mashraful, True, False, True),
                ],
                [
                    (
                        "PassDown SRS & SDS Architecture Blueprint",
                        "https://github.com/tanjilhasanemon/PassDown-Academic-Resource-Platform",
                        "notes",
                        "UML Use Case, State, DFD Level 0, and ECB layering documentation.",
                        "done",
                        emon,
                        sarkar,
                    ),
                    (
                        "Pytest Coverage & Nielsen Usability Audit Tracker",
                        "https://docs.pytest.org/en/stable/",
                        "slides",
                        "Tracks normal, boundary, invalid, and exception test cases plus Lighthouse/WAVE audits.",
                        "open",
                        jawad,
                        mashraful,
                    ),
                ],
            ),
            (
                "CSE303 Database Systems Lab Group",
                "CSE303",
                "Peer study group for PostgreSQL schema normalization, B-Tree indexing, and SQL transactions.",
                editor,
                [
                    (owner, True, True, False),
                    (emon, True, False, True),
                ],
                [
                    (
                        "PostgreSQL Indexing & EXPLAIN ANALYZE Lab Notes",
                        "https://www.postgresql.org/docs/current/indexes.html",
                        "notes",
                        "Worked examples comparing sequential scans vs B-Tree composite indexes.",
                        "open",
                        editor,
                        owner,
                    ),
                ],
            ),
            (
                "CSE315 Algorithms Contest Prep",
                "CSE315",
                "Weekly problem-solving board for Dynamic Programming, Graph Theory, and Greedy proofs.",
                jawad,
                [
                    (sarkar, True, True, False),
                    (assigner, False, False, True),
                ],
                [
                    (
                        "Graph Algorithms & Shortest Path Problem Set",
                        "https://cp-algorithms.com/graph/dijkstra.html",
                        "past_paper",
                        "Curated Dijkstra, Floyd-Warshall, and Topological Sort practice problems.",
                        "open",
                        jawad,
                        sarkar,
                    ),
                ],
            ),
        ]

        for g_name, g_code, g_desc, g_owner, members, resources in groups_spec:
            group = db.query(StudyGroup).filter(StudyGroup.name == g_name).first()
            if not group:
                group = StudyGroup(
                    name=g_name,
                    course_code=g_code,
                    description=g_desc,
                    owner_id=g_owner.id,
                    created_at=now,
                    updated_at=now,
                )
                db.add(group)
                db.flush()

                for m_user, can_c, can_e, can_a in members:
                    db.add(
                        StudyGroupMember(
                            group_id=group.id,
                            user_id=m_user.id,
                            can_create=can_c,
                            can_edit=can_e,
                            can_assign=can_a,
                        )
                    )

                for r_title, r_url, r_type, r_notes, r_status, r_creator, r_assignee in resources:
                    db.add(
                        StudyGroupResource(
                            group_id=group.id,
                            title=r_title,
                            url=r_url,
                            resource_type=r_type,
                            notes=r_notes,
                            status=r_status,
                            created_by_id=r_creator.id,
                            assigned_to_id=r_assignee.id,
                            created_at=now,
                            updated_at=now,
                        )
                    )

        db.commit()
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    ensure_final_demo_data()
    print("Seeded 9 users, 11 courses, materials, contributions, requests, and 4 Study Groups successfully.")
