"""Auth — FastAPI Dependency Injection (ECB Boundary Layer)."""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import SCOPE_DESCRIPTIONS, decode_access_token
from models.app_user import AppUser
from repositories.user import UserRepository

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    scopes=SCOPE_DESCRIPTIONS,
)


def get_current_user(
    security_scopes: SecurityScopes,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AppUser:
    """Verify JWT, confirm user is active in DB, and enforce FastAPI SecurityScopes (TDD §6.3)."""
    authenticate_value = (
        f'Bearer scope="{security_scopes.scope_str}"'
        if security_scopes.scopes
        else "Bearer"
    )
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": authenticate_value},
    )

    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
        scope_str = str(payload.get("scope", ""))
        token_scopes = set(scope_str.split()) if scope_str else set()
    except (jwt.PyJWTError, ValueError, TypeError):
        raise credentials_exception

    # Load user on every request so deactivated accounts stop working immediately (FR-40, AC-25)
    user = UserRepository.get_by_id(db, user_id)
    if not user or not user.is_active:
        raise credentials_exception

    for required_scope in security_scopes.scopes:
        if required_scope not in token_scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions for this action",
                headers={"WWW-Authenticate": authenticate_value},
            )

    return user
