"""API Integration Tests for FR-08: Moderate Contributions."""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_STUDENT, create_access_token
from app.models.contribution import Contribution
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository


def create_course(db_session: Session) -> int:
    """Creates a course for contribution moderation tests."""
    course = CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )
    return course.id


def create_user_headers(
    db_session: Session, *, role: str, email: str
) -> tuple[dict[str, str], int]:
    """Creates a user and returns its bearer header and ID."""
    user = UserRepository.create(
        db_session,
        name=f"{role.title()} Moderator Test",
        email=email,
        password_hash="unused-test-hash",
        role=role,
    )
    token = create_access_token(user_id=user.id, role=role)
    return {"Authorization": f"Bearer {token}"}, user.id


def submit_contribution(
    client: TestClient,
    *,
    course_id: int,
    headers: dict[str, str],
    title: str,
) -> int:
    """Submits a pending contribution and returns its generated ID."""
    response = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json={
            "title": title,
            "type": "slides",
            "url": "https://example.com/lecture-slides.pdf",
            "description": "Review these lecture slides.",
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_fr08_admin_queue_returns_pending_with_review_metadata(
    client: TestClient, db_session: Session
) -> None:
    """Admin sees only pending Contributions with course and submitter details."""
    course_id = create_course(db_session)
    student_headers, student_id = create_user_headers(
        db_session, role=ROLE_STUDENT, email="queue_submitter@iub.edu.bd"
    )
    admin_headers, _ = create_user_headers(
        db_session, role=ROLE_ADMIN, email="queue_admin@iub.edu.bd"
    )
    pending_id = submit_contribution(
        client,
        course_id=course_id,
        headers=student_headers,
        title="Pending slides",
    )
    approved_id = submit_contribution(
        client,
        course_id=course_id,
        headers=student_headers,
        title="Approved slides",
    )
    rejected_id = submit_contribution(
        client,
        course_id=course_id,
        headers=student_headers,
        title="Rejected slides",
    )
    client.patch(f"/api/v1/contributions/{approved_id}/approve", headers=admin_headers)
    client.patch(f"/api/v1/contributions/{rejected_id}/reject", headers=admin_headers)

    response = client.get("/api/v1/contributions/pending", headers=admin_headers)

    assert response.status_code == 200
    queue = response.json()
    assert [item["id"] for item in queue] == [pending_id]
    item = queue[0]
    assert item["status"] == "pending"
    assert item["course"]["id"] == course_id
    assert item["course"]["code"] == "CSE 451"
    assert item["title"] == "Pending slides"
    assert item["type"] == "slides"
    assert item["url"] == "https://example.com/lecture-slides.pdf"
    assert item["description"] == "Review these lecture slides."
    assert item["submitter"]["id"] == student_id
    assert item["submitter"]["name"] == "Student Moderator Test"
    assert item["created_at"]


def test_fr08_approval_makes_contribution_public(
    client: TestClient, db_session: Session
) -> None:
    """Approving a pending Contribution exposes it on the public course endpoint."""
    course_id = create_course(db_session)
    student_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="approved_submitter@iub.edu.bd"
    )
    admin_headers, _ = create_user_headers(
        db_session, role=ROLE_ADMIN, email="approval_admin@iub.edu.bd"
    )
    contribution_id = submit_contribution(
        client,
        course_id=course_id,
        headers=student_headers,
        title="Public after approval",
    )

    response = client.patch(
        f"/api/v1/contributions/{contribution_id}/approve",
        headers=admin_headers,
    )
    public = client.get(f"/api/v1/courses/{course_id}/contributions")

    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    assert [item["id"] for item in public.json()] == [contribution_id]
    assert public.json()[0]["status"] == "approved"
    saved = db_session.execute(
        select(Contribution).where(Contribution.id == contribution_id)
    ).scalar_one()
    assert saved.status == "approved"


def test_fr08_rejection_keeps_contribution_hidden(
    client: TestClient, db_session: Session
) -> None:
    """Rejected Contributions remain absent from public course materials."""
    course_id = create_course(db_session)
    student_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="rejected_submitter@iub.edu.bd"
    )
    admin_headers, _ = create_user_headers(
        db_session, role=ROLE_ADMIN, email="rejection_admin@iub.edu.bd"
    )
    contribution_id = submit_contribution(
        client,
        course_id=course_id,
        headers=student_headers,
        title="Hidden after rejection",
    )

    response = client.patch(
        f"/api/v1/contributions/{contribution_id}/reject",
        headers=admin_headers,
    )
    public = client.get(f"/api/v1/courses/{course_id}/contributions")

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert public.status_code == 200
    assert public.json() == []


def test_fr08_student_cannot_access_queue_or_change_status(
    client: TestClient, db_session: Session
) -> None:
    """Student calls to the queue and moderation endpoints return 403 unchanged."""
    course_id = create_course(db_session)
    student_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="student_moderation@iub.edu.bd"
    )
    submitter_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="student_own_submission@iub.edu.bd"
    )
    contribution_id = submit_contribution(
        client,
        course_id=course_id,
        headers=submitter_headers,
        title="Still pending",
    )

    queue = client.get("/api/v1/contributions/pending", headers=student_headers)
    response = client.patch(
        f"/api/v1/contributions/{contribution_id}/approve",
        headers=student_headers,
    )

    assert queue.status_code == 403
    assert response.status_code == 403
    saved = db_session.execute(
        select(Contribution).where(Contribution.id == contribution_id)
    ).scalar_one()
    assert saved.status == "pending"


def test_fr08_guest_cannot_access_queue_or_moderate(
    client: TestClient, db_session: Session
) -> None:
    """Guest calls to the moderation queue and action endpoints return 401."""
    course_id = create_course(db_session)
    student_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="guest_test_submitter@iub.edu.bd"
    )
    contribution_id = submit_contribution(
        client,
        course_id=course_id,
        headers=student_headers,
        title="Guest cannot moderate",
    )

    queue = client.get("/api/v1/contributions/pending")
    response = client.patch(f"/api/v1/contributions/{contribution_id}/reject")

    assert queue.status_code == 401
    assert response.status_code == 401
    saved = db_session.execute(
        select(Contribution).where(Contribution.id == contribution_id)
    ).scalar_one()
    assert saved.status == "pending"


def test_fr08_repeated_or_incompatible_moderation_returns_409(
    client: TestClient, db_session: Session
) -> None:
    """A decided Contribution cannot be moderated again or transition twice."""
    course_id = create_course(db_session)
    student_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="transition_submitter@iub.edu.bd"
    )
    admin_headers, _ = create_user_headers(
        db_session, role=ROLE_ADMIN, email="transition_admin@iub.edu.bd"
    )
    approved_id = submit_contribution(
        client,
        course_id=course_id,
        headers=student_headers,
        title="Cannot approve twice",
    )
    rejected_id = submit_contribution(
        client,
        course_id=course_id,
        headers=student_headers,
        title="Cannot approve after rejection",
    )
    client.patch(f"/api/v1/contributions/{approved_id}/approve", headers=admin_headers)
    client.patch(f"/api/v1/contributions/{rejected_id}/reject", headers=admin_headers)

    repeated = client.patch(
        f"/api/v1/contributions/{approved_id}/approve", headers=admin_headers
    )
    incompatible = client.patch(
        f"/api/v1/contributions/{rejected_id}/approve",
        headers=admin_headers,
    )

    assert repeated.status_code == 409
    assert "already approved" in repeated.json()["detail"]
    assert incompatible.status_code == 409
    assert "already rejected" in incompatible.json()["detail"]
    assert (
        db_session.execute(select(Contribution).where(Contribution.id == approved_id))
        .scalar_one()
        .status
        == "approved"
    )
    assert (
        db_session.execute(select(Contribution).where(Contribution.id == rejected_id))
        .scalar_one()
        .status
        == "rejected"
    )


def test_fr08_unknown_contribution_returns_404(
    client: TestClient, db_session: Session
) -> None:
    """Moderation of a missing contribution returns 404."""
    admin_headers, _ = create_user_headers(
        db_session, role=ROLE_ADMIN, email="unknown_moderation@iub.edu.bd"
    )

    response = client.patch(
        "/api/v1/contributions/99999/approve", headers=admin_headers
    )

    assert response.status_code == 404
    assert "contribution not found" in response.json()["detail"].lower()


def test_fr08_unknown_course_public_list_returns_404(client: TestClient) -> None:
    """The public contribution endpoint returns 404 for an unknown course."""
    response = client.get("/api/v1/courses/99999/contributions")

    assert response.status_code == 404
