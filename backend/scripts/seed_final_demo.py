"""Idempotent final-submission demo seeder:
- 2 Admin accounts (admin@passdown.edu, admin2@passdown.edu)
- 3 Student accounts (student@passdown.edu, student2@passdown.edu, student3@passdown.edu)
- 1 Shared Study Group ('CSE309 Final Defence Study Group') with mixed member permissions
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from core.database import SessionLocal, init_db
from core.security import hash_password
from models.app_user import AppUser
from models.study_group import StudyGroup, StudyGroupMember, StudyGroupResource

DEMO_USERS = [
    ("PassDown Admin", "admin@passdown.edu", "Admin1234", "admin"),
    ("Academic Moderator", "admin2@passdown.edu", "Admin1234", "admin"),
    ("Rafiqul Islam", "student@passdown.edu", "Student1234", "student"),
    ("Sadia Rahman", "student2@passdown.edu", "Student1234", "student"),
    ("Mehedi Hasan", "student3@passdown.edu", "Student1234", "student"),
]


def ensure_final_demo_data(db: Session | None = None) -> None:
    owns_session = db is None
    if db is None:
        init_db()
        db = SessionLocal()
    try:
        users_by_email: dict[str, AppUser] = {}
        for name, email, raw_pw, role in DEMO_USERS:
            user = db.query(AppUser).filter(AppUser.email == email).first()
            if not user:
                user = AppUser(
                    name=name,
                    email=email,
                    password_hash=hash_password(raw_pw),
                    role=role,
                    is_active=True,
                )
                db.add(user)
                db.flush()
            users_by_email[email] = user

        owner = users_by_email["student@passdown.edu"]
        editor = users_by_email["student2@passdown.edu"]
        assigner = users_by_email["student3@passdown.edu"]

        group_name = "CSE309 Final Defence Study Group"
        group = db.query(StudyGroup).filter(StudyGroup.name == group_name).first()
        if not group:
            now = datetime.now(timezone.utc)
            group = StudyGroup(
                name=group_name,
                course_code="CSE309",
                description="Shared final-exam prep archive with mixed member permissions (Create/Edit vs Assign-only).",
                owner_id=owner.id,
                created_at=now,
                updated_at=now,
            )
            db.add(group)
            db.flush()

            # Member 1: Can Create + Edit, CANNOT Assign
            db.add(
                StudyGroupMember(
                    group_id=group.id,
                    user_id=editor.id,
                    can_create=True,
                    can_edit=True,
                    can_assign=False,
                )
            )
            # Member 2: Can Assign ONLY (cannot Create or Edit)
            db.add(
                StudyGroupMember(
                    group_id=group.id,
                    user_id=assigner.id,
                    can_create=False,
                    can_edit=False,
                    can_assign=True,
                )
            )
            # Sample shared resources
            db.add(
                StudyGroupResource(
                    group_id=group.id,
                    title="FastAPI JWT & Refresh Token Rotation Notes",
                    url="https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/",
                    resource_type="notes",
                    notes="Covers 15-min access tokens, Argon2id pepper, and session revocation.",
                    status="open",
                    created_by_id=owner.id,
                    assigned_to_id=editor.id,
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(
                StudyGroupResource(
                    group_id=group.id,
                    title="SQLAlchemy 2.0 RBAC & Query Optimization Cheat Sheet",
                    url="https://docs.sqlalchemy.org/en/20/orm/quickstart.html",
                    resource_type="slides",
                    notes="Summary of relational constraints and cascade rules.",
                    status="done",
                    created_by_id=editor.id,
                    assigned_to_id=assigner.id,
                    created_at=now,
                    updated_at=now,
                )
            )

        db.commit()
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    ensure_final_demo_data()
    print("Seeded 2 admins, 3 students, and 1 mixed-permission Study Group successfully.")
