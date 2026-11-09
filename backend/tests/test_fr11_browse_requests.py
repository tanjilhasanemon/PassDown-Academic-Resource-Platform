"""API Integration Tests for FR-11: Browse Public Course Requests."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.request import Request
from app.repositories.course_repo import CourseRepository
from app.repositories.user_repo import UserRepository


def create_course(db_session: Session) -> int:
    """Creates a course for public request listing tests."""
    course = CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )
    return course.id


def create_request(
    db_session: Session,
    *,
    course_id: int,
    author_name: str,
    email: str,
    description: str,
    request_status: str,
) -> Request:
    """Persists a request and its author for public list assertions."""
    author = UserRepository.create(
        db_session,
        name=author_name,
        email=email,
        password_hash="unused-test-hash",
        role="student",
    )
    request = Request(
        course_id=course_id,
        submitted_by=author.id,
        description=description,
        status=request_status,
    )
    db_session.add(request)
    db_session.commit()
    db_session.refresh(request)
    return request


def test_fr11_guest_lists_requests_with_public_fields_and_statuses(
    client: TestClient, db_session: Session
) -> None:
    """Guest can view open and fulfilled requests without private account fields."""
    course_id = create_course(db_session)
    open_request = create_request(
        db_session,
        course_id=course_id,
        author_name="Student One",
        email="student_one@iub.edu.bd",
        description="Lecture notes for week 4",
        request_status="open",
    )
    fulfilled_request = create_request(
        db_session,
        course_id=course_id,
        author_name="Student Two",
        email="student_two@iub.edu.bd",
        description="A copy of the assigned text",
        request_status="fulfilled",
    )

    response = client.get(f"/api/v1/courses/{course_id}/requests")

    assert response.status_code == 200
    items = response.json()
    assert {item["id"] for item in items} == {
        open_request.id,
        fulfilled_request.id,
    }
    by_description = {item["description"]: item for item in items}
    assert by_description["Lecture notes for week 4"]["status"] == "open"
    assert by_description["Lecture notes for week 4"]["author_name"] == "Student One"
    assert by_description["A copy of the assigned text"]["status"] == "fulfilled"
    assert by_description["A copy of the assigned text"]["author_name"] == "Student Two"
    for item in items:
        assert set(item) == {
            "id",
            "description",
            "status",
            "author_name",
            "created_at",
        }
        assert "email" not in item
        assert "submitted_by" not in item
        assert item["created_at"]


def test_fr11_existing_course_without_requests_returns_empty_list(
    client: TestClient, db_session: Session
) -> None:
    """An existing course with no requests returns an empty public collection."""
    course_id = create_course(db_session)

    response = client.get(f"/api/v1/courses/{course_id}/requests")

    assert response.status_code == 200
    assert response.json() == []


def test_fr11_unknown_course_returns_404(client: TestClient) -> None:
    """Public request browsing for an unknown course returns a defined 404."""
    response = client.get("/api/v1/courses/99999/requests")

    assert response.status_code == 404
    assert "course not found" in response.json()["detail"].lower()