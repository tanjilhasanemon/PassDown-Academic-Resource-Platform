"""Unit Tests Covering Normal Cases, Boundary Conditions, Invalid Inputs & Exceptions.

Demonstrates unit-test quality across the Control, Security, Schema, and Entity
layers by isolating pure business rules and edge cases.
"""

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN,
    ROLE_STUDENT,
    SCOPE_CONTRIBUTIONS_MODERATE,
    SCOPE_CONTRIBUTIONS_WRITE,
    SCOPE_COURSES_WRITE,
    SCOPE_MATERIALS_WRITE,
    SCOPE_REQUESTS_WRITE,
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.contribution import Contribution
from app.models.request import Request
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth_schema import UserRegisterRequest
from app.schemas.contribution_schema import ContributionCreate, ContributionUpdate
from app.schemas.core_material_schema import CoreMaterialCreate
from app.schemas.course_schema import CourseUpdate
from app.schemas.request_schema import RequestCreate
from app.services.course_service import CourseService


# ============================================================================
# 1. Normal Cases
# ============================================================================


def test_normal_password_hashing_and_verification() -> None:
    """Verifies bcrypt hashing generates a salted $2b$ hash and validates cleanly."""
    hashed = hash_password("SecurePass123!")
    assert hashed.startswith("$2b$")
    assert hashed != "SecurePass123!"
    assert verify_password("SecurePass123!", hashed) is True
    assert verify_password("WrongPass123!", hashed) is False


def test_normal_space_insensitive_course_search(db_session: Session) -> None:
    """Verifies CourseRepository matches both spaced ('CSE 451') and compact ('CSE451') queries."""
    CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )

    spaced = CourseRepository.list_courses(db_session, search="CSE 451")
    compact = CourseRepository.list_courses(db_session, search="cse451")
    assert len(spaced) == 1
    assert len(compact) == 1
    assert spaced[0].code == "CSE 451"
    assert compact[0].code == "CSE 451"


# ============================================================================
# 2. Boundary Conditions
# ============================================================================


def test_boundary_registration_name_and_password_exact_minimums() -> None:
    """Verifies exact minimum lengths (2-char name, 8-char password) pass while 1-char/7-char fail."""
    valid_min = UserRegisterRequest(
        name="Al",
        email="al@iub.edu.bd",
        password="Pass1234",
    )
    assert valid_min.name == "Al"

    with pytest.raises(ValidationError):
        UserRegisterRequest(name="A", email="a@iub.edu.bd", password="Pass1234")

    with pytest.raises(ValidationError):
        UserRegisterRequest(name="Al", email="al@iub.edu.bd", password="Pass123")


def test_boundary_contribution_description_exact_2000_vs_2001_chars() -> None:
    """Verifies exact 2000-character description succeeds and 2001-character description fails."""
    exact_limit = ContributionCreate(
        title="Boundary Notes",
        type="notes",
        url="https://example.com/notes.pdf",
        description="x" * 2000,
    )
    assert exact_limit.description is not None
    assert len(exact_limit.description) == 2000

    with pytest.raises(ValidationError):
        ContributionCreate(
            title="Boundary Notes",
            type="notes",
            url="https://example.com/notes.pdf",
            description="x" * 2001,
        )


def test_boundary_core_material_title_exact_3_vs_2_chars() -> None:
    """Verifies exact 3-character CoreMaterial title succeeds while 2-character title fails."""
    valid = CoreMaterialCreate(
        title="Lab",
        type="slides",
        url="https://example.com/lab.pdf",
    )
    assert valid.title == "Lab"

    with pytest.raises(ValidationError):
        CoreMaterialCreate(
            title="Hi",
            type="slides",
            url="https://example.com/lab.pdf",
        )


# ============================================================================
# 3. Invalid Inputs
# ============================================================================


def test_invalid_whitespace_only_inputs_rejected() -> None:
    """Verifies whitespace-only names, titles, and request descriptions are rejected."""
    with pytest.raises(ValidationError):
        UserRegisterRequest(
            name="     ",
            email="blank@iub.edu.bd",
            password="ValidPassword123!",
        )

    with pytest.raises(ValidationError):
        RequestCreate(description="   \t\n  ")

    with pytest.raises(ValidationError):
        ContributionCreate(
            title="   ",
            type="slides",
            url="https://example.com/slides.pdf",
        )


@pytest.mark.parametrize(
    "bad_url",
    [
        "http://insecure.example.com/file.pdf",
        "ftp://files.example.com/notes.pdf",
        "javascript:alert(1)",
        "not-a-url",
    ],
)
def test_invalid_non_https_urls_rejected(bad_url: str) -> None:
    """Verifies non-HTTPS and malformed URLs are rejected across resource schemas."""
    with pytest.raises(ValidationError):
        ContributionCreate(title="Bad URL", type="notes", url=bad_url)

    with pytest.raises(ValidationError):
        CoreMaterialCreate(title="Bad URL", type="notes", url=bad_url)


def test_invalid_extra_fields_forbidden_on_contribution_update() -> None:
    """Verifies ContributionUpdate forbids client attempts to inject status or submitted_by."""
    with pytest.raises(ValidationError):
        ContributionUpdate(
            title="Valid Title",
            type="notes",
            url="https://example.com/notes.pdf",
            status="approved",  # type: ignore[call-arg]
        )


# ============================================================================
# 4. Exceptional Situations
# ============================================================================


def test_exception_verify_password_handles_corrupted_hash_safely() -> None:
    """Verifies verify_password returns False safely instead of raising ValueError on bad hashes."""
    assert verify_password("AnyPassword123!", "corrupted-non-bcrypt-hash") is False


def test_exception_valid_jwt_for_deleted_user_returns_401(client: TestClient) -> None:
    """Verifies a signed JWT pointing to a non-existent user ID is rejected with 401."""
    ghost_token = create_access_token(user_id=999999, role=ROLE_STUDENT)
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {ghost_token}"},
    )
    assert response.status_code == 401
    assert "could not be found" in response.json()["detail"].lower()


def test_exception_course_deletion_blocked_by_dependent_contribution_and_request(
    db_session: Session,
) -> None:
    """Verifies CourseService.delete_course raises 409 Conflict for dependent Contributions/Requests."""
    student = UserRepository.create(
        db_session,
        name="Boundary Student",
        email="boundary_student@iub.edu.bd",
        password_hash=hash_password("StudentPass123!"),
        role=ROLE_STUDENT,
    )
    course_with_contrib = CourseRepository.create(
        db_session,
        code="CSE 410",
        title="Software Testing",
        department="CSE",
        semester_offered="Spring 2027",
    )
    db_session.add(
        Contribution(
            course_id=course_with_contrib.id,
            submitted_by=student.id,
            title="Testing Slides",
            type="slides",
            url="https://example.com/testing.pdf",
            status="pending",
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_contrib:
        CourseService.delete_course(db_session, course_with_contrib.id)
    assert exc_contrib.value.status_code == 409

    course_with_req = CourseRepository.create(
        db_session,
        code="CSE 411",
        title="Software Architecture",
        department="CSE",
        semester_offered="Spring 2027",
    )
    db_session.add(
        Request(
            course_id=course_with_req.id,
            submitted_by=student.id,
            description="Need architecture slides",
            status="open",
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_req:
        CourseService.delete_course(db_session, course_with_req.id)
    assert exc_req.value.status_code == 409


def test_exception_course_update_code_collision_raises_409(
    db_session: Session,
) -> None:
    """Verifies CourseService.update_course raises 409 Conflict when colliding with another code."""
    CourseRepository.create(
        db_session,
        code="CSE 203",
        title="Data Structures",
        department="CSE",
        semester_offered="Spring 2027",
    )
    second = CourseRepository.create(
        db_session,
        code="CSE 211",
        title="Algorithms",
        department="CSE",
        semester_offered="Spring 2027",
    )

    with pytest.raises(HTTPException) as exc_info:
        CourseService.update_course(
            db_session,
            second.id,
            CourseUpdate(code="CSE 203"),
        )
    assert exc_info.value.status_code == 409


def test_exception_admin_token_contains_all_five_scopes() -> None:
    """Verifies Admin role token carries all 5 fine-grained OAuth2 security scopes."""
    import jwt

    from app.core.config import settings

    token = create_access_token(user_id=1, role=ROLE_ADMIN)
    decoded = jwt.decode(
        token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
    )
    assert set(decoded["scopes"]) == {
        SCOPE_COURSES_WRITE,
        SCOPE_MATERIALS_WRITE,
        SCOPE_CONTRIBUTIONS_MODERATE,
        SCOPE_CONTRIBUTIONS_WRITE,
        SCOPE_REQUESTS_WRITE,
    }
