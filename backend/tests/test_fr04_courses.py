"""API Integration Tests for FR-04: Manage Courses (Admin CRUD).

Covers all confirmation criteria for FR-04 in PassDown SRS §3.1:
1. Admin can create a new course (201 Created).
2. Creating a course with a duplicate code returns 409 Conflict.
3. Admin can update a course's metadata (200 OK).
4. Admin can delete an empty course (204 No Content).
5. Admin cannot delete a course that has dependent records (409 Conflict).
6. Guests (401) and Students (403) cannot perform mutations.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_STUDENT, create_access_token
from app.models.core_material import CoreMaterial
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository


def create_admin_headers(db_session: Session) -> dict[str, str]:
    """Helper to create an Admin user and return the Bearer token headers."""
    admin = UserRepository.create(
        db_session,
        name="Course Admin",
        email="course_admin@iub.edu.bd",
        password_hash="unused",
        role=ROLE_ADMIN,
    )
    token = create_access_token(user_id=admin.id, role=ROLE_ADMIN)
    return {"Authorization": f"Bearer {token}"}


def create_student_headers(db_session: Session) -> dict[str, str]:
    """Helper to create a Student user and return the Bearer token headers."""
    student = UserRepository.create(
        db_session,
        name="Course Student",
        email="course_student@iub.edu.bd",
        password_hash="unused",
        role=ROLE_STUDENT,
    )
    token = create_access_token(user_id=student.id, role=ROLE_STUDENT)
    return {"Authorization": f"Bearer {token}"}


def test_fr04_admin_creates_course_successfully(
    client: TestClient, db_session: Session
) -> None:
    """Given valid Admin data, POST /courses creates a new course (201)."""
    headers = create_admin_headers(db_session)
    payload = {
        "code": "CSE 451",
        "title": "Software Engineering",
        "department": "CSE",
        "semester_offered": "Spring 2027",
    }

    response = client.post("/api/v1/courses", json=payload, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "CSE 451"
    assert data["title"] == "Software Engineering"
    assert "id" in data
    assert "created_at" in data


def test_fr04_duplicate_course_code_returns_409(
    client: TestClient, db_session: Session
) -> None:
    """Given an existing course code, creation returns 409 Conflict."""
    headers = create_admin_headers(db_session)
    CourseRepository.create(
        db_session,
        code="CSE 303",
        title="Database",
        department="CSE",
        semester_offered="Spring 2027",
    )
    payload = {
        "code": "CSE 303",
        "title": "Another Database",
        "department": "CSE",
        "semester_offered": "Fall 2027",
    }

    response = client.post("/api/v1/courses", json=payload, headers=headers)

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_fr04_admin_updates_course_successfully(
    client: TestClient, db_session: Session
) -> None:
    """Given valid data, PUT /courses/{id} updates the course metadata (200)."""
    headers = create_admin_headers(db_session)
    course = CourseRepository.create(
        db_session,
        code="EEE 131",
        title="Electrical Circuits I",
        department="EEE",
        semester_offered="Spring 2027",
    )

    response = client.put(
        f"/api/v1/courses/{course.id}",
        json={"title": "Electrical Circuits II", "semester_offered": "Fall 2027"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Electrical Circuits II"
    assert response.json()["code"] == "EEE 131"  # Code remains unchanged


def test_fr04_admin_deletes_empty_course_successfully(
    client: TestClient, db_session: Session
) -> None:
    """Given a course with no dependents, DELETE /courses/{id} succeeds (204)."""
    headers = create_admin_headers(db_session)
    course = CourseRepository.create(
        db_session,
        code="MAT 101",
        title="Calculus I",
        department="Math",
        semester_offered="Spring 2027",
    )

    response = client.delete(f"/api/v1/courses/{course.id}", headers=headers)

    assert response.status_code == 204
    assert CourseRepository.get_by_id(db_session, course.id) is None


def test_fr04_delete_blocked_with_dependents_returns_409(
    client: TestClient, db_session: Session
) -> None:
    """Given a course with dependent CoreMaterials, DELETE returns 409 Conflict."""
    headers = create_admin_headers(db_session)
    course = CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )
    # Add a dependent CoreMaterial to this course
    material = CoreMaterial(
        course_id=course.id,
        title="Lecture 1",
        type="slides",
        url="https://example.com/lecture1.pdf",
    )
    db_session.add(material)
    db_session.commit()

    response = client.delete(f"/api/v1/courses/{course.id}", headers=headers)

    assert response.status_code == 409
    assert "Deletion blocked" in response.json()["detail"]
    # Course must still exist
    assert CourseRepository.get_by_id(db_session, course.id) is not None


def test_fr04_guest_and_student_are_denied(
    client: TestClient, db_session: Session
) -> None:
    """Guests get 401, Students get 403 on Admin mutation endpoints."""
    student_headers = create_student_headers(db_session)
    payload = {
        "code": "CSE 999",
        "title": "Denied Course",
        "department": "CSE",
        "semester_offered": "Spring 2027",
    }

    # Guest (no token)
    assert client.post("/api/v1/courses", json=payload).status_code == 401

    # Student (lacks courses:write scope)
    assert (
        client.post("/api/v1/courses", json=payload, headers=student_headers).status_code
        == 403
    )
