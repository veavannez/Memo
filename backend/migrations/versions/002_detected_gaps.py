"""Persist reviewable detected gaps.

Revision ID: 002_detected_gaps
Revises: 001_initial
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_detected_gaps"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "detected_gaps",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_key", sa.String(64), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("evidence_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("created_task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "source_key", name="uq_detected_gaps_project_source"),
    )
    op.create_index("ix_detected_gaps_project_id", "detected_gaps", ["project_id"])
    op.create_index("ix_detected_gaps_status", "detected_gaps", ["status"])


def downgrade() -> None:
    op.drop_index("ix_detected_gaps_status", table_name="detected_gaps")
    op.drop_index("ix_detected_gaps_project_id", table_name="detected_gaps")
    op.drop_table("detected_gaps")