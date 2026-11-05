"""Unit & API Integration Tests for FR-03: Browse and Search Courses.

Author: Tanjil Hasan Emon (THE) - 2331024
Covers all 4 confirmation criteria for FR-03 in PassDown SRS §3.1:
1. Public visitor GET /api/v1/courses returns course code, title, department,
   semester_offered, and stable identifiers without requiring login.
2. Supplying `?search=` filters matching courses by course code or title
   (case-insensitively) without requiring login.
3. Requesting GET /api/v1/courses/{id} for a valid course ID returns full course
   metadata plus `resource_links` (`core_materials`, `approved_contributions`, `requests`).
4. Requesting GET /api/v1/courses/{id} for an unknown course ID returns 404 Not Found.
5. Controlled database seeder (`seed_initial_data`) provisions default Admin, Student,
   and IUB courses idempotently.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.seed import seed_initial_data
from app.repositories.course_repo import CourseRepository


def test_fr03_guest_browse_course_list_without_login(
    client: TestClient, db_session: Session
) -> None:
    """Given a public visitor requests the course list, returns metadata without login."""
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

    response = client.get("/api/v1/courses")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 2
    assert items[0]["code"] == "CSE 303"
    assert items[1]["code"] == "CSE 451"
    for item in items:
        assert "id" in item
        assert "title" in item
        assert "department" in item
        assert "semester_offered" in item
        assert "created_at" in item


def test_fr03_search_courses_by_code_or_title_and_empty_state(
    client: TestClient, db_session: Session
) -> None:
    """Given ?search= matches code or title, returns matching courses without login."""
    CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )
    CourseRepository.create(
        db_session,
        code="EEE 131",
        title="Electrical Circuits I",
        department="EEE",
        semester_offered="Spring 2027",
    )

    # Search by course code substring (case-insensitive)
    by_code = client.get("/api/v1/courses?search=cse%20451")
    assert by_code.status_code == 200
    assert len(by_code.json()) == 1
    assert by_code.json()[0]["code"] == "CSE 451"

    # Search by course title keyword (case-insensitive)
    by_title = client.get("/api/v1/courses?search=circuits")
    assert by_title.status_code == 200
    assert len(by_title.json()) == 1
    assert by_title.json()[0]["code"] == "EEE 131"

    # Search with no matching records returns empty list [] (200 OK)
    no_match = client.get("/api/v1/courses?search=nonexistent999")
    assert no_match.status_code == 200
    assert no_match.json() == []


def test_fr03_course_detail_valid_id_returns_resource_links_and_unknown_returns_404(
    client: TestClient, db_session: Session
) -> None:
    """Given valid course id, returns detail + resource links; unknown id returns 404."""
    course = CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )

    detail_res = client.get(f"/api/v1/courses/{course.id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == course.id
    assert detail["code"] == "CSE 451"
    assert detail["title"] == "Software Engineering"
    assert detail["resource_links"] == {
        "core_materials": f"/api/v1/courses/{course.id}/core-materials",
        "approved_contributions": f"/api/v1/courses/{course.id}/contributions",
        "requests": f"/api/v1/courses/{course.id}/requests",
    }

    # Unknown course ID -> 404 Not Found
    not_found_res = client.get("/api/v1/courses/99999")
    assert not_found_res.status_code == 404
    assert "not found" in not_found_res.json()["detail"].lower()


def test_fr03_idempotent_database_seeder(db_session: Session) -> None:
    """Verifies that seed_initial_data provisions Admin, Student, and 6 IUB courses."""
    first_run = seed_initial_data(db_session)
    assert first_run["users_created"] == 2
    assert first_run["courses_created"] == 6

    # Second run must be idempotent (0 duplicates created)
    second_run = seed_initial_data(db_session)
    assert second_run["users_created"] == 0
    assert second_run["courses_created"] == 0
