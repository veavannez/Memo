"""
Intelligence API â€” watsonx.ai-powered project analysis endpoints.

Architecture contract
---------------------
The AI model interprets evidence; it does NOT modify state.
All AI output is validated through Pydantic schemas before being returned.
Endpoints gracefully degrade when watsonx.ai is unavailable.

Routes
------
GET  /projects/{id}/intelligence/status            â€” service health check
POST /projects/{id}/intelligence/analyze           â€” full project analysis
POST /projects/{id}/intelligence/detect-gaps       â€” missing-work detection
POST /projects/{id}/intelligence/generate-memo     â€” AI-assisted memo draft
POST /projects/{id}/intelligence/catch-me-up       â€” AI catch-up narrative
POST /projects/{id}/intelligence/suggest-assignments â€” task assignment hints
"""
import logging
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.models.models import User, Project, Repository, GitHubInstallation, Memo, Task, DetectedGapRecord
from app.schemas.schemas import (
    ProjectAnalysisResponse,
    GeneratedMemoContent,
    CatchUpAIEnrichment,
    TaskAssignmentSuggestion,
    WatsonxStatusResponse,
    ProjectState,
    EvidencedItem,
    DetectedGap,
    DetectedGapUpdate,
    DetectedGapTaskCreate,
    SuggestedNextStep,
    MemoRead,
    TaskRead,
    MemoGitHubActivityRead,
)
from app.api.deps import get_current_user
from app.api.projects import get_project_membership, _memo_to_read, _task_to_read
from app.services import watsonx_service
from app.services.github_normalizer import build_project_context
from app.services import github_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/intelligence", tags=["intelligence"])


# â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def _get_project_and_repo(
    project_id: int,
    current_user: User,
    session: AsyncSession,
):
    """Verify membership and return (project, repository, installation) tuple."""
    await get_project_membership(project_id, current_user, session)

    proj_result = await session.exec(
        select(Project).where(Project.id == project_id)
    )
    project = proj_result.first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    repo_result = await session.exec(
        select(Repository).where(Repository.id == project.repository_id)
    )
    repo = repo_result.first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    inst_result = await session.exec(
        select(GitHubInstallation).where(GitHubInstallation.id == repo.installation_id)
    )
    installation = inst_result.first()
    return project, repo, installation


async def _fetch_project_context(repo, installation) -> Dict[str, Any]:
    """Collect and normalise the project context from GitHub."""
    if not installation or not installation.is_active:
        return _empty_context(repo.full_name)

    full_name = repo.full_name
    inst_id   = installation.installation_id

    repo_meta    = await github_service.get_repository_metadata(inst_id, full_name)
    if not repo_meta:
        return _empty_context(full_name)

    commits      = await github_service.get_commits_with_stats(inst_id, full_name, max_results=20)
    pull_requests = await github_service.get_pull_requests_with_files(inst_id, full_name, state="all", max_results=15)
    issues       = await github_service.get_issues_with_comments(inst_id, full_name, state="open", max_results=20)
    branches     = await github_service.get_branches(inst_id, full_name, max_results=30)
    contributors = await github_service.get_contributors(inst_id, full_name, max_results=20)

    return build_project_context(
        repo_meta=repo_meta,
        commits=commits,
        pull_requests=pull_requests,
        issues=issues,
        branches=branches,
        contributors=contributors,
    )


def _empty_context(full_name: str) -> Dict[str, Any]:
    return {
        "repository": {"fullName": full_name, "name": full_name.split("/")[-1]},
        "activeBranch": "main",
        "recentCommits": [],
        "openPullRequests": [],
        "openIssues": [],
        "recentFileChanges": [],
        "branches": [],
        "contributors": [],
        "projectMetadata": {"totalCommits": 0, "openPRCount": 0, "openIssueCount": 0, "activeBranchCount": 0},
        "isMock": True,
    }


async def _get_latest_memo(project_id: int, user_id: int, session: AsyncSession) -> Optional[Dict]:
    result = await session.exec(
        select(Memo)
        .where(Memo.project_id == project_id, Memo.author_id == user_id, Memo.is_draft == False)
        .order_by(Memo.created_at.desc())
        .limit(1)
    )
    memo = result.first()
    if not memo:
        return None
    return {
        "completed":   memo.completed,
        "in_progress": memo.in_progress,
        "blocked":     memo.blocked,
        "next_steps":  memo.next_steps,
        "notes":       memo.notes,
    }


async def _get_project_tasks(project_id: int, session: AsyncSession) -> List[Dict]:
    result = await session.exec(
        select(Task).where(Task.project_id == project_id).order_by(Task.updated_at.desc()).limit(20)
    )
    return [
        {
            "id":    t.id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
        }
        for t in result.all()
    ]


GAP_CATEGORIES = {
    "TESTING", "IMPLEMENTATION", "INTEGRATION", "DOCUMENTATION",
    "ERROR HANDLING", "SECURITY", "UI", "BACKEND", "FRONTEND", "DEPLOYMENT",
}


def _gap_to_response(gap: DetectedGapRecord) -> Dict[str, Any]:
    try:
        evidence = json.loads(gap.evidence_json)
    except (TypeError, json.JSONDecodeError):
        evidence = []
    return {
        "id": gap.id, "category": gap.category, "title": gap.title,
        "description": gap.description, "reason": gap.reason,
        "confidence": gap.confidence, "evidence": evidence,
        "status": gap.status, "created_task_id": gap.created_task_id,
    }


async def _persist_gaps(project_id: int, gaps: List[Dict[str, Any]], session: AsyncSession) -> List[Dict[str, Any]]:
    """Upsert suggestions while preserving human dismiss/create decisions."""
    result = await session.exec(select(DetectedGapRecord).where(DetectedGapRecord.project_id == project_id))
    existing = {gap.source_key: gap for gap in result.all()}
    active: List[DetectedGapRecord] = []
    for raw in gaps:
        evidence = [str(item)[:300] for item in (raw.get("evidence") or []) if item][:8]
        if not raw.get("title") or not raw.get("description") or not evidence:
            continue
        category = str(raw.get("category") or "IMPLEMENTATION").upper().replace("_", " ")
        if category not in GAP_CATEGORIES:
            category = "IMPLEMENTATION"
        source = "|".join([category, str(raw["title"]).strip().lower(), *sorted(evidence)])
        source_key = hashlib.sha256(source.encode("utf-8")).hexdigest()
        record = existing.get(source_key)
        if record is None:
            record = DetectedGapRecord(
                project_id=project_id, source_key=source_key, category=category,
                title=str(raw["title"])[:512], description=str(raw["description"])[:2000],
                reason=str(raw.get("reason") or "Evidence suggests follow-up may be needed.")[:2000],
                confidence=max(0.0, min(1.0, float(raw.get("confidence", 0.5)))),
                evidence_json=json.dumps(evidence),
            )
            session.add(record)
        if record.status == "active":
            active.append(record)
    await session.commit()
    for record in active:
        await session.refresh(record)
    return [_gap_to_response(record) for record in active]


async def _get_gap(project_id: int, gap_id: int, session: AsyncSession) -> DetectedGapRecord:
    result = await session.exec(select(DetectedGapRecord).where(
        DetectedGapRecord.id == gap_id, DetectedGapRecord.project_id == project_id,
    ))
    gap = result.first()
    if not gap:
        raise HTTPException(status_code=404, detail="Detected gap not found")
    return gap

def _build_analysis_response(raw: Dict[str, Any], ai_available: bool) -> ProjectAnalysisResponse:
    ps = raw.get("projectState", {})
    return ProjectAnalysisResponse(
        projectState=ProjectState(
            completed=[EvidencedItem(**i) for i in ps.get("completed", []) if i.get("title")],
            inProgress=[EvidencedItem(**i) for i in ps.get("inProgress", []) if i.get("title")],
            blocked=[EvidencedItem(**i) for i in ps.get("blocked", []) if i.get("title")],
        ),
        detectedGaps=[
            DetectedGap(**g) for g in raw.get("detectedGaps", [])
            if g.get("title") and g.get("description")
        ],
        suggestedNextSteps=[
            SuggestedNextStep(**s) for s in raw.get("suggestedNextSteps", [])
            if s.get("title") and s.get("description")
        ],
        generatedAt=raw.get("generatedAt", ""),
        modelId=raw.get("modelId", "fallback"),
        isFallback=raw.get("isFallback", True),
        aiAvailable=ai_available,
    )


# â”€â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/status", response_model=WatsonxStatusResponse)
async def get_intelligence_status(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Returns whether the watsonx.ai intelligence service is configured and available.
    MEMO always shows GitHub data; this status controls whether AI enrichment is shown.
    """
    await get_project_membership(project_id, current_user, session)
    from app.core.config import settings
    return WatsonxStatusResponse(
        available=watsonx_service.is_configured(),
        model_id=settings.WATSONX_MODEL_ID,
        project_id_set=bool(settings.WATSONX_PROJECT_ID),
        api_key_set=bool(settings.WATSONX_API_KEY),
    )


@router.post("/analyze", response_model=ProjectAnalysisResponse)
async def analyze_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Run a full project-state analysis using watsonx.ai.

    Collects ProjectContext from GitHub, sends it to watsonx.ai, returns a
    structured analysis with:
    - Project state (completed / in-progress / blocked)
    - Detected gaps with evidence and confidence
    - Suggested next steps

    Falls back gracefully when watsonx.ai is unavailable.
    """
    project, repo, installation = await _get_project_and_repo(project_id, current_user, session)
    ctx         = await _fetch_project_context(repo, installation)
    latest_memo = await _get_latest_memo(project_id, current_user.id, session)
    tasks       = await _get_project_tasks(project_id, session)

    raw = await watsonx_service.analyze_project_context(ctx, latest_memo, tasks)
    raw["detectedGaps"] = await _persist_gaps(project_id, raw.get("detectedGaps", []), session)
    return _build_analysis_response(raw, ai_available=watsonx_service.is_configured())


@router.post("/detect-gaps", response_model=List[DetectedGap])
async def detect_gaps(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Detect potentially missing work items based on GitHub evidence.

    Every gap includes a confidence level and supporting evidence.
    MEMO uses hedged language: these are suggestions, not facts.
    """
    project, repo, installation = await _get_project_and_repo(project_id, current_user, session)
    ctx   = await _fetch_project_context(repo, installation)
    tasks = await _get_project_tasks(project_id, session)

    gaps = await watsonx_service.detect_missing_work(ctx, tasks)
    persisted = await _persist_gaps(project_id, gaps, session)
    return [DetectedGap(**g) for g in persisted]


@router.post("/generate-memo", response_model=GeneratedMemoContent)
async def generate_memo_draft(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Generate a structured developer handoff memo using watsonx.ai.

    The returned content is a DRAFT for the developer to review and edit.
    It is NOT saved automatically â€” the user must approve and save it via
    the normal memo creation endpoint.

    Fallback: if watsonx.ai is unavailable, returns a memo skeleton derived
    from raw GitHub data (merged PRs, open PRs, recent commits).
    """
    project, repo, installation = await _get_project_and_repo(project_id, current_user, session)
    ctx         = await _fetch_project_context(repo, installation)
    latest_memo = await _get_latest_memo(project_id, current_user.id, session)
    tasks       = await _get_project_tasks(project_id, session)

    raw = await watsonx_service.generate_memo(ctx, latest_memo, tasks)

    # Ensure fields are not longer than DB column limits
    return GeneratedMemoContent(
        completed=raw.get("completed"),
        in_progress=raw.get("in_progress"),
        blocked=raw.get("blocked"),
        next_steps=raw.get("next_steps"),
        notes=raw.get("notes"),
        generatedAt=raw.get("generatedAt", ""),
        isFallback=raw.get("isFallback", False),
    )


@router.post("/catch-me-up", response_model=CatchUpAIEnrichment)
async def ai_catch_me_up(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    AI-powered "Catch Me Up" enrichment.

    Compares the developer's previous memo, new GitHub activity, and
    current project state.  Returns:
    - What happened while you were away
    - What changed
    - What needs attention
    - The single most important next step

    Supplements (does not replace) the deterministic CatchMeUp data.
    Falls back gracefully when watsonx.ai is unavailable.
    """
    from sqlmodel import select as sa_select
    from app.models.models import MemoGitHubActivity
    from datetime import timedelta, timezone
    from datetime import datetime as dt

    project, repo, installation = await _get_project_and_repo(project_id, current_user, session)
    ctx         = await _fetch_project_context(repo, installation)
    latest_memo = await _get_latest_memo(project_id, current_user.id, session)

    # Recent GitHub activity for this project
    since = dt.now(timezone.utc) - timedelta(days=7)
    gh_result = await session.exec(
        sa_select(MemoGitHubActivity)
        .join(Memo, MemoGitHubActivity.memo_id == Memo.id)
        .where(Memo.project_id == project_id, MemoGitHubActivity.occurred_at >= since)
        .order_by(MemoGitHubActivity.occurred_at.desc())
        .limit(15)
    )
    recent_activity = [
        {
            "activity_type": a.activity_type,
            "title":         a.title,
            "author_login":  a.author_login,
            "occurred_at":   a.occurred_at.isoformat() if a.occurred_at else None,
        }
        for a in gh_result.all()
    ]

    raw = await watsonx_service.generate_catch_up(
        project_context=ctx,
        previous_memo=latest_memo,
        recent_github_activity=recent_activity,
        user_display_name=current_user.display_name,
    )
    return CatchUpAIEnrichment(
        whileYouWereAway=raw.get("whileYouWereAway", ""),
        whatChanged=raw.get("whatChanged", []),
        whatNeedsAttention=raw.get("whatNeedsAttention", []),
        yourNextStep=raw.get("yourNextStep", ""),
        confidence=raw.get("confidence", 0.5),
        generatedAt=raw.get("generatedAt", ""),
        isFallback=raw.get("isFallback", False),
    )


@router.patch("/gaps/{gap_id}", response_model=DetectedGap)
async def edit_detected_gap(
    project_id: int,
    gap_id: int,
    data: DetectedGapUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)
    gap = await _get_gap(project_id, gap_id, session)
    if data.title is not None and data.title.strip():
        gap.title = data.title.strip()[:512]
    if data.description is not None and data.description.strip():
        gap.description = data.description.strip()[:2000]
    if data.category is not None:
        category = data.category.upper().replace("_", " ")
        if category not in GAP_CATEGORIES:
            raise HTTPException(status_code=400, detail="Unsupported gap category")
        gap.category = category
    gap.updated_at = datetime.now(timezone.utc)
    session.add(gap)
    await session.commit()
    await session.refresh(gap)
    return DetectedGap(**_gap_to_response(gap))


@router.post("/gaps/{gap_id}/dismiss", status_code=204)
async def dismiss_detected_gap(
    project_id: int,
    gap_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)
    gap = await _get_gap(project_id, gap_id, session)
    gap.status = "dismissed"
    gap.updated_at = datetime.now(timezone.utc)
    session.add(gap)
    await session.commit()


@router.post("/gaps/{gap_id}/task", response_model=TaskRead, status_code=201)
async def create_task_from_gap(
    project_id: int,
    gap_id: int,
    data: DetectedGapTaskCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)
    gap = await _get_gap(project_id, gap_id, session)
    if gap.created_task_id:
        result = await session.exec(select(Task).where(Task.id == gap.created_task_id))
        existing_task = result.first()
        if existing_task:
            return _task_to_read(existing_task)
    if data.priority not in {"low", "medium", "high"}:
        raise HTTPException(status_code=400, detail="Invalid task priority")
    task = Task(
        project_id=project_id,
        title=(data.title or gap.title).strip()[:512],
        description=(data.description or gap.description).strip()[:2000],
        status="todo",
        priority=data.priority,
    )
    session.add(task)
    await session.flush()
    gap.created_task_id = task.id
    gap.status = "created"
    gap.updated_at = datetime.now(timezone.utc)
    session.add(gap)
    await session.commit()
    await session.refresh(task)
    return _task_to_read(task)

@router.post("/suggest-assignments", response_model=List[TaskAssignmentSuggestion])
async def suggest_assignments(
    project_id: int,
    task_ids: Optional[List[int]] = Body(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Suggest which contributor should own each unassigned task.

    The AI matches tasks to contributors based on their file-change patterns
    in recent commits and PRs.

    Every suggestion includes a confidence level and supporting evidence.
    The developer must explicitly assign â€” MEMO never auto-assigns.
    """
    project, repo, installation = await _get_project_and_repo(project_id, current_user, session)
    ctx = await _fetch_project_context(repo, installation)

    # Resolve tasks
    query = select(Task).where(
        Task.project_id == project_id,
        Task.assignee_id.is_(None),
    )
    if task_ids:
        query = query.where(Task.id.in_(task_ids))
    result = await session.exec(query.limit(10))
    tasks = [
        {"id": t.id, "title": t.title, "description": t.description}
        for t in result.all()
    ]

    suggestions = await watsonx_service.suggest_task_assignments(tasks, ctx)
    return [
        TaskAssignmentSuggestion(**s) for s in suggestions
        if isinstance(s, dict) and s.get("task_id") is not None
    ]
