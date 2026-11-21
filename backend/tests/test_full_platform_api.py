"""Comprehensive Unit & API Integration Tests (Normal, Boundary, Invalid, Exceptional)."""

import sys
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
import pytest

from core.security import hash_password, verify_password
from main import app
from scripts.seed_final_demo import ensure_final_demo_data

client = TestClient(app)
ensure_final_demo_data()


def _auth_header(email: str, password: str) -> dict[str, str]:
    """Logs in and returns an Authorization Bearer header dict."""
    res = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_normal_health_endpoint_returns_ok() -> None:
    """Verifies GET /api/health returns 200 OK."""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_normal_password_hashing_and_verification() -> None:
    """Verifies Argon2id password hashing and verification."""
    hashed = hash_password("SecurePass2026!")
    assert hashed != "SecurePass2026!"
    assert verify_password("SecurePass2026!", hashed) is True
    assert verify_password("WrongPass2026!", hashed) is False


def test_normal_public_course_catalog_and_search() -> None:
    """Verifies Guests can browse and search courses without logging in."""
    res = client.get("/api/v1/courses")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) >= 1

    first_code = data["items"][0]["code"]
    search_res = client.get(f"/api/v1/courses?search={first_code}")
    assert search_res.status_code == 200
    assert any(c["code"] == first_code for c in search_res.json()["items"])


def test_normal_register_and_view_me_profile_without_password_hash() -> None:
    """Verifies public registration creates a student and /api/v1/me excludes password_hash."""
    unique_email = f"student_{uuid.uuid4().hex[:8]}@iub.edu.bd"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "name": "IUB Test Student",
            "email": unique_email,
            "password": "ValidPassword123!",
        },
    )
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert body["email"] == unique_email
    assert body["role"] == "student"
    assert "password_hash" not in body

    headers = _auth_header(unique_email, "ValidPassword123!")
    me = client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200
    profile = me.json()
    assert profile["email"] == unique_email
    assert profile["role"] == "student"
    assert "password_hash" not in profile


def test_normal_admin_course_and_material_lifecycle() -> None:
    """Verifies Admin can create/update/delete a course and publish a core material."""
    admin_headers = _auth_header("admin@passdown.edu", "Admin1234")
    unique_code = f"TST{uuid.uuid4().hex[:4].upper()}"

    created = client.post(
        "/api/v1/courses",
        json={
            "code": unique_code,
            "title": "Software Verification",
            "department": "CSE",
            "semester_offered": "Spring 2027",
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    course_id = created.json()["id"]

    mat = client.post(
        f"/api/v1/courses/{course_id}/core-materials",
        json={
            "title": "Verification Lecture Slides",
            "type": "slides",
            "url": "https://example.com/verification-slides.pdf",
            "description": "Week 1 slides",
        },
        headers=admin_headers,
    )
    assert mat.status_code == 201, mat.text
    mat_id = mat.json()["id"]

    listed = client.get(f"/api/v1/courses/{course_id}/core-materials")
    assert listed.status_code == 200
    assert any(m["id"] == mat_id for m in listed.json()["items"])

    assert client.delete(f"/api/v1/core-materials/{mat_id}", headers=admin_headers).status_code == 204
    assert client.delete(f"/api/v1/courses/{course_id}", headers=admin_headers).status_code == 204


def test_normal_contribution_submission_and_request_flow() -> None:
    """Verifies Student can submit a pending contribution and post a course request."""
    student_headers = _auth_header("student@passdown.edu", "Student1234")
    admin_headers = _auth_header("admin@passdown.edu", "Admin1234")
    courses = client.get("/api/v1/courses").json()["items"]
    course_id = courses[0]["id"]

    contrib = client.post(
        f"/api/v1/courses/{course_id}/contributions",
        json={
            "title": "Pytest Study Notes",
            "type": "notes",
            "url": "https://example.com/pytest-notes.pdf",
            "description": "Unit and integration testing guide",
        },
        headers=student_headers,
    )
    assert contrib.status_code == 201, contrib.text
    contrib_id = contrib.json()["id"]
    assert contrib.json()["status"] == "pending"

    approved = client.patch(
        f"/api/v1/contributions/{contrib_id}/status",
        json={"status": "approved"},
        headers=admin_headers,
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    req = client.post(
        f"/api/v1/courses/{course_id}/requests",
        json={"description": "Need worked DFD examples for SDS"},
        headers=student_headers,
    )
    assert req.status_code == 201, req.text
    req_id = req.json()["id"]

    client.delete(f"/api/v1/contributions/{contrib_id}", headers=admin_headers)
    client.delete(f"/api/v1/requests/{req_id}", headers=admin_headers)


def test_boundary_empty_search_returns_empty_list() -> None:
    """Verifies searching for a nonexistent course returns 200 with empty items list."""
    res = client.get("/api/v1/courses?search=NONEXISTENT_COURSE_99999")
    assert res.status_code == 200
    assert res.json()["items"] == []


@pytest.mark.parametrize(
    "bad_payload",
    [
        {"name": "A", "email": "not-an-email", "password": "short"},
        {"name": "Valid Name", "email": "invalid-email", "password": "ValidPassword123!"},
        {"name": "Valid Name", "email": "valid_short_pw@iub.edu.bd", "password": "123"},
    ],
)
def test_invalid_registration_payloads_rejected(bad_payload: dict[str, str]) -> None:
    """Verifies invalid email formats and short passwords return 422."""
    res = client.post("/api/v1/auth/register", json=bad_payload)
    assert res.status_code == 422


def test_invalid_non_https_material_url_rejected() -> None:
    """Verifies non-HTTPS or malformed URLs are rejected when adding materials."""
    admin_headers = _auth_header("admin@passdown.edu", "Admin1234")
    courses = client.get("/api/v1/courses").json()["items"]
    course_id = courses[0]["id"]

    res = client.post(
        f"/api/v1/courses/{course_id}/core-materials",
        json={
            "title": "Invalid URL Material",
            "type": "slides",
            "url": "javascript:alert(1)",
        },
        headers=admin_headers,
    )
    assert res.status_code == 422


def test_exception_unknown_course_returns_404() -> None:
    """Verifies requesting an unknown course ID returns 404 Not Found."""
    res = client.get("/api/v1/courses/999999")
    assert res.status_code == 404


def test_exception_duplicate_email_registration_returns_409() -> None:
    """Verifies registering an already-existing email returns 409 Conflict."""
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Duplicate User",
            "email": "student@passdown.edu",
            "password": "ValidPassword123!",
        },
    )
    assert res.status_code == 409


def test_exception_verify_password_corrupted_hash_returns_false() -> None:
    """Verifies verify_password handles corrupted password hashes without crashing."""
    assert verify_password("AnyPassword123!", "corrupted-hash-value") is False


def test_exception_student_cannot_create_course_returns_403() -> None:
    """Verifies a Student attempting Admin course creation receives 403 Forbidden."""
    student_headers = _auth_header("student@passdown.edu", "Student1234")
    res = client.post(
        "/api/v1/courses",
        json={
            "code": "DENY999",
            "title": "Unauthorized Course",
            "department": "CSE",
            "semester_offered": "Spring 2027",
        },
        headers=student_headers,
    )
    assert res.status_code == 403
