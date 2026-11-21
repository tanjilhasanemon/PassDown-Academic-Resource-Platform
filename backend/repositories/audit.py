"""Audit — Data-Access Repository (ECB Entity Layer)."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from models.app_user import AppUser
from models.audit_log import AuditLog
from schemas.audit import (
    SecurityAccountSummary,
    SecurityIpSummary,
    SecurityOverviewRead,
)


def _as_utc(dt: datetime) -> datetime:
    """Executes `as utc` operation."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AuditRepository:
    """Represents `AuditRepository` in the PassDown backend."""
    @staticmethod
    def list_activity(
        db: Session,
        q: str | None = None,
        user_email: str | None = None,
        action: str | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        """Executes `list activity` operation."""
        filters = []
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            filters.append(
                or_(
                    AuditLog.user_email.ilike(pattern),
                    AuditLog.details.ilike(pattern),
                    AuditLog.ip_address.ilike(pattern),
                    AuditLog.action.ilike(pattern),
                )
            )
        if user_email and user_email.strip():
            filters.append(AuditLog.user_email == user_email.strip().lower())
        if action and action.strip():
            filters.append(AuditLog.action == action.strip())
        if from_dt is not None:
            filters.append(AuditLog.created_at >= _as_utc(from_dt))
        if to_dt is not None:
            filters.append(AuditLog.created_at <= _as_utc(to_dt))

        count_stmt = select(func.count()).select_from(AuditLog)
        stmt = select(AuditLog)
        if filters:
            count_stmt = count_stmt.where(*filters)
            stmt = stmt.where(*filters)

        total = db.scalar(count_stmt) or 0
        items = list(
            db.scalars(
                stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
                .limit(limit)
                .offset(offset)
            ).all()
        )
        return items, int(total)

    @staticmethod
    def list_distinct_filters(db: Session) -> dict[str, list[str]]:
        """Executes `list distinct filters` operation."""
        users = list(
            db.scalars(
                select(AuditLog.user_email).distinct().order_by(AuditLog.user_email.asc())
            ).all()
        )
        actions = list(
            db.scalars(
                select(AuditLog.action).distinct().order_by(AuditLog.action.asc())
            ).all()
        )
        return {"users": users, "actions": actions}

    @staticmethod
    def purge_older_than(db: Session, older_than_days: int) -> int:
        """Executes `purge older than` operation."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        result = db.execute(delete(AuditLog).where(AuditLog.created_at < cutoff))
        db.commit()
        return int(result.rowcount or 0)

    @staticmethod
    def get_security_overview(
        db: Session,
        min_failures: int = 3,
        hours: int = 24,
    ) -> SecurityOverviewRead:
        """Executes `get security overview` operation."""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=hours)

        events = list(
            db.scalars(
                select(AuditLog)
                .where(
                    or_(AuditLog.is_security_event.is_(True), AuditLog.action.in_(["login_failed", "login_locked", "password_change_failed"])),
                    AuditLog.created_at >= cutoff,
                )
                .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            ).all()
        )

        # Group by IP address
        ip_groups: dict[str, list[AuditLog]] = defaultdict(list)
        acc_groups: dict[str, list[AuditLog]] = defaultdict(list)
        for ev in events:
            ip_groups[ev.ip_address].append(ev)
            acc_groups[ev.user_email].append(ev)

        by_ip: list[SecurityIpSummary] = []
        for ip, rows in ip_groups.items():
            if len(rows) < min_failures:
                continue
            actions = sorted({r.action.replace("_", " ") for r in rows})
            emails = sorted({r.user_email for r in rows})
            by_ip.append(
                SecurityIpSummary(
                    ip_address=ip,
                    failures=len(rows),
                    what_happened=", ".join(actions),
                    emails_tried=emails,
                    browser=rows[0].user_agent or "Unknown",
                    last_seen=rows[0].created_at,
                )
            )
        by_ip.sort(key=lambda x: x.failures, reverse=True)

        # Map users for live status (Active / Locked / Deactivated)
        emails_list = list(acc_groups.keys())
        user_map: dict[str, AppUser] = {}
        if emails_list:
            users = list(
                db.scalars(select(AppUser).where(AppUser.email.in_(emails_list))).all()
            )
            user_map = {u.email: u for u in users}

        by_account: list[SecurityAccountSummary] = []
        for email, rows in acc_groups.items():
            if len(rows) < min_failures:
                continue
            u = user_map.get(email)
            acc_status = "Unknown"
            if u is not None:
                locked_until = _as_utc(u.locked_until) if u.locked_until else None
                if not u.is_active:
                    acc_status = "Deactivated"
                elif locked_until and locked_until > now:
                    acc_status = "Locked"
                else:
                    acc_status = "Active"
            ips = sorted({r.ip_address for r in rows})
            by_account.append(
                SecurityAccountSummary(
                    user_id=u.id if u else None,
                    email=email,
                    status=acc_status,
                    failures=len(rows),
                    from_addresses=ips,
                    browser=rows[0].user_agent or "Unknown",
                    last_seen=rows[0].created_at,
                )
            )
        by_account.sort(key=lambda x: x.failures, reverse=True)

        return SecurityOverviewRead(
            min_failures=min_failures,
            hours=hours,
            by_ip=by_ip,
            by_account=by_account,
        )
