"""API Integration Tests for FR-05 and FR-06: Core Materials.

Author: Tanjil Sarkar (TS) - 2312026
Covers confirmation criteria for Core Materials:
1. Admin can add, update, and delete Core Materials (FR-06).
2. Invalid URLs (http://) or invalid types return 422.
3. Public users can list materials and filter by type (FR-05).
4. Guests (401) and Students (403) cannot mutate Core Materials.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_STUDENT, create_access_token
from app.models.core_material import CoreMaterial
from app.repositories.core_material_repo import CoreMaterialRepository
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository


def create_admin_headers(db_session: Session) -> dict[str, str]:
    """Helper to create an Admin user and return the Bearer token headers."""
    admin = UserRepository.create(
        db_session, name="Material Admin", email="material_admin@iub.edu.bd", password_hash="unused", role=ROLE_ADMIN
    )
    token = create_access_token(user_id=admin.id, role=ROLE_ADMIN)
    return {"Authorization": f"Bearer {token}"}


def create_student_headers(db_session: Session) -> dict[str, str]:
    """Helper to create a Student user and return the Bearer token headers."""
    student = UserRepository.create(
        db_session, name="Material Student", email="material_student@iub.edu.bd", password_hash="unused", role=ROLE_STUDENT
    )
    token = create_access_token(user_id=student.id, role=ROLE_STUDENT)
    return {"Authorization": f"Bearer {token}"}


def create_test_course(db_session: Session) -> int:
    """Helper to create a course for material tests."""
    course = CourseRepository.create(
        db_session, code="CSE 451", title="Software Engineering", department="CSE", semester_offered="Spring 2027"
    )
    return course.id


def test_fr06_admin_add_core_material_success(client: TestClient, db_session: Session) -> None:
    """Given valid Admin data, POST /courses/{id}/core-materials creates a material (201)."""
    course_id = create_test_course(db_session)
    headers = create_admin_headers(db_session)
    payload = {
        "title": "Lecture 1 Slides",
        "type": "slides",
        "url": "https://example.com/lecture1.pdf",
        "description": "Introduction to software engineering",
    }

    response = client.post(f"/api/v1/courses/{course_id}/core-materials", json=payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Lecture 1 Slides"
    assert data["type"] == "slides"
    assert data["course_id"] == course_id


@pytest.mark.parametrize("invalid_url", ["http://example.com", "not-a-url"])
def test_fr06_invalid_url_returns_422(client: TestClient, db_session: Session, invalid_url: str) -> None:
    """Given an invalid URL, creation returns 422 Unprocessable Entity."""
    course_id = create_test_course(db_session)
    headers = create_admin_headers(db_session)
    payload = {"title": "Invalid Link", "type": "notes", "url": invalid_url}

    response = client.post(f"/api/v1/courses/{course_id}/core-materials", json=payload, headers=headers)

    assert response.status_code == 422


def test_fr05_public_filter_by_type(client: TestClient, db_session: Session) -> None:
    """Given public access, GET /courses/{id}/core-materials?material_type= returns filtered results."""
    course_id = create_test_course(db_session)
    # Add two materials
    CoreMaterialRepository.create(db_session, course_id=course_id, title="Slides", type="slides", url="https://example.com/1", description=None)
    CoreMaterialRepository.create(db_session, course_id=course_id, title="Notes", type="notes", url="https://example.com/2", description=None)

    # Fetch all
    all_res = client.get(f"/api/v1/courses/{course_id}/core-materials")
    assert all_res.status_code == 200
    assert len(all_res.json()) == 2

    # Filter by 'slides'
    filter_res = client.get(f"/api/v1/courses/{course_id}/core-materials?material_type=slides")
    assert filter_res.status_code == 200
    assert len(filter_res.json()) == 1
    assert filter_res.json()[0]["title"] == "Slides"


def test_fr06_admin_update_and_delete_material(client: TestClient, db_session: Session) -> None:
    """Admin can update and delete an existing core material."""
    course_id = create_test_course(db_session)
    headers = create_admin_headers(db_session)
    material = CoreMaterialRepository.create(
        db_session, course_id=course_id, title="Old Title", type="slides", url="https://example.com/old.pdf", description=None
    )

    # Update
    update_res = client.put(
        f"/api/v1/core-materials/{material.id}",
        json={"title": "New Title", "type": "notes"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "New Title"
    assert update_res.json()["type"] == "notes"

    # Delete
    delete_res = client.delete(f"/api/v1/core-materials/{material.id}", headers=headers)
    assert delete_res.status_code == 204
    assert CoreMaterialRepository.get_by_id(db_session, material.id) is None


def test_fr06_guest_and_student_denied(client: TestClient, db_session: Session) -> None:
    """Guests (401) and Students (403) cannot add/update/delete Core Materials."""
    course_id = create_test_course(db_session)
    student_headers = create_student_headers(db_session)
    payload = {"title": "Denied", "type": "slides", "url": "https://example.com/denied.pdf"}

    # Guest (no token) -> 401
    assert client.post(f"/api/v1/courses/{course_id}/core-materials", json=payload).status_code == 401

    # Student -> 403
    assert client.post(f"/api/v1/courses/{course_id}/core-materials", json=payload, headers=student_headers).status_code == 403