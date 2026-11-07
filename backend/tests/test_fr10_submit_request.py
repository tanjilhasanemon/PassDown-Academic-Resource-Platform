"""API Integration Tests for FR-10: Submit a Resource Request."""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_STUDENT, create_access_token
from app.models.request import Request
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository


def create_course(db_session: Session) -> int:
    """Creates a course used by request submission tests."""
    course = CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )
    return course.id


def create_headers(
    db_session: Session, *, role: str, email: str
) -> tuple[dict[str, str], int]:
    """Creates a user and returns an authenticated bearer header and user ID."""
    user = UserRepository.create(
        db_session,
        name=f"{role.title()} Requester",
        email=email,
        password_hash="unused-test-hash",
        role=role,
    )
    token = create_access_token(user_id=user.id, role=role)
    return {"Authorization": f"Bearer {token}"}, user.id


def test_fr10_student_submits_open_request_for_course(
    client: TestClient, db_session: Session
) -> None:
    """Student submission persists course, submitter, description, and open status."""
    course_id = create_course(db_session)
    headers, user_id = create_headers(
        db_session, role=ROLE_STUDENT, email="student_request@iub.edu.bd"
    )

    response = client.post(
        f"/api/v1/courses/{course_id}/requests",
        json={"description": "Lecture notes for week 4"},
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {
        "id",
        "course_id",
        "submitted_by",
        "description",
        "status",
        "created_at",
    }
    assert body["course_id"] == course_id
    assert body["submitted_by"] == user_id
    assert body["description"] == "Lecture notes for week 4"
    assert body["status"] == "open"
    assert "created_at" in body
    saved_request = db_session.execute(
        select(Request).where(Request.id == body["id"])
    ).scalar_one()
    assert saved_request.course_id == course_id
    assert saved_request.submitted_by == user_id


def test_fr10_admin_with_write_scope_can_submit_request(
    client: TestClient, db_session: Session
) -> None:
    """An authorized Admin can submit a request with the same open initial status."""
    course_id = create_course(db_session)
    headers, user_id = create_headers(
        db_session, role=ROLE_ADMIN, email="admin_request@iub.edu.bd"
    )

    response = client.post(
        f"/api/v1/courses/{course_id}/requests",
        json={"description": "An accessible copy of the assigned text"},
        headers=headers,
    )

    assert response.status_code == 201
    assert response.json()["submitted_by"] == user_id
    assert response.json()["status"] == "open"


def test_fr10_guest_and_user_without_scope_are_denied_without_record(
    client: TestClient, db_session: Session
) -> None:
    """Guest and authenticated callers without requests:write cannot create rows."""
    course_id = create_course(db_session)
    guest_response = client.post(
        f"/api/v1/courses/{course_id}/requests",
        json={"description": "A resource"},
    )
    assert guest_response.status_code == 401

    _, user_id = create_headers(
        db_session, role=ROLE_STUDENT, email="no_scope@iub.edu.bd"
    )
    token_without_scope = create_access_token(user_id=user_id, role="guest")
    forbidden = client.post(
        f"/api/v1/courses/{course_id}/requests",
        json={"description": "A resource"},
        headers={"Authorization": f"Bearer {token_without_scope}"},
    )
    assert forbidden.status_code == 403
    assert db_session.execute(select(Request)).scalars().all() == []


def test_fr10_missing_or_blank_description_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    """Missing and whitespace-only descriptions return 422 and create no record."""
    course_id = create_course(db_session)
    headers, _ = create_headers(
        db_session, role=ROLE_STUDENT, email="invalid_request@iub.edu.bd"
    )
    endpoint = f"/api/v1/courses/{course_id}/requests"

    missing = client.post(endpoint, json={}, headers=headers)
    blank = client.post(endpoint, json={"description": "  \t "}, headers=headers)

    assert missing.status_code == 422
    assert blank.status_code == 422
    assert db_session.execute(select(Request)).scalars().all() == []


def test_fr10_nonexistent_course_is_rejected_without_record(
    client: TestClient, db_session: Session
) -> None:
    """A valid submission for an unknown course returns 404 and persists nothing."""
    headers, _ = create_headers(
        db_session, role=ROLE_STUDENT, email="unknown_course@iub.edu.bd"
    )

    response = client.post(
        "/api/v1/courses/99999/requests",
        json={"description": "A resource"},
        headers=headers,
    )

    assert response.status_code == 404
    assert db_session.execute(select(Request)).scalars().all() == []