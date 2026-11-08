"""API Integration Tests for FR-09: Manage Own Contributions."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_STUDENT, create_access_token
from app.models.contribution import Contribution
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository


def create_course(db_session: Session) -> int:
    """Creates a course for contribution management tests."""
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
        name=f"{role.title()} Contribution User",
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
    title: str = "Lecture slides",
) -> int:
    """Creates a pending Contribution and returns its ID."""
    response = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json={
            "title": title,
            "type": "slides",
            "url": "https://example.com/lecture-slides.pdf",
            "description": "Original description.",
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_fr09_owner_can_list_own_contributions_with_status(
    client: TestClient, db_session: Session
) -> None:
    """The authenticated user sees only their own Contributions."""
    course_id = create_course(db_session)
    owner_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="fr09_list_owner@iub.edu.bd"
    )
    other_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="fr09_list_other@iub.edu.bd"
    )
    own_id = submit_contribution(client, course_id=course_id, headers=owner_headers)
    other_id = submit_contribution(
        client, course_id=course_id, headers=other_headers, title="Other slides"
    )

    response = client.get("/api/v1/contributions/mine", headers=owner_headers)

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [own_id]
    assert response.json()[0]["status"] == "pending"
    assert other_id not in [item["id"] for item in response.json()]


def test_fr09_owner_can_edit_pending_contribution_and_status_stays_pending(
    client: TestClient, db_session: Session
) -> None:
    """An owner can edit validated fields without changing status or owner."""
    course_id = create_course(db_session)
    owner_headers, owner_id = create_user_headers(
        db_session, role=ROLE_STUDENT, email="fr09_edit_owner@iub.edu.bd"
    )
    contribution_id = submit_contribution(
        client, course_id=course_id, headers=owner_headers
    )

    response = client.put(
        f"/api/v1/contributions/{contribution_id}",
        json={
            "title": "  Revised lecture slides  ",
            "type": "notes",
            "url": "https://example.com/revised-notes.pdf",
            "description": "  Updated description.  ",
        },
        headers=owner_headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Revised lecture slides"
    assert response.json()["type"] == "notes"
    assert response.json()["url"] == "https://example.com/revised-notes.pdf"
    assert response.json()["description"] == "Updated description."
    assert response.json()["submitted_by"] == owner_id
    assert response.json()["status"] == "pending"
    saved = db_session.get(Contribution, contribution_id)
    assert saved is not None
    assert saved.status == "pending"
    assert saved.submitted_by == owner_id


@pytest.mark.parametrize(
    "payload",
    [
        {
            "title": "   ",
            "type": "slides",
            "url": "https://example.com/resource.pdf",
        },
        {
            "title": "Valid title",
            "type": "video",
            "url": "https://example.com/resource.pdf",
        },
        {
            "title": "Valid title",
            "type": "slides",
            "url": "http://example.com/resource.pdf",
        },
        {
            "title": "Valid title",
            "type": "slides",
            "url": "https://example.com/resource.pdf",
            "description": "x" * 2001,
        },
        {
            "title": "Valid title",
            "type": "slides",
            "url": "https://example.com/resource.pdf",
            "status": "approved",
        },
        {
            "title": "Valid title",
            "type": "slides",
            "url": "https://example.com/resource.pdf",
            "submitted_by": 999,
        },
    ],
)
def test_fr09_invalid_or_server_controlled_edit_fields_are_rejected(
    client: TestClient,
    db_session: Session,
    payload: dict[str, str],
) -> None:
    """Invalid fields and attempts to edit status or owner return 422."""
    course_id = create_course(db_session)
    owner_headers, owner_id = create_user_headers(
        db_session,
        role=ROLE_STUDENT,
        email=f"fr09_invalid_{abs(hash(str(payload)))}@iub.edu.bd",
    )
    contribution_id = submit_contribution(
        client, course_id=course_id, headers=owner_headers
    )

    response = client.put(
        f"/api/v1/contributions/{contribution_id}",
        json=payload,
        headers=owner_headers,
    )

    assert response.status_code == 422
    saved = db_session.get(Contribution, contribution_id)
    assert saved is not None
    assert saved.status == "pending"
    assert saved.submitted_by == owner_id
    assert saved.title == "Lecture slides"


def test_fr09_non_owner_cannot_edit_or_delete_contribution(
    client: TestClient, db_session: Session
) -> None:
    """A Student who does not own a record receives 403 without changes."""
    course_id = create_course(db_session)
    owner_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="fr09_nonowner_target@iub.edu.bd"
    )
    other_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="fr09_nonowner_actor@iub.edu.bd"
    )
    contribution_id = submit_contribution(
        client, course_id=course_id, headers=owner_headers
    )

    edit = client.put(
        f"/api/v1/contributions/{contribution_id}",
        json={
            "title": "Unauthorized edit",
            "type": "notes",
            "url": "https://example.com/unauthorized.pdf",
        },
        headers=other_headers,
    )
    deletion = client.delete(
        f"/api/v1/contributions/{contribution_id}", headers=other_headers
    )

    assert edit.status_code == 403
    assert deletion.status_code == 403
    saved = db_session.get(Contribution, contribution_id)
    assert saved is not None
    assert saved.title == "Lecture slides"
    assert saved.status == "pending"


@pytest.mark.parametrize("final_status", ["approved", "rejected"])
@pytest.mark.parametrize("action", ["edit", "delete"])
def test_fr09_owner_cannot_edit_or_delete_moderated_contribution(
    client: TestClient,
    db_session: Session,
    final_status: str,
    action: str,
) -> None:
    """An owner's edit and withdrawal fail with 409 after moderation."""
    course_id = create_course(db_session)
    owner_headers, _ = create_user_headers(
        db_session,
        role=ROLE_STUDENT,
        email=f"fr09_final_{final_status}_{action}@iub.edu.bd",
    )
    admin_headers, _ = create_user_headers(
        db_session,
        role=ROLE_ADMIN,
        email=f"fr09_final_admin_{final_status}_{action}@iub.edu.bd",
    )
    contribution_id = submit_contribution(
        client, course_id=course_id, headers=owner_headers
    )
    moderation_action = "approve" if final_status == "approved" else "reject"
    moderation = client.patch(
        f"/api/v1/contributions/{contribution_id}/{moderation_action}",
        headers=admin_headers,
    )
    assert moderation.status_code == 200

    if action == "edit":
        response = client.put(
            f"/api/v1/contributions/{contribution_id}",
            json={
                "title": "Late change",
                "type": "slides",
                "url": "https://example.com/late.pdf",
            },
            headers=owner_headers,
        )
    else:
        response = client.delete(
            f"/api/v1/contributions/{contribution_id}", headers=owner_headers
        )

    assert response.status_code == 409
    saved = db_session.get(Contribution, contribution_id)
    assert saved is not None
    assert saved.status == final_status


def test_fr09_owner_can_withdraw_pending_and_record_disappears(
    client: TestClient, db_session: Session
) -> None:
    """Owner withdrawal deletes the row and removes it from public and queue APIs."""
    course_id = create_course(db_session)
    owner_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="fr09_delete_owner@iub.edu.bd"
    )
    admin_headers, _ = create_user_headers(
        db_session, role=ROLE_ADMIN, email="fr09_delete_admin@iub.edu.bd"
    )
    contribution_id = submit_contribution(
        client, course_id=course_id, headers=owner_headers
    )

    response = client.delete(
        f"/api/v1/contributions/{contribution_id}", headers=owner_headers
    )
    public = client.get(f"/api/v1/courses/{course_id}/contributions")
    pending = client.get("/api/v1/contributions/pending", headers=admin_headers)

    assert response.status_code == 204
    assert db_session.get(Contribution, contribution_id) is None
    assert public.status_code == 200
    assert public.json() == []
    assert pending.status_code == 200
    assert pending.json() == []


@pytest.mark.parametrize("final_status", ["pending", "approved", "rejected"])
def test_fr09_admin_can_delete_any_contribution_status(
    client: TestClient,
    db_session: Session,
    final_status: str,
) -> None:
    """Admins may delete pending, approved, or rejected records."""
    course_id = create_course(db_session)
    owner_headers, _ = create_user_headers(
        db_session,
        role=ROLE_STUDENT,
        email=f"fr09_admin_target_{final_status}@iub.edu.bd",
    )
    admin_headers, _ = create_user_headers(
        db_session,
        role=ROLE_ADMIN,
        email=f"fr09_admin_deleter_{final_status}@iub.edu.bd",
    )
    contribution_id = submit_contribution(
        client, course_id=course_id, headers=owner_headers
    )
    if final_status != "pending":
        client.patch(
            f"/api/v1/contributions/{contribution_id}/{final_status}",
            headers=admin_headers,
        )

    response = client.delete(
        f"/api/v1/contributions/{contribution_id}", headers=admin_headers
    )
    public = client.get(f"/api/v1/courses/{course_id}/contributions")
    pending = client.get("/api/v1/contributions/pending", headers=admin_headers)

    assert response.status_code == 204
    assert db_session.get(Contribution, contribution_id) is None
    assert all(item["id"] != contribution_id for item in public.json())
    assert all(item["id"] != contribution_id for item in pending.json())


def test_fr09_guest_and_unknown_contribution_requests_are_rejected(
    client: TestClient, db_session: Session
) -> None:
    """Guests receive 401; authenticated requests for unknown IDs receive 404."""
    course_id = create_course(db_session)
    owner_headers, _ = create_user_headers(
        db_session, role=ROLE_STUDENT, email="fr09_guest_owner@iub.edu.bd"
    )
    contribution_id = submit_contribution(
        client, course_id=course_id, headers=owner_headers
    )

    assert client.get("/api/v1/contributions/mine").status_code == 401
    assert (
        client.put(
            f"/api/v1/contributions/{contribution_id}",
            json={
                "title": "No token",
                "type": "slides",
                "url": "https://example.com/no-token.pdf",
            },
        ).status_code
        == 401
    )
    assert client.delete(f"/api/v1/contributions/{contribution_id}").status_code == 401

    missing_id = 99999
    assert (
        client.put(
            f"/api/v1/contributions/{missing_id}",
            json={
                "title": "Missing",
                "type": "slides",
                "url": "https://example.com/missing.pdf",
            },
            headers=owner_headers,
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/contributions/{missing_id}", headers=owner_headers
        ).status_code
        == 404
    )
    assert db_session.execute(select(Contribution)).scalars().all()
