"""
Pydantic schemas for API request/response validation.
Separated from SQLModel table models to keep API contracts explicit.
"""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, field_validator, field_serializer
from app.models.models import ProjectRole, TaskStatus, TaskPriority


# ─────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserRead"


class GitHubCallbackRequest(BaseModel):
    code: str
    state: str


# ─────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────

class UserRead(BaseModel):
    id: int
    display_name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    github_login: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None


# ─────────────────────────────────────────────
# GitHub
# ─────────────────────────────────────────────

class InstallationRead(BaseModel):
    id: int
    installation_id: int
    account_login: str
    account_type: str
    account_avatar_url: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class RepositoryRead(BaseModel):
    id: int
    github_repo_id: int
    full_name: str
    name: str
    owner_login: str
    is_private: bool
    default_branch: str
    html_url: Optional[str] = None
    installation_id: int

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Projects
# ─────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    repository_id: int


class ProjectRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    repository_id: int
    repository: Optional[RepositoryRead] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ─────────────────────────────────────────────
# Project Members
# ─────────────────────────────────────────────

class ProjectMemberRead(BaseModel):
    id: int
    project_id: int
    user_id: int
    role: str
    joined_at: datetime
    user: Optional[UserRead] = None

    class Config:
        from_attributes = True


class ProjectMemberInvite(BaseModel):
    github_login: str
    role: str = ProjectRole.member


class ProjectMemberUpdate(BaseModel):
    role: str


# ─────────────────────────────────────────────
# Memos
# ─────────────────────────────────────────────

class MemoCreate(BaseModel):
    completed: Optional[str] = None
    in_progress: Optional[str] = None
    blocked: Optional[str] = None
    next_steps: Optional[str] = None
    notes: Optional[str] = None
    is_draft: bool = False


class MemoUpdate(BaseModel):
    completed: Optional[str] = None
    in_progress: Optional[str] = None
    blocked: Optional[str] = None
    next_steps: Optional[str] = None
    notes: Optional[str] = None
    is_draft: Optional[bool] = None


class MemoGitHubActivityRead(BaseModel):
    id: int
    activity_type: str
    github_id: str
    title: Optional[str] = None
    url: Optional[str] = None
    author_login: Optional[str] = None
    occurred_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MemoRead(BaseModel):
    id: int
    project_id: int
    author_id: int
    author: Optional[UserRead] = None
    completed: Optional[str] = None
    in_progress: Optional[str] = None
    blocked: Optional[str] = None
    next_steps: Optional[str] = None
    notes: Optional[str] = None
    is_draft: bool
    github_activities: List[MemoGitHubActivityRead] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Tasks
# ─────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    assignee_id: Optional[int] = None
    source_memo_id: Optional[int] = None
    github_issue_url: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    assignee_id: Optional[int] = None
    github_issue_url: Optional[str] = None
    position: Optional[int] = None


class TaskRead(BaseModel):
    id: int
    project_id: int
    source_memo_id: Optional[int] = None
    assignee_id: Optional[int] = None
    assignee: Optional[UserRead] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    github_issue_url: Optional[str] = None
    source_type: Optional[str] = None
    source_gap_id: Optional[int] = None
    source_evidence: List[str] = []
    ai_generated: bool = False
    assignment_reason: Optional[str] = None
    assignment_confidence: Optional[float] = None
    position: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskFromNextSteps(BaseModel):
    """Convert Memo next_steps into one or more tasks."""
    next_steps: List[str]  # Each line becomes a task
    assignee_id: Optional[int] = None
    priority: TaskPriority = TaskPriority.medium


# ─────────────────────────────────────────────
# Catch Me Up
# ─────────────────────────────────────────────

class BriefingEvidence(BaseModel):
    type: str
    label: str
    url: Optional[str] = None


class BriefingItem(BaseModel):
    title: str
    detail: Optional[str] = None
    tone: str = "neutral"
    evidence: List[BriefingEvidence] = []


class TeamBriefing(BaseModel):
    name: str
    login: Optional[str] = None
    summary: str
    evidence: List[BriefingEvidence] = []

class CatchMeUpResponse(BaseModel):
    user: UserRead
    last_session_memo: Optional[MemoRead] = None
    my_open_tasks: List[TaskRead] = []
    my_blocked_tasks: List[TaskRead] = []
    team_memos_since_last: List[MemoRead] = []
    recent_github_activity: List[MemoGitHubActivityRead] = []
    suggested_next_steps: List[str] = []
    summary_lines: List[str] = []
    briefing_summary: Optional[str] = None
    what_changed: List[BriefingItem] = []
    team_activity: List[TeamBriefing] = []
    attention_items: List[BriefingItem] = []
    next_step: Optional[BriefingItem] = None
    compared_from: Optional[str] = None
    generated_at: Optional[str] = None


# ─────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────

class TeamMemberStatus(BaseModel):
    user: UserRead
    role: str
    latest_memo: Optional[MemoRead] = None
    current_task: Optional[TaskRead] = None
    open_tasks_count: int = 0
    blocked_tasks_count: int = 0


class DashboardResponse(BaseModel):
    project: ProjectRead
    team: List[TeamMemberStatus] = []
    recent_memos: List[MemoRead] = []
    recent_tasks: List[TaskRead] = []


# ─────────────────────────────────────────────
# watsonx.ai Intelligence
# ─────────────────────────────────────────────

class EvidencedItem(BaseModel):
    """A project-state item grounded in evidence with a confidence score."""
    title: str
    evidence: List[str] = []
    confidence: float = 0.5
    reason: Optional[str] = None


class DetectedGap(BaseModel):
    """A potential gap grounded in observed development evidence."""
    title: str
    description: str
    reason: str
    confidence: float
    evidence: List[str] = []
    id: Optional[int] = None
    category: str = "IMPLEMENTATION"
    status: str = "active"
    created_task_id: Optional[int] = None


class DetectedGapUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


class DetectedGapTaskCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: str = "medium"
    status: TaskStatus = TaskStatus.todo
    assignee_id: Optional[int] = None
    assignment_reason: Optional[str] = None
    assignment_confidence: Optional[float] = None


class GapTaskSuggestion(BaseModel):
    title: str
    description: str
    priority: str = "medium"
    status: str = "todo"
    repository: str
    related_pr: Optional[str] = None
    evidence: List[str] = []
    suggested_owner_id: Optional[int] = None
    suggested_owner_name: Optional[str] = None
    suggested_owner_login: Optional[str] = None
    assignment_reason: str
    assignment_confidence: float = 0.0


class SuggestedNextStep(BaseModel):
    title: str
    description: str
    confidence: float
    evidence: List[str] = []

class ProjectState(BaseModel):
    completed: List[EvidencedItem] = []
    inProgress: List[EvidencedItem] = []
    blocked: List[EvidencedItem] = []


class ProjectAnalysisResponse(BaseModel):
    """Full project intelligence analysis from watsonx.ai."""
    projectState: ProjectState
    detectedGaps: List[DetectedGap] = []
    suggestedNextSteps: List[SuggestedNextStep] = []
    generatedAt: str
    modelId: str
    isFallback: bool = False
    # True when watsonx.ai is not configured
    aiAvailable: bool = True


class IntelligenceChange(BaseModel):
    kind: str
    title: str
    description: str
    evidence: List[str] = []
    tone: str = "positive"


class TaskUpdateProposalRead(BaseModel):
    id: int
    task_id: int
    task_title: str
    proposed_status: str
    reason: str
    evidence: List[str] = []
    confidence: float
    status: str


class ProjectRefreshResponse(BaseModel):
    analysis: ProjectAnalysisResponse
    changes: List[IntelligenceChange] = []
    taskProposals: List[TaskUpdateProposalRead] = []
    automationMode: str
    previousSnapshotAt: Optional[str] = None
    refreshedAt: str
    baselineCreated: bool = False


class AutomationModeUpdate(BaseModel):
    mode: str

class HandoffSynthesisRequest(BaseModel):
    completed: Optional[str] = None
    in_progress: Optional[str] = None
    blocked: Optional[str] = None
    next_steps: Optional[str] = None
    notes: Optional[str] = None

class GeneratedMemoContent(BaseModel):
    """AI-generated memo fields — validated before use."""
    completed: Optional[str] = None
    in_progress: Optional[str] = None
    blocked: Optional[str] = None
    next_steps: Optional[str] = None
    notes: Optional[str] = None
    generatedAt: str
    isFallback: bool = False


class CatchUpAIEnrichment(BaseModel):
    """AI enrichment for the Catch Me Up view."""
    whileYouWereAway: str
    whatChanged: List[str] = []
    whatNeedsAttention: List[str] = []
    yourNextStep: str
    confidence: float
    generatedAt: str
    isFallback: bool = False


class TaskAssignmentSuggestion(BaseModel):
    task_id: Any  # can be int or string depending on source
    suggested_assignee: Optional[str] = None
    reason: str
    confidence: float
    evidence: List[str] = []


class WatsonxStatusResponse(BaseModel):
    available: bool
    model_id: str
    project_id_set: bool
    api_key_set: bool


# ─────────────────────────────────────────────
# Error
# ─────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
