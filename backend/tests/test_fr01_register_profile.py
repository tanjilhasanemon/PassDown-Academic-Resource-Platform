"""Unit & API Integration Tests for FR-01: Register and View User Profile.

Author: Tanjil Hasan Emon (THE) - 2331024
Covers all 4 confirmation criteria for FR-01 in PassDown SRS §3.1:
1. Valid registration creates account with role='student' and stores bcrypt hash.
2. Duplicate email (409) or invalid data (422) returns error and creates no duplicate.
3. Public registration attempting role='admin' ignores/blocks escalation and stays 'student'.
4. Authenticated GET /api/v1/auth/me returns id, name, email, role, created_at,
   and never exposes password_hash; unauthenticated GET /api/v1/auth/me returns 401.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import ROLE_STUDENT, create_access_token, verify_password
from app.repositories.user_repo import UserRepository


def test_fr01_register_valid_student_and_hash_password(
    client: TestClient, db_session: Session
) -> None:
    """Given valid unique email, name, and password, creates student with bcrypt hash."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Tanjil Hasan Emon",
            "email": "2331024@iub.edu.bd",
            "password": "SecurePassword123!",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Tanjil Hasan Emon"
    assert data["email"] == "2331024@iub.edu.bd"
    assert data["role"] == ROLE_STUDENT
    assert "id" in data
    assert "created_at" in data
    assert "password" not in data
    assert "password_hash" not in data

    # Inspect database directly (SRS NFR-01 confirmation)
    db_user = UserRepository.get_by_email(db_session, "2331024@iub.edu.bd")
    assert db_user is not None
    assert db_user.password_hash != "SecurePassword123!"
    assert db_user.password_hash.startswith("$2b$")
    assert verify_password("SecurePassword123!", db_user.password_hash) is True


def test_fr01_register_duplicate_email_returns_409_conflict(
    client: TestClient,
) -> None:
    """Given submitted email already exists, returns 409 Conflict and creates no duplicate."""
    payload = {
        "name": "Tanjil Hasan Emon",
        "email": "emon@iub.edu.bd",
        "password": "SecurePassword123!",
    }
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    # Attempt duplicate registration (case-insensitive check)
    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Another User",
            "email": "EMON@IUB.EDU.BD",
            "password": "AnotherPassword123!",
        },
    )
    assert duplicate.status_code == 409
    assert "already exists" in duplicate.json()["detail"].lower()


def test_fr01_register_invalid_data_returns_422(client: TestClient) -> None:
    """Given invalid email or short password, returns 422 validation error."""
    bad_response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "T",
            "email": "not-an-email",
            "password": "short",
        },
    )
    assert bad_response.status_code == 422


def test_fr01_register_blocks_admin_role_escalation(
    client: TestClient, db_session: Session
) -> None:
    """Given public registration attempts role=admin, ignores it and forces role=student."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Escalation Attacker",
            "email": "attacker@iub.edu.bd",
            "password": "SecurePassword123!",
            "role": "admin",
        },
    )
    assert response.status_code == 201
    assert response.json()["role"] == ROLE_STUDENT

    db_user = UserRepository.get_by_email(db_session, "attacker@iub.edu.bd")
    assert db_user is not None
    assert db_user.role == ROLE_STUDENT


def test_fr01_get_me_returns_safe_profile_and_denies_unauthenticated(
    client: TestClient,
) -> None:
    """Given authenticated user, GET /api/v1/auth/me returns profile without password_hash."""
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Tanjil Hasan Emon",
            "email": "me_test@iub.edu.bd",
            "password": "SecurePassword123!",
        },
    )
    user_id = reg.json()["id"]
    token = create_access_token(user_id=user_id, role=ROLE_STUDENT)

    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    profile = me_res.json()
    assert profile["id"] == user_id
    assert profile["name"] == "Tanjil Hasan Emon"
    assert profile["email"] == "me_test@iub.edu.bd"
    assert profile["role"] == ROLE_STUDENT
    assert "password_hash" not in profile

    # Unauthenticated request must return 401
    unauth_res = client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401
