"""Add app_user table and nullable author_id columns to contribution and request

Revision ID: 0002_beta_auth
Revises: 0001_mvp_initial
Create Date: 2026-11-10 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_beta_auth"
down_revision: Union[str, None] = "0001_mvp_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_user",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("role", sa.String(length=20), server_default="student", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_app_user_email", "app_user", ["email"], unique=True)

    with op.batch_alter_table("contribution") as batch_op:
        batch_op.add_column(sa.Column("author_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_contribution_author_id", ["author_id"])
        batch_op.create_foreign_key(
            "fk_contribution_author_id_app_user",
            "app_user",
            ["author_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("request") as batch_op:
        batch_op.add_column(sa.Column("author_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_request_author_id", ["author_id"])
        batch_op.create_foreign_key(
            "fk_request_author_id_app_user",
            "app_user",
            ["author_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("request") as batch_op:
        batch_op.drop_constraint("fk_request_author_id_app_user", type_="foreignkey")
        batch_op.drop_index("ix_request_author_id")
        batch_op.drop_column("author_id")

    with op.batch_alter_table("contribution") as batch_op:
        batch_op.drop_constraint("fk_contribution_author_id_app_user", type_="foreignkey")
        batch_op.drop_index("ix_contribution_author_id")
        batch_op.drop_column("author_id")

    op.drop_table("app_user")
