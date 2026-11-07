"""API Integration Tests for FR-12: Fulfill and Delete Requests."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import ROLE_ADMIN, ROLE_STUDENT, create_access_token
from app.models.request import Request
from app.repositories.course_repo import CourseRepository
from app.repositories.request_repo import RequestRepository
from app.repositories.user_repo import UserRepository


def create_course(db_session: Session) -> int:
    """Creates a course for FR-12 request lifecycle tests."""
    course = CourseRepository.create(
        db_session,
        code="CSE 451",
        title="Software Engineering",
        department="CSE",
        semester_offered="Spring 2027",
    )
    return course.id


def create_actor(
    db_session: Session, *, role: str, email: str
) -> tuple[int, dict[str, str]]:
    """Creates an authenticated test actor and returns its bearer header."""
    user = UserRepository.create(
        db_session,
        name=f"{role.title()} Requester",
        email=email,
        password_hash="unused-test-hash",
        role=role,
    )
    token = create_access_token(user_id=user.id, role=role)
    return user.id, {"Authorization": f"Bearer {token}"}


def create_request(
    db_session: Session, *, course_id: int, submitted_by: int, request_status: str = "open"
) -> Request:
    """Creates a resource request with the requested lifecycle status."""
    request = RequestRepository.create(
        db_session,
        course_id=course_id,
        submitted_by=submitted_by,
        description="Lecture notes for week 4",
    )
    if request_status != "open":
        request.status = request_status
        db_session.commit()
        db_session.refresh(request)
    return request


def test_fr12_owner_fulfills_open_request(
    client: TestClient, db_session: Session
) -> None:
    """The request owner can fulfill an open request and receives updated status."""
    course_id = create_course(db_session)
    owner_id, owner_headers = create_actor(
        db_session, role=ROLE_STUDENT, email="owner_fulfill@iub.edu.bd"
    )
    request = create_request(
        db_session, course_id=course_id, submitted_by=owner_id
    )

    response = client.patch(
        f"/api/v1/requests/{request.id}/fulfill", headers=owner_headers
    )

    assert response.status_code == 200
    assert response.json()["id"] == request.id
    assert response.json()["status"] == "fulfilled"
    db_session.refresh(request)
    assert request.status == "fulfilled"


def test_fr12_admin_fulfills_another_users_request(
    client: TestClient, db_session: Session
) -> None:
    """An Admin with requests:write can fulfill a request they do not own."""
    course_id = create_course(db_session)
    owner_id, _ = create_actor(
        db_session, role=ROLE_STUDENT, email="admin_fulfill_owner@iub.edu.bd"
    )
    _, admin_headers = create_actor(
        db_session, role=ROLE_ADMIN, email="admin_fulfill@iub.edu.bd"
    )
    request = create_request(
        db_session, course_id=course_id, submitted_by=owner_id
    )

    response = client.patch(
        f"/api/v1/requests/{request.id}/fulfill", headers=admin_headers
    )

    assert response.status_code == 200
    assert response.json()["status"] == "fulfilled"


def test_fr12_non_owner_student_cannot_fulfill_request(
    client: TestClient, db_session: Session
) -> None:
    """A different Student receives 403 and leaves the request open."""
    course_id = create_course(db_session)
    owner_id, _ = create_actor(
        db_session, role=ROLE_STUDENT, email="request_owner@iub.edu.bd"
    )
    _, other_headers = create_actor(
        db_session, role=ROLE_STUDENT, email="other_student@iub.edu.bd"
    )
    request = create_request(
        db_session, course_id=course_id, submitted_by=owner_id
    )

    response = client.patch(
        f"/api/v1/requests/{request.id}/fulfill", headers=other_headers
    )

    assert response.status_code == 403
    db_session.refresh(request)
    assert request.status == "open"


def test_fr12_guest_cannot_fulfill_request(
    client: TestClient, db_session: Session
) -> None:
    """An unauthenticated Guest receives 401 and the request remains open."""
    course_id = create_course(db_session)
    owner_id, _ = create_actor(
        db_session, role=ROLE_STUDENT, email="guest_test_owner@iub.edu.bd"
    )
    request = create_request(
        db_session, course_id=course_id, submitted_by=owner_id
    )

    response = client.patch(f"/api/v1/requests/{request.id}/fulfill")

    assert response.status_code == 401
    db_session.refresh(request)
    assert request.status == "open"


def test_fr12_repeated_fulfillment_returns_conflict(
    client: TestClient, db_session: Session
) -> None:
    """A fulfilled request cannot be fulfilled again and stays fulfilled."""
    course_id = create_course(db_session)
    owner_id, owner_headers = create_actor(
        db_session, role=ROLE_STUDENT, email="repeat_owner@iub.edu.bd"
    )
    request = create_request(
        db_session,
        course_id=course_id,
        submitted_by=owner_id,
        request_status="fulfilled",
    )

    response = client.patch(
        f"/api/v1/requests/{request.id}/fulfill", headers=owner_headers
    )

    assert response.status_code == 409
    db_session.refresh(request)
    assert request.status == "fulfilled"


def test_fr12_guest_and_non_owner_cannot_delete_request(
    client: TestClient, db_session: Session
) -> None:
    """Guests receive 401 and non-owner Students receive 403 without deletion."""
    course_id = create_course(db_session)
    owner_id, _ = create_actor(
        db_session, role=ROLE_STUDENT, email="delete_owner@iub.edu.bd"
    )
    _, other_headers = create_actor(
        db_session, role=ROLE_STUDENT, email="delete_other@iub.edu.bd"
    )
    request = create_request(
        db_session, course_id=course_id, submitted_by=owner_id
    )
    endpoint = f"/api/v1/requests/{request.id}"

    guest_response = client.delete(endpoint)
    forbidden_response = client.delete(endpoint, headers=other_headers)

    assert guest_response.status_code == 401
    assert forbidden_response.status_code == 403
    assert RequestRepository.get_by_id(db_session, request.id) is not None


def test_fr12_owner_and_admin_can_delete_without_deleting_course(
    client: TestClient, db_session: Session
) -> None:
    """Request owner and Admin can delete requests while their course remains."""
    course_id = create_course(db_session)
    owner_id, owner_headers = create_actor(
        db_session, role=ROLE_STUDENT, email="owner_delete@iub.edu.bd"
    )
    _, admin_headers = create_actor(
        db_session, role=ROLE_ADMIN, email="admin_delete@iub.edu.bd"
    )
    owner_request = create_request(
        db_session, course_id=course_id, submitted_by=owner_id
    )
    admin_request = create_request(
        db_session, course_id=course_id, submitted_by=owner_id
    )

    owner_response = client.delete(
        f"/api/v1/requests/{owner_request.id}", headers=owner_headers
    )
    admin_response = client.delete(
        f"/api/v1/requests/{admin_request.id}", headers=admin_headers
    )

    assert owner_response.status_code == 204
    assert admin_response.status_code == 204
    assert RequestRepository.get_by_id(db_session, owner_request.id) is None
    assert RequestRepository.get_by_id(db_session, admin_request.id) is None
    assert CourseRepository.get_by_id(db_session, course_id) is not None