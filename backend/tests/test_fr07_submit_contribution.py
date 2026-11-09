"""API Integration Tests for FR-07: Submit a Contribution."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    ROLE_ADMIN,
    ROLE_GUEST,
    ROLE_STUDENT,
    create_access_token,
)
from app.models.contribution import Contribution
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository


def create_course(db_session: Session) -> int:
    """Creates a course used by contribution submission tests."""
    course = CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )
    return course.id


def create_student_headers(
    db_session: Session, *, email: str
) -> tuple[dict[str, str], int]:
    """Creates a Student and returns an authenticated header and user ID."""
    user = UserRepository.create(
        db_session,
        name="Contribution Submitter",
        email=email,
        password_hash="unused-test-hash",
        role=ROLE_STUDENT,
    )
    token = create_access_token(user_id=user.id, role=ROLE_STUDENT)
    return {"Authorization": f"Bearer {token}"}, user.id


def valid_payload() -> dict[str, str]:
    """Returns a valid contribution payload for API integration tests."""
    return {
        "title": "Lecture slides",
        "type": "slides",
        "url": "https://example.com/lecture-slides.pdf",
        "description": "Slides for the first lecture.",
    }


def test_fr07_authenticated_submission_is_pending_and_records_submitter(
    client: TestClient, db_session: Session
) -> None:
    """A Student can submit a course contribution that is persisted as pending."""
    course_id = create_course(db_session)
    headers, user_id = create_student_headers(
        db_session, email="student_contribution@iub.edu.bd"
    )
    payload = valid_payload()
    payload["status"] = "approved"

    response = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["course_id"] == course_id
    assert body["submitted_by"] == user_id
    assert body["title"] == payload["title"]
    assert body["type"] == payload["type"]
    assert body["url"] == payload["url"]
    assert body["description"] == payload["description"]
    assert body["status"] == "pending"
    assert "created_at" in body

    saved = db_session.execute(
        select(Contribution).where(Contribution.id == body["id"])
    ).scalar_one()
    assert saved.status == "pending"
    assert saved.submitted_by == user_id


@pytest.mark.parametrize(
    "invalid_field,invalid_value",
    [
        ("title", "   "),
        ("type", "video"),
        ("url", "http://example.com/resource"),
        ("url", "not a URL"),
        ("description", "x" * 2001),
    ],
)
def test_fr07_invalid_contribution_fields_are_rejected(
    client: TestClient,
    db_session: Session,
    invalid_field: str,
    invalid_value: str,
) -> None:
    """Invalid titles, types, URLs, and overlong descriptions return 422."""
    course_id = create_course(db_session)
    headers, _ = create_student_headers(
        db_session,
        email=f"invalid_{invalid_field}_{abs(hash(invalid_value))}@iub.edu.bd",
    )
    payload = valid_payload()
    payload[invalid_field] = invalid_value

    response = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 422
    assert db_session.execute(select(Contribution)).scalars().all() == []


def test_fr07_missing_required_contribution_fields_are_rejected(
    client: TestClient, db_session: Session
) -> None:
    """Missing required contribution fields return 422 and create no record."""
    course_id = create_course(db_session)
    headers, _ = create_student_headers(db_session, email="missing_fields@iub.edu.bd")

    response = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json={},
        headers=headers,
    )

    assert response.status_code == 422
    assert db_session.execute(select(Contribution)).scalars().all() == []


def test_fr07_guest_cannot_submit_contribution(
    client: TestClient, db_session: Session
) -> None:
    """A Guest receives 401 and cannot create a Contribution."""
    course_id = create_course(db_session)

    response = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json=valid_payload(),
    )

    assert response.status_code == 401
    assert db_session.execute(select(Contribution)).scalars().all() == []


def test_fr07_admin_with_write_scope_can_submit_contribution(
    client: TestClient, db_session: Session
) -> None:
    """An authorized Admin can submit a Contribution with pending status."""
    user = UserRepository.create(
        db_session,
        name="Admin Contributor",
        email="admin_contribution@iub.edu.bd",
        password_hash="unused-test-hash",
        role=ROLE_ADMIN,
    )
    token = create_access_token(user_id=user.id, role=ROLE_ADMIN)

    response = client.post(
        f"/api/v1/courses/{create_course(db_session)}/contributions",
        json=valid_payload(),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    assert response.json()["submitted_by"] == user.id
    assert response.json()["status"] == "pending"


def test_fr07_authenticated_user_without_write_scope_is_forbidden(
    client: TestClient, db_session: Session
) -> None:
    """An authenticated caller without contributions:write receives 403."""
    course_id = create_course(db_session)
    _, user_id = create_student_headers(
        db_session, email="no_contribution_scope@iub.edu.bd"
    )
    token = create_access_token(user_id=user_id, role=ROLE_GUEST)

    response = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json=valid_payload(),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert db_session.execute(select(Contribution)).scalars().all() == []


def test_fr07_description_is_optional_and_trimmed_when_provided(
    client: TestClient, db_session: Session
) -> None:
    """An omitted description is accepted; a supplied one is trimmed."""
    course_id = create_course(db_session)
    headers, _ = create_student_headers(
        db_session, email="optional_description@iub.edu.bd"
    )
    payload = valid_payload()
    payload.pop("description")

    without_description = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json=payload,
        headers=headers,
    )
    assert without_description.status_code == 201
    assert without_description.json()["description"] is None

    payload["description"] = "  Useful lecture overview  "
    with_description = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json=payload,
        headers=headers,
    )
    assert with_description.status_code == 201
    assert with_description.json()["description"] == "Useful lecture overview"


def test_fr07_nonexistent_course_is_rejected_without_record(
    client: TestClient, db_session: Session
) -> None:
    """A valid submission for an unknown course returns 404 and persists nothing."""
    headers, _ = create_student_headers(
        db_session, email="unknown_course_contribution@iub.edu.bd"
    )

    response = client.post(
        "/api/v1/courses/99999/contributions",
        json=valid_payload(),
        headers=headers,
    )

    assert response.status_code == 404
    assert db_session.execute(select(Contribution)).scalars().all() == []


def test_fr07_pending_contribution_is_not_publicly_listed(
    client: TestClient, db_session: Session
) -> None:
    """A pending contribution is not exposed by the public course endpoints."""
    course_id = create_course(db_session)
    headers, _ = create_student_headers(
        db_session, email="not_public_contribution@iub.edu.bd"
    )
    submitted = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json=valid_payload(),
        headers=headers,
    )
    assert submitted.status_code == 201
    assert submitted.json()["status"] == "pending"

    public_list = client.get("/api/v1/courses")
    public_detail = client.get(f"/api/v1/courses/{course_id}")
    public_contributions = client.get(f"/api/v1/courses/{course_id}/contributions")

    assert public_list.status_code == 200
    assert all("contributions" not in course for course in public_list.json())
    assert public_detail.status_code == 200
    assert "contributions" not in public_detail.json()
    assert public_contributions.status_code == 200
    assert public_contributions.json() == []
