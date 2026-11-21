"""Audit — Core Configuration & Security (ECB Control Layer)."""
from fastapi import Request
from sqlalchemy.orm import Session

from models.audit_log import AuditLog


def get_client_ip(request: Request | None) -> str:
    """Executes `get client ip` operation."""
    if request is None:
        return "127.0.0.1"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return "unknown"


def parse_browser_label(raw_ua: str | None) -> str:
    """Executes `parse browser label` operation."""
    if not raw_ua:
        return "Unknown Client"
    ua = raw_ua.lower()
    if "postman" in ua:
        return "Postman"
    if "curl" in ua:
        return "cURL"
    if "python" in ua or "httpx" in ua:
        return "Python Client"

    browser = "Browser"
    if "edg/" in ua:
        browser = "Edge"
    elif "chrome/" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua and "chrome/" not in ua:
        browser = "Safari"

    os_name = ""
    if "windows" in ua:
        os_name = "Windows"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"

    return f"{browser} · {os_name}" if os_name else browser


def record_audit(
    db: Session,
    *,
    action: str,
    user: object | None = None,
    user_email: str | None = None,
    user_id: int | None = None,
    details: str | None = None,
    request: Request | None = None,
    is_security_event: bool = False,
) -> None:
    """Persist an activity or security audit log entry safely without breaking the primary request."""
    if user is not None:
        user_id = user_id or getattr(user, 'id', None)
        user_email = user_email or getattr(user, 'email', None)
    try:
        raw_ua = request.headers.get("user-agent") if request else None
        entry = AuditLog(
            user_id=user_id,
            user_email=user_email.strip().lower()[:254],
            action=action[:60],
            details=details[:500] if details else None,
            ip_address=get_client_ip(request),
            user_agent=parse_browser_label(raw_ua),
            is_security_event=is_security_event,
        )
        db.add(entry)
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[PassDown] Audit log skipped ({exc})")
