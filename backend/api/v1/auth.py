"""Auth — FastAPI HTTP Router (ECB Boundary Layer)."""
from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from core.audit import record_audit
from core.config import settings
from core.database import get_db
from models.app_user import AppUser
from schemas.auth import RefreshRequest, RegisterRequest, TokenResponse
from schemas.user import UserRead
from services.auth import AuthService
from services.session import SessionService

router = APIRouter(prefix="/auth", tags=["Authentication"])
REFRESH_COOKIE = "passdown_refresh_token"


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    """Executes `set refresh cookie` operation."""
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw_token,
        httponly=True,
        samesite="lax",
        secure=True,
        max_age=settings.refresh_expire_days * 86400,
        path="/api/v1/auth",
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(
    request: Request,
    data: RegisterRequest,
    db: Session = Depends(get_db),
) -> UserRead:
    """Executes `register user` operation."""
    user = AuthService.register(db, data)
    record_audit(db, action="register", user=user, details="Registered new account", request=request)
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenResponse)
def login_user(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Executes `login user` operation."""
    try:
        token_res = AuthService.login(db, email=form_data.username, password=form_data.password)
    except Exception:
        record_audit(
            db,
            action="login_failed",
            user_email=form_data.username.strip().lower(),
            details="Invalid credentials or locked account",
            request=request,
        )
        raise

    user = db.query(AppUser).filter(AppUser.email == form_data.username.strip().lower()).first()
    if user:
        sess, raw_refresh = SessionService.create_session(db, user, request=request)
        _set_refresh_cookie(response, raw_refresh)
        token_res.refresh_token = raw_refresh
        token_res.session_id = sess.id
        record_audit(db, action="login", user=user, details=f"Signed in ({user.role})", request=request)
    return token_res


@router.post("/refresh", response_model=TokenResponse)
def refresh_access_token(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Executes `refresh access token` operation."""
    raw_token = (payload.refresh_token if payload and payload.refresh_token else None) or request.cookies.get(REFRESH_COOKIE)
    token_res = SessionService.rotate_session(db, raw_token or "", request=request)
    if token_res.refresh_token:
        _set_refresh_cookie(response, token_res.refresh_token)
    return token_res


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_user(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = None,
    db: Session = Depends(get_db),
) -> Response:
    """Executes `logout user` operation."""
    raw_token = (payload.refresh_token if payload and payload.refresh_token else None) or request.cookies.get(REFRESH_COOKIE)
    user = SessionService.revoke_by_raw_token(db, raw_token)
    response.delete_cookie(key=REFRESH_COOKIE, path="/api/v1/auth")
    if user:
        record_audit(db, action="logout", user=user, details="Signed out and revoked session", request=request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
