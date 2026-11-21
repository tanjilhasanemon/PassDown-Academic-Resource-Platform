import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.config import settings
from core.database import Base, SessionLocal, engine
from core.security import hash_password
from models.app_user import AppUser


def seed_admin_user(db: Session) -> AppUser:
    """Create or ensure the initial admin account exists idempotently (FR-41, AC-27)."""
    email = settings.admin_email.strip().lower()
    existing = db.scalar(select(AppUser).where(AppUser.email == email))
    if existing:
        if existing.role != "admin" or not existing.is_active:
            existing.role = "admin"
            existing.is_active = True
            db.commit()
            db.refresh(existing)
        return existing

    admin = AppUser(
        name=settings.admin_name.strip(),
        email=email,
        password_hash=hash_password(settings.admin_password),
        role="admin",
        is_active=True,
        failed_attempts=0,
        locked_until=None,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def seed_demo_student(db: Session) -> AppUser:
    """Ensure a default demo student account exists for testing and evaluation."""
    email = "student@passdown.edu"
    existing = db.scalar(select(AppUser).where(AppUser.email == email))
    if existing:
        return existing

    student = AppUser(
        name="Tanjil Hasan Emon",
        email=email,
        password_hash=hash_password("Student1234"),
        role="student",
        is_active=True,
        failed_attempts=0,
        locked_until=None,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        admin = seed_admin_user(session)
        student = seed_demo_student(session)
        print(f"Admin ready: {admin.email} (id={admin.id}, role={admin.role})")
        print(f"Demo student ready: {student.email} (id={student.id}, role={student.role})")


if __name__ == "__main__":
    main()
