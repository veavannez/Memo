"""Add intelligence provenance to tasks.

Revision ID: 003_task_intelligence_metadata
Revises: 002_detected_gaps
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003_task_intelligence_metadata"
down_revision: Union[str, None] = "002_detected_gaps"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("source_type", sa.String(50), nullable=True))
    op.add_column("tasks", sa.Column("source_gap_id", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("source_evidence_json", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("tasks", sa.Column("ai_generated", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("tasks", sa.Column("assignment_reason", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("assignment_confidence", sa.Float(), nullable=True))
    op.create_index("ix_tasks_source_gap_id", "tasks", ["source_gap_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_source_gap_id", table_name="tasks")
    for column in ("assignment_confidence", "assignment_reason", "ai_generated", "source_evidence_json", "source_gap_id", "source_type"):
        op.drop_column("tasks", column)