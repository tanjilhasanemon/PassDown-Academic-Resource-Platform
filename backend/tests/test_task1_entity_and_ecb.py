"""Unit Tests for Task 1: ECB Architecture Compliance & Entity Repositories.

Verifies:
1. Automated AST inspection proving Entity-Control-Boundary (ECB) layer separation
   (SRS §2.1 & NFR-09: Routers never import repositories or ORM models directly).
2. UserRepository CRUD and case-insensitive email lookup (FR-01 foundation).
3. CourseRepository listing and case-insensitive ?search= filtering (FR-03 foundation).
"""

import ast
from pathlib import Path
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN,
    ROLE_GUEST,
    ROLE_SCOPES,
    ROLE_STUDENT,
    SCOPE_CONTRIBUTIONS_MODERATE,
    SCOPE_CONTRIBUTIONS_WRITE,
    SCOPE_COURSES_WRITE,
    SCOPE_MATERIALS_WRITE,
    SCOPE_REQUESTS_WRITE,
)
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository


def test_ecb_architectural_boundary_rule() -> None:
    """Proves that Boundary routers never import Entity models/repositories directly.

    Enforces SRS §2.1 & NFR-09 (Routers -> Services -> Repositories -> Models).
    """
    routers_dir = Path(__file__).resolve().parent.parent / "app" / "routers"
    for py_file in routers_dir.glob("*.py"):
        tree = ast.parse(py_file.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                assert not node.module.startswith("app.repositories"), (
                    f"ECB Violation in {py_file.name}: Router imported "
                    f"{node.module} directly instead of going through Services."
                )
                assert not node.module.startswith("app.models"), (
                    f"ECB Violation in {py_file.name}: Router imported "
                    f"{node.module} directly instead of going through Services."
                )


def test_rbac_role_scopes_matrix() -> None:
    """Verifies that admin, student, and guest scopes match SRS §3.4."""
    assert set(ROLE_SCOPES[ROLE_ADMIN]) == {
        SCOPE_COURSES_WRITE,
        SCOPE_MATERIALS_WRITE,
        SCOPE_CONTRIBUTIONS_MODERATE,
        SCOPE_CONTRIBUTIONS_WRITE,
        SCOPE_REQUESTS_WRITE,
    }
    assert ROLE_SCOPES[ROLE_STUDENT] == [
        SCOPE_CONTRIBUTIONS_WRITE,
        SCOPE_REQUESTS_WRITE,
    ]
    assert ROLE_SCOPES[ROLE_GUEST] == []


def test_user_repository_create_and_case_insensitive_email_lookup(
    db_session: Session,
) -> None:
    """Verifies User creation and case-insensitive unique email retrieval (FR-01)."""
    created = UserRepository.create(
        db_session,
        name="Tanjil Hasan Emon",
        email="2331024@iub.edu.bd",
        password_hash="$2b$12$hashedpasswordexample",
        role=ROLE_STUDENT,
    )
    assert created.id is not None
    assert created.role == ROLE_STUDENT

    fetched_upper = UserRepository.get_by_email(db_session, "2331024@IUB.EDU.BD")
    assert fetched_upper is not None
    assert fetched_upper.id == created.id
    assert fetched_upper.name == "Tanjil Hasan Emon"

    fetched_by_id = UserRepository.get_by_id(db_session, created.id)
    assert fetched_by_id is not None
    assert fetched_by_id.email == "2331024@iub.edu.bd"


def test_course_repository_list_and_search_by_code_or_title(
    db_session: Session,
) -> None:
    """Verifies Course creation, ordering, and ?search= filtering (FR-03)."""
    CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )
    CourseRepository.create(
        db_session,
        code="CSE 303",
        title="Database Management Systems",
        department="CSE",
        semester_offered="Spring 2027",
    )

    all_courses = CourseRepository.list_courses(db_session)
    assert len(all_courses) == 2
    assert [c.code for c in all_courses] == ["CSE 303", "CSE 451"]

    by_code = CourseRepository.list_courses(db_session, search="451")
    assert len(by_code) == 1
    assert by_code[0].title == "Software Engineering"

    by_title = CourseRepository.list_courses(db_session, search="database")
    assert len(by_title) == 1
    assert by_title[0].code == "CSE 303"

    exact_code = CourseRepository.get_by_code(db_session, "cse 451")
    assert exact_code is not None
    assert exact_code.id == by_code[0].id
