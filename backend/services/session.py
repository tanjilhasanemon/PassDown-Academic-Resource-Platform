"""Session — Business Logic Service (ECB Control Layer)."""
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from core.audit import get_client_ip, parse_browser_label
from core.config import settings
from core.security import create_access_token, generate_refresh_token, hash_refresh_token
from models.app_user import AppUser
from models.user_session import UserSession
from schemas.auth import TokenResponse


def _utc_now() -> datetime:
    """Executes `utc now` operation."""
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    """Executes `as utc` operation."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class SessionService:
    """Represents `SessionService` in the PassDown backend."""
    @staticmethod
    def create_session(db: Session, user: AppUser, request: Request | None = None) -> tuple[UserSession, str]:
        """Executes `create session` operation."""
        raw_refresh = generate_refresh_token()
        now = _utc_now()
        sess = UserSession(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            ip_address=get_client_ip(request) if request else None,
            browser=parse_browser_label(request.headers.get("user-agent")) if request else None,
            created_at=now,
            last_used_at=now,
            expires_at=now + timedelta(days=settings.refresh_expire_days),
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)
        return sess, raw_refresh

    @staticmethod
    def rotate_session(db: Session, raw_refresh: str, request: Request | None = None) -> TokenResponse:
        """Executes `rotate session` operation."""
        if not raw_refresh:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
        digest = hash_refresh_token(raw_refresh)
        sess = db.query(UserSession).filter(UserSession.token_hash == digest).first()
        now = _utc_now()
        if not sess or sess.revoked_at is not None or _as_utc(sess.expires_at) <= now:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or expired")

        user = db.query(AppUser).filter(AppUser.id == sess.user_id).first()
        if not user or not user.is_active:
            sess.revoked_at = now
            db.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account inactive or banned")

        new_raw = generate_refresh_token()
        sess.token_hash = hash_refresh_token(new_raw)
        sess.last_used_at = now
        sess.expires_at = now + timedelta(days=settings.refresh_expire_days)
        if request:
            sess.ip_address = get_client_ip(request)
            sess.browser = parse_browser_label(request.headers.get("user-agent"))
        db.commit()

        access_token = create_access_token(user_id=user.id, role=user.role)
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            refresh_token=new_raw,
            session_id=sess.id,
        )

    @staticmethod
    def revoke_by_raw_token(db: Session, raw_refresh: str | None) -> AppUser | None:
        """Executes `revoke by raw token` operation."""
        if not raw_refresh:
            return None
        digest = hash_refresh_token(raw_refresh)
        sess = db.query(UserSession).filter(UserSession.token_hash == digest).first()
        if not sess:
            return None
        if sess.revoked_at is None:
            sess.revoked_at = _utc_now()
            db.commit()
        return db.query(AppUser).filter(AppUser.id == sess.user_id).first()

    @staticmethod
    def list_user_sessions(db: Session, user_id: int) -> list[UserSession]:
        """Executes `list user sessions` operation."""
        return (
            db.query(UserSession)
            .filter(UserSession.user_id == user_id)
            .order_by(UserSession.last_used_at.desc())
            .limit(20)
            .all()
        )

    @staticmethod
    def revoke_user_session(db: Session, user_id: int, session_id: int) -> None:
        """Executes `revoke user session` operation."""
        sess = db.query(UserSession).filter(UserSession.id == session_id).first()
        if not sess:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        if sess.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot revoke another user's session")
        sess.revoked_at = _utc_now()
        db.commit()
