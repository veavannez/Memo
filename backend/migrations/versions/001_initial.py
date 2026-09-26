"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), nullable=True, unique=True),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # github_accounts
    op.create_table(
        "github_accounts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("github_user_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("github_login", sa.String(255), nullable=False),
        sa.Column("access_token_enc", sa.Text(), nullable=True),
        sa.Column("token_scope", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # github_installations
    op.create_table(
        "github_installations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("installation_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("account_login", sa.String(255), nullable=False),
        sa.Column("account_type", sa.String(50), nullable=False),
        sa.Column("account_avatar_url", sa.Text(), nullable=True),
        sa.Column("installer_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_github_installations_installation_id", "github_installations", ["installation_id"])
    op.create_index("ix_github_installations_account_login", "github_installations", ["account_login"])

    # repositories
    op.create_table(
        "repositories",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("installation_id", sa.Integer(), sa.ForeignKey("github_installations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("github_repo_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(512), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("owner_login", sa.String(255), nullable=False),
        sa.Column("is_private", sa.Boolean(), nullable=False, default=False),
        sa.Column("default_branch", sa.String(255), nullable=False, default="main"),
        sa.Column("html_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("github_repo_id", name="uq_repositories_github_repo_id"),
    )
    op.create_index("ix_repositories_installation_id", "repositories", ["installation_id"])
    op.create_index("ix_repositories_full_name", "repositories", ["full_name"])

    # projects
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("repository_id", sa.Integer(), sa.ForeignKey("repositories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_projects_repository_id", "projects", ["repository_id"])

    # project_members
    op.create_table(
        "project_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, default="member"),
        sa.Column("invited_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )
    op.create_index("ix_project_members_project_id", "project_members", ["project_id"])
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])

    # memos
    op.create_table(
        "memos",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed", sa.Text(), nullable=True),
        sa.Column("in_progress", sa.Text(), nullable=True),
        sa.Column("blocked", sa.Text(), nullable=True),
        sa.Column("next_steps", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_draft", sa.Boolean(), nullable=False, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_memos_project_id", "memos", ["project_id"])
    op.create_index("ix_memos_author_id", "memos", ["author_id"])
    op.create_index("ix_memos_created_at", "memos", ["created_at"])

    # memo_github_activity
    op.create_table(
        "memo_github_activity",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("memo_id", sa.Integer(), sa.ForeignKey("memos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("activity_type", sa.String(50), nullable=False),
        sa.Column("github_id", sa.String(255), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("author_login", sa.String(255), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_data", sa.Text(), nullable=True),
    )
    op.create_index("ix_memo_github_activity_memo_id", "memo_github_activity", ["memo_id"])

    # tasks
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_memo_id", sa.Integer(), sa.ForeignKey("memos.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assignee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, default="todo"),
        sa.Column("priority", sa.String(50), nullable=False, default="medium"),
        sa.Column("github_issue_url", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_source_memo_id", "tasks", ["source_memo_id"])

    # github_events
    op.create_table(
        "github_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("delivery_id", sa.String(255), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("action", sa.String(100), nullable=True),
        sa.Column("installation_id", sa.Integer(), nullable=True),
        sa.Column("repository_full_name", sa.String(512), nullable=True),
        sa.Column("processed", sa.Boolean(), nullable=False, default=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("delivery_id", name="uq_github_events_delivery_id"),
    )
    op.create_index("ix_github_events_delivery_id", "github_events", ["delivery_id"])
    op.create_index("ix_github_events_installation_id", "github_events", ["installation_id"])
    op.create_index("ix_github_events_received_at", "github_events", ["received_at"])


def downgrade() -> None:
    op.drop_table("github_events")
    op.drop_table("tasks")
    op.drop_table("memo_github_activity")
    op.drop_table("memos")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("repositories")
    op.drop_table("github_installations")
    op.drop_table("github_accounts")
    op.drop_table("users")
