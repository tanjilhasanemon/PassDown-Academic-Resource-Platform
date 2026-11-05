"""Unit & API Integration Tests for FR-02: Authenticate and Authorize Protected Sessions.

Author: Tanjil Hasan Emon (THE) - 2331024
Covers all confirmation criteria for FR-02 in PassDown SRS §3.1, §3.4, NFR-02, and NFR-03:
1. Valid registered credentials at POST /api/v1/auth/login return a signed JWT containing
   subject identity (`sub`), `role`, fine-grained `scopes`, and `exp`.
2. Both JSON login and OAuth2 form-encoded login (`username` & `password`) are supported.
3. Invalid password or unknown email returns 401 Unauthorized and issues no token.
4. Missing, malformed, or expired JWT returns 401 Unauthorized on protected endpoints.
5. Valid Student JWT calling Admin-scoped endpoints (`courses:write`, `materials:write`,
   `contributions:moderate`) returns 403 Forbidden.
6. Valid Admin JWT succeeds across all 5 security scopes (`200 OK`).
"""

from datetime import timedelta
from fastapi.testclient import TestClient
import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    ROLE_ADMIN,
    ROLE_STUDENT,
    SCOPE_CONTRIBUTIONS_MODERATE,
    SCOPE_CONTRIBUTIONS_WRITE,
    SCOPE_COURSES_WRITE,
    SCOPE_MATERIALS_WRITE,
    SCOPE_REQUESTS_WRITE,
    create_access_token,
    hash_password,
)
from app.repositories.user_repo import UserRepository


def test_fr02_login_valid_student_json_and_form_returns_signed_jwt(
    client: TestClient,
) -> None:
    """Given valid registered credentials, login returns signed JWT with sub, role, scopes, exp."""
    client.post(
        "/api/v1/auth/register",
        json={
            "name": "Tanjil Hasan Emon",
            "email": "student_login@iub.edu.bd",
            "password": "ValidPassword123!",
        },
    )

    # 1. Test JSON login payload
    res_json = client.post(
        "/api/v1/auth/login",
        json={
            "email": "student_login@iub.edu.bd",
            "password": "ValidPassword123!",
        },
    )
    assert res_json.status_code == 200
    body = res_json.json()
    assert body["token_type"] == "bearer"
    assert body["role"] == ROLE_STUDENT
    assert body["scopes"] == [SCOPE_CONTRIBUTIONS_WRITE, SCOPE_REQUESTS_WRITE]
    assert body["user"]["email"] == "student_login@iub.edu.bd"
    assert "password_hash" not in body["user"]

    decoded = jwt.decode(
        body["access_token"],
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )
    assert decoded["sub"] == str(body["user"]["id"])
    assert decoded["role"] == ROLE_STUDENT
    assert decoded["scopes"] == [SCOPE_CONTRIBUTIONS_WRITE, SCOPE_REQUESTS_WRITE]
    assert "exp" in decoded

    # 2. Test OAuth2 form-encoded login (SRS §3.3.2 compatibility)
    res_form = client.post(
        "/api/v1/auth/login",
        data={
            "username": "student_login@iub.edu.bd",
            "password": "ValidPassword123!",
        },
    )
    assert res_form.status_code == 200
    assert res_form.json()["access_token"]


def test_fr02_login_invalid_credentials_returns_401(client: TestClient) -> None:
    """Given invalid password or unknown email, login returns 401 and issues no token."""
    client.post(
        "/api/v1/auth/register",
        json={
            "name": "Tanjil Hasan Emon",
            "email": "valid_user@iub.edu.bd",
            "password": "CorrectPassword123!",
        },
    )

    wrong_pass = client.post(
        "/api/v1/auth/login",
        json={
            "email": "valid_user@iub.edu.bd",
            "password": "WrongPassword999!",
        },
    )
    assert wrong_pass.status_code == 401
    assert "access_token" not in wrong_pass.json()

    unknown_email = client.post(
        "/api/v1/auth/login",
        json={
            "email": "nobody@iub.edu.bd",
            "password": "CorrectPassword123!",
        },
    )
    assert unknown_email.status_code == 401


def test_fr02_missing_invalid_or_expired_token_returns_401(
    client: TestClient,
) -> None:
    """Given a missing, invalid, or expired token, protected endpoints return 401."""
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Token Expiry User",
            "email": "expiry@iub.edu.bd",
            "password": "ValidPassword123!",
        },
    )
    user_id = reg.json()["id"]

    # Missing token -> 401
    assert client.get("/api/v1/auth/me").status_code == 401

    # Malformed token -> 401
    bad_header = {"Authorization": "Bearer tampered.invalid.token"}
    assert client.get("/api/v1/auth/me", headers=bad_header).status_code == 401

    # Expired token (negative timedelta) -> 401
    expired_token = create_access_token(
        user_id=user_id,
        role=ROLE_STUDENT,
        expires_delta=timedelta(minutes=-5),
    )
    expired_header = {"Authorization": f"Bearer {expired_token}"}
    assert client.get("/api/v1/auth/me", headers=expired_header).status_code == 401


def test_fr02_student_vs_admin_security_scopes_matrix(
    client: TestClient, db_session: Session
) -> None:
    """Verifies Guest (401), Student (200/403), and Admin (200) across all 5 security scopes."""
    # 1. Create a Student via public registration
    student_reg = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Student Caller",
            "email": "student_matrix@iub.edu.bd",
            "password": "StudentPassword123!",
        },
    )
    student_id = student_reg.json()["id"]
    student_token = create_access_token(user_id=student_id, role=ROLE_STUDENT)
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 2. Seed an Admin directly in the database (SRS §1.5 & §2.5: Admins are seeded, not registered)
    admin_user = UserRepository.create(
        db_session,
        name="Curator Admin",
        email="admin@iub.edu.bd",
        password_hash=hash_password("AdminSecret123!"),
        role=ROLE_ADMIN,
    )
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@iub.edu.bd", "password": "AdminSecret123!"},
    )
    assert admin_login.status_code == 200
    assert admin_login.json()["role"] == ROLE_ADMIN
    assert set(admin_login.json()["scopes"]) == {
        SCOPE_COURSES_WRITE,
        SCOPE_MATERIALS_WRITE,
        SCOPE_CONTRIBUTIONS_MODERATE,
        SCOPE_CONTRIBUTIONS_WRITE,
        SCOPE_REQUESTS_WRITE,
    }
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
    assert admin_user.id == admin_login.json()["user"]["id"]

    # 3. Verify Student is ALLOWED (200) on student-scoped routes:
    for allowed_path in (
        "/api/v1/auth/scopes/contributions-write",
        "/api/v1/auth/scopes/requests-write",
    ):
        assert client.get(allowed_path).status_code == 401  # Guest denied (401)
        assert client.get(allowed_path, headers=student_headers).status_code == 200
        assert client.get(allowed_path, headers=admin_headers).status_code == 200

    # 4. Verify Student is FORBIDDEN (403) and Admin is ALLOWED (200) on Admin-scoped routes:
    for admin_only_path in (
        "/api/v1/auth/scopes/courses-write",
        "/api/v1/auth/scopes/materials-write",
        "/api/v1/auth/scopes/contributions-moderate",
    ):
        assert client.get(admin_only_path).status_code == 401  # Guest -> 401
        student_res = client.get(admin_only_path, headers=student_headers)
        assert student_res.status_code == 403  # Student -> 403 Forbidden
        admin_res = client.get(admin_only_path, headers=admin_headers)
        assert admin_res.status_code == 200  # Admin -> 200 OK
