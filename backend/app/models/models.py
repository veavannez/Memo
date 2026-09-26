"""
MEMO Database Models
All models use SQLModel which unifies SQLAlchemy + Pydantic.
"""
from datetime import datetime, timezone
from typing import Optional, List
from sqlmodel import Field, Relationship, SQLModel, Column
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy import Enum as SAEnum
import enum
import uuid


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class ProjectRole(str, enum.Enum):
    owner = "owner"
    member = "member"


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    blocked = "blocked"
    done = "done"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class GitHubEventType(str, enum.Enum):
    push = "push"
    pull_request = "pull_request"
    issues = "issues"
    installation = "installation"
    installation_repositories = "installation_repositories"
    other = "other"


# ─────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: Optional[str] = Field(default=None, sa_column=Column(String(255), unique=True, nullable=True))
    display_name: str = Field(sa_column=Column(String(255), nullable=False))
    avatar_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    is_active: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))

    # Relationships
    github_account: Optional["GitHubAccount"] = Relationship(back_populates="user")
    project_memberships: List["ProjectMember"] = Relationship(back_populates="user")
    memos: List["Memo"] = Relationship(back_populates="author")
    tasks: List["Task"] = Relationship(back_populates="assignee")


# ─────────────────────────────────────────────
# GitHub Accounts
# ─────────────────────────────────────────────

class GitHubAccount(SQLModel, table=True):
    __tablename__ = "github_accounts"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(sa_column=Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True))
    github_user_id: int = Field(sa_column=Column(Integer, nullable=False, unique=True))
    github_login: str = Field(sa_column=Column(String(255), nullable=False))
    # Short-lived OAuth token — encrypted at rest, refreshed as needed
    # We store it encrypted; None if revoked
    access_token_enc: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    token_scope: Optional[str] = Field(default=None, sa_column=Column(String(512), nullable=True))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))

    # Relationships
    user: Optional[User] = Relationship(back_populates="github_account")


# ─────────────────────────────────────────────
# GitHub App Installations
# ─────────────────────────────────────────────

class GitHubInstallation(SQLModel, table=True):
    __tablename__ = "github_installations"
    __table_args__ = (
        Index("ix_github_installations_installation_id", "installation_id"),
        Index("ix_github_installations_account_login", "account_login"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    installation_id: int = Field(sa_column=Column(Integer, nullable=False, unique=True))
    account_login: str = Field(sa_column=Column(String(255), nullable=False))
    account_type: str = Field(sa_column=Column(String(50), nullable=False))  # "User" or "Organization"
    account_avatar_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    # The MEMO user who installed the app (nullable — could be org install)
    installer_user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    is_active: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))

    # Relationships
    repositories: List["Repository"] = Relationship(back_populates="installation")


# ─────────────────────────────────────────────
# Repositories
# ─────────────────────────────────────────────

class Repository(SQLModel, table=True):
    __tablename__ = "repositories"
    __table_args__ = (
        UniqueConstraint("github_repo_id", name="uq_repositories_github_repo_id"),
        Index("ix_repositories_installation_id", "installation_id"),
        Index("ix_repositories_full_name", "full_name"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    installation_id: int = Field(sa_column=Column(Integer, ForeignKey("github_installations.id", ondelete="CASCADE"), nullable=False))
    github_repo_id: int = Field(sa_column=Column(Integer, nullable=False))
    full_name: str = Field(sa_column=Column(String(512), nullable=False))  # owner/repo
    name: str = Field(sa_column=Column(String(255), nullable=False))
    owner_login: str = Field(sa_column=Column(String(255), nullable=False))
    is_private: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    default_branch: str = Field(default="main", sa_column=Column(String(255), nullable=False, default="main"))
    html_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    is_active: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))

    # Relationships
    installation: Optional[GitHubInstallation] = Relationship(back_populates="repositories")
    projects: List["Project"] = Relationship(back_populates="repository")


# ─────────────────────────────────────────────
# Projects
# ─────────────────────────────────────────────

class Project(SQLModel, table=True):
    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_projects_repository_id", "repository_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    repository_id: int = Field(sa_column=Column(Integer, ForeignKey("repositories.id", ondelete="RESTRICT"), nullable=False))
    name: str = Field(sa_column=Column(String(255), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    is_active: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, default=True))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))

    # Relationships
    repository: Optional[Repository] = Relationship(back_populates="projects")
    members: List["ProjectMember"] = Relationship(back_populates="project")
    memos: List["Memo"] = Relationship(back_populates="project")
    tasks: List["Task"] = Relationship(back_populates="project")


# ─────────────────────────────────────────────
# Project Members
# ─────────────────────────────────────────────

class ProjectMember(SQLModel, table=True):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
        Index("ix_project_members_project_id", "project_id"),
        Index("ix_project_members_user_id", "user_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(sa_column=Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False))
    user_id: int = Field(sa_column=Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False))
    role: str = Field(default=ProjectRole.member, sa_column=Column(String(50), nullable=False, default="member"))
    invited_by_user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    joined_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))

    # Relationships
    project: Optional[Project] = Relationship(back_populates="members")
    user: Optional[User] = Relationship(
        back_populates="project_memberships",
        sa_relationship_kwargs={"foreign_keys": "[ProjectMember.user_id]"},
    )


# ─────────────────────────────────────────────
# Memos
# ─────────────────────────────────────────────

class Memo(SQLModel, table=True):
    __tablename__ = "memos"
    __table_args__ = (
        Index("ix_memos_project_id", "project_id"),
        Index("ix_memos_author_id", "author_id"),
        Index("ix_memos_created_at", "created_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(sa_column=Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False))
    author_id: int = Field(sa_column=Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False))
    completed: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    in_progress: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    blocked: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    next_steps: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    is_draft: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))

    # Relationships
    project: Optional[Project] = Relationship(back_populates="memos")
    author: Optional[User] = Relationship(back_populates="memos")
    github_activities: List["MemoGitHubActivity"] = Relationship(back_populates="memo")
    tasks: List["Task"] = Relationship(back_populates="source_memo")


# ─────────────────────────────────────────────
# Memo GitHub Activity
# ─────────────────────────────────────────────

class MemoGitHubActivity(SQLModel, table=True):
    __tablename__ = "memo_github_activity"
    __table_args__ = (
        Index("ix_memo_github_activity_memo_id", "memo_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    memo_id: int = Field(sa_column=Column(Integer, ForeignKey("memos.id", ondelete="CASCADE"), nullable=False))
    activity_type: str = Field(sa_column=Column(String(50), nullable=False))  # commit, pull_request, issue
    github_id: str = Field(sa_column=Column(String(255), nullable=False))  # SHA, PR number, issue number
    title: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    author_login: Optional[str] = Field(default=None, sa_column=Column(String(255), nullable=True))
    occurred_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    raw_data: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))  # JSON blob

    # Relationships
    memo: Optional[Memo] = Relationship(back_populates="github_activities")


# ─────────────────────────────────────────────
# Tasks
# ─────────────────────────────────────────────

class Task(SQLModel, table=True):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_project_id", "project_id"),
        Index("ix_tasks_assignee_id", "assignee_id"),
        Index("ix_tasks_status", "status"),
        Index("ix_tasks_source_memo_id", "source_memo_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(sa_column=Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False))
    source_memo_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("memos.id", ondelete="SET NULL"), nullable=True))
    assignee_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    title: str = Field(sa_column=Column(String(512), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    status: str = Field(default=TaskStatus.todo, sa_column=Column(String(50), nullable=False, default="todo"))
    priority: str = Field(default=TaskPriority.medium, sa_column=Column(String(50), nullable=False, default="medium"))
    github_issue_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    position: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))
    created_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))

    # Relationships
    project: Optional[Project] = Relationship(back_populates="tasks")
    source_memo: Optional[Memo] = Relationship(back_populates="tasks")
    assignee: Optional[User] = Relationship(back_populates="tasks")


# ─────────────────────────────────────────────
# GitHub Webhook Events (deduplication)
# ─────────────────────────────────────────────

class GitHubEvent(SQLModel, table=True):
    __tablename__ = "github_events"
    __table_args__ = (
        UniqueConstraint("delivery_id", name="uq_github_events_delivery_id"),
        Index("ix_github_events_delivery_id", "delivery_id"),
        Index("ix_github_events_installation_id", "installation_id"),
        Index("ix_github_events_received_at", "received_at"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    delivery_id: str = Field(sa_column=Column(String(255), nullable=False))  # X-GitHub-Delivery header
    event_type: str = Field(sa_column=Column(String(100), nullable=False))
    action: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True))
    installation_id: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True))
    repository_full_name: Optional[str] = Field(default=None, sa_column=Column(String(512), nullable=True))
    processed: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    received_at: datetime = Field(default_factory=utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
