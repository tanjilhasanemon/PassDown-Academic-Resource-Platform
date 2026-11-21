"""Automated security, JWT, refresh-rotation, and RBAC test suite for PassDown."""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

from main import app
from scripts.seed_final_demo import ensure_final_demo_data

client = TestClient(app)
ensure_final_demo_data()


def _login(email: str, password: str) -> dict:
    res = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert res.status_code == 200, res.text
    return res.json()


def test_login_refresh_and_logout_flow():
    tokens = _login("student@passdown.edu", "Student1234")
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    # Refresh rotates token cleanly
    ref = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert ref.status_code == 200
    rotated = ref.json()
    assert rotated["refresh_token"] != tokens["refresh_token"]

    # Old refresh token is invalidated after rotation
    stale = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert stale.status_code == 401

    # Logout revokes current session server-side
    out = client.post("/api/v1/auth/logout", json={"refresh_token": rotated["refresh_token"]})
    assert out.status_code == 204
    after_out = client.post("/api/v1/auth/refresh", json={"refresh_token": rotated["refresh_token"]})
    assert after_out.status_code == 401


def test_token_rejection_401():
    assert client.get("/api/v1/me").status_code == 401
    assert client.get("/api/v1/me", headers={"Authorization": "Bearer invalid.jwt.token"}).status_code == 401


def test_rbac_student_cannot_access_admin():
    tok = _login("student@passdown.edu", "Student1234")["access_token"]
    res = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {tok}"})
    assert res.status_code == 403


def test_rbac_group_fine_grained_permissions():
    # student3 has can_assign=True, can_create=False, can_edit=False
    s3_tok = _login("student3@passdown.edu", "Student1234")["access_token"]
    headers = {"Authorization": f"Bearer {s3_tok}"}

    groups = client.get("/api/v1/groups", headers=headers).json()
    target = next(g for g in groups if g["name"] == "CSE309 Final Defence Study Group")

    # Non-owner cannot rename group -> 403
    rename = client.patch(f"/api/v1/groups/{target['id']}", json={"name": "Hacked"}, headers=headers)
    assert rename.status_code == 403

    # Member without can_create cannot add resource -> 403
    add_res = client.post(
        f"/api/v1/groups/{target['id']}/resources",
        json={"title": "Unauthorized Note", "url": "https://example.com/note", "resource_type": "notes"},
        headers=headers,
    )
    assert add_res.status_code == 403


def test_rbac_admin_safety_rules():
    admin_tok = _login("admin@passdown.edu", "Admin1234")["access_token"]
    headers = {"Authorization": f"Bearer {admin_tok}"}
    me = client.get("/api/v1/me", headers=headers).json()

    # Admin cannot change own role -> 403
    self_role = client.patch(f"/api/v1/admin/users/{me['id']}/role", json={"role": "student"}, headers=headers)
    assert self_role.status_code == 403

    # Admin cannot ban another admin -> 403
    users = client.get("/api/v1/admin/users/search?role=admin", headers=headers).json()["items"]
    other_admin = next(u for u in users if u["id"] != me["id"])
    ban_admin = client.post(
        f"/api/v1/admin/users/{other_admin['id']}/ban",
        json={"is_active": False, "reason": "test"},
        headers=headers,
    )
    assert ban_admin.status_code == 403
