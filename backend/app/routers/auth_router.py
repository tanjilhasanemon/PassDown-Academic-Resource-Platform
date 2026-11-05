"""Authentication, JWT Login & RBAC Scope Router (ECB Boundary Layer).

Exposes FR-01 and FR-02 endpoints:
- POST /api/v1/auth/register (Public registration -> 201 Created)
- POST /api/v1/auth/login (Public login supporting JSON and OAuth2 form -> 200 OK)
- GET /api/v1/auth/me (Authenticated profile retrieval -> 200 OK)
- GET /api/v1/auth/verify-scope/{scope_name} (Scope enforcement verification -> 200/401/403)
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Security, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    ROLE_SCOPES,
    ROLE_ADMIN,
    SCOPE_CONTRIBUTIONS_MODERATE,
    SCOPE_CONTRIBUTIONS_WRITE,
    SCOPE_COURSES_WRITE,
    SCOPE_MATERIALS_WRITE,
    SCOPE_REQUESTS_WRITE,
    get_current_user,
)
from app.schemas.auth_schema import (
    LoginRequest,
    ScopeCheckResponse,
    TokenResponse,
    UserRead,
    UserRegisterRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication & Profile (FR-01, FR-02)"])

ALL_DEFINED_SCOPES = set(ROLE_SCOPES[ROLE_ADMIN])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Student account (FR-01)",
)
def register_user(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> UserRead:
    """Registers a prospective student and returns the safe profile without password_hash."""
    user = AuthService.register_student(db, payload)
    return UserRead.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and issue expiring scoped JWT (FR-02)",
)
async def login_user(
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticates a registered Student or Admin and returns a signed JWT.

    Supports both JSON payloads (`{"email": "...", "password": "..."}`) and
    OAuth2 password-flow form encoding (`username=...&password=...`) as specified
    in PassDown SRS §3.3.2.
    """
    content_type = request.headers.get("content-type", "").lower()
    email_val: str | None = None
    password_val: str | None = None

    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        email_val = str(form.get("username") or form.get("email") or "").strip()
        password_val = str(form.get("password") or "")
    else:
        try:
            body = await request.json()
            parsed = LoginRequest.model_validate(body)
            email_val = str(parsed.email)
            password_val = parsed.password
        except (ValueError, ValidationError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please provide a valid email address and password.",
            ) from exc

    if not email_val or not password_val:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email and password are required.",
        )

    return AuthService.authenticate_user(
        db,
        email=email_val,
        password=password_val,
    )


@router.get(
    "/me",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile (FR-01)",
)
def read_current_user_profile(
    current_user: object = Security(get_current_user, scopes=[]),
) -> UserRead:
    """Returns the currently authenticated Student or Admin profile without password_hash."""
    return UserRead.model_validate(current_user)


@router.get(
    "/scopes/courses-write",
    response_model=ScopeCheckResponse,
    summary="Verify Admin scope courses:write (FR-02 & NFR-03)",
)
def verify_courses_write_scope(
    current_user: object = Security(get_current_user, scopes=[SCOPE_COURSES_WRITE]),
) -> ScopeCheckResponse:
    """Protected endpoint verifying that the caller holds `courses:write` scope."""
    user = UserRead.model_validate(current_user)
    return ScopeCheckResponse(
        authorized=True,
        user_id=user.id,
        role=user.role,
        verified_scope=SCOPE_COURSES_WRITE,
    )


@router.get(
    "/scopes/materials-write",
    response_model=ScopeCheckResponse,
    summary="Verify Admin scope materials:write (FR-02 & NFR-03)",
)
def verify_materials_write_scope(
    current_user: object = Security(get_current_user, scopes=[SCOPE_MATERIALS_WRITE]),
) -> ScopeCheckResponse:
    """Protected endpoint verifying that the caller holds `materials:write` scope."""
    user = UserRead.model_validate(current_user)
    return ScopeCheckResponse(
        authorized=True,
        user_id=user.id,
        role=user.role,
        verified_scope=SCOPE_MATERIALS_WRITE,
    )


@router.get(
    "/scopes/contributions-moderate",
    response_model=ScopeCheckResponse,
    summary="Verify Admin scope contributions:moderate (FR-02 & NFR-03)",
)
def verify_contributions_moderate_scope(
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_MODERATE]
    ),
) -> ScopeCheckResponse:
    """Protected endpoint verifying that the caller holds `contributions:moderate` scope."""
    user = UserRead.model_validate(current_user)
    return ScopeCheckResponse(
        authorized=True,
        user_id=user.id,
        role=user.role,
        verified_scope=SCOPE_CONTRIBUTIONS_MODERATE,
    )


@router.get(
    "/scopes/contributions-write",
    response_model=ScopeCheckResponse,
    summary="Verify Student/Admin scope contributions:write (FR-02 & NFR-03)",
)
def verify_contributions_write_scope(
    current_user: object = Security(
        get_current_user, scopes=[SCOPE_CONTRIBUTIONS_WRITE]
    ),
) -> ScopeCheckResponse:
    """Protected endpoint verifying that the caller holds `contributions:write` scope."""
    user = UserRead.model_validate(current_user)
    return ScopeCheckResponse(
        authorized=True,
        user_id=user.id,
        role=user.role,
        verified_scope=SCOPE_CONTRIBUTIONS_WRITE,
    )


@router.get(
    "/scopes/requests-write",
    response_model=ScopeCheckResponse,
    summary="Verify Student/Admin scope requests:write (FR-02 & NFR-03)",
)
def verify_requests_write_scope(
    current_user: object = Security(get_current_user, scopes=[SCOPE_REQUESTS_WRITE]),
) -> ScopeCheckResponse:
    """Protected endpoint verifying that the caller holds `requests:write` scope."""
    user = UserRead.model_validate(current_user)
    return ScopeCheckResponse(
        authorized=True,
        user_id=user.id,
        role=user.role,
        verified_scope=SCOPE_REQUESTS_WRITE,
    )
