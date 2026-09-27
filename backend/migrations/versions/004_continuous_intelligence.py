"""Add continuous project intelligence state."""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
revision: str = "004_continuous_intelligence"
down_revision: Union[str, None] = "003_task_intelligence_metadata"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("projects", sa.Column("automation_mode", sa.String(20), nullable=False, server_default="suggest"))
    op.create_table("project_intelligence_snapshots", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False), sa.Column("context_hash", sa.String(64), nullable=False), sa.Column("context_json", sa.Text(), nullable=False), sa.Column("analysis_json", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_intelligence_snapshots_project_created", "project_intelligence_snapshots", ["project_id", "created_at"])
    op.create_table("task_update_proposals", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False), sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False), sa.Column("proposed_status", sa.String(50), nullable=False, server_default="done"), sa.Column("reason", sa.Text(), nullable=False), sa.Column("evidence_json", sa.Text(), nullable=False, server_default="[]"), sa.Column("confidence", sa.Float(), nullable=False), sa.Column("status", sa.String(20), nullable=False, server_default="pending"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_task_update_proposals_project", "task_update_proposals", ["project_id"])
    op.create_index("ix_task_update_proposals_status", "task_update_proposals", ["status"])

def downgrade() -> None:
    op.drop_table("task_update_proposals")
    op.drop_table("project_intelligence_snapshots")
    op.drop_column("projects", "automation_mode")