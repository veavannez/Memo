"""
Catch Me Up — deterministic aggregation of context for a returning developer.
"""
from typing import List, Dict, Any, Optional
import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.models.models import (
    User, Memo, Task, MemoGitHubActivity, GitHubAccount, ProjectMember, TaskStatus, ProjectIntelligenceSnapshot, DetectedGapRecord,
)
from app.schemas.schemas import (
    CatchMeUpResponse, UserRead, MemoRead, TaskRead, MemoGitHubActivityRead,
)
from app.api.deps import get_current_user
from app.api.projects import get_project_membership, _memo_to_read, _task_to_read

router = APIRouter(prefix="/projects/{project_id}/catch-me-up", tags=["catch-me-up"])


@router.get("", response_model=CatchMeUpResponse)
async def catch_me_up(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Deterministic 'Catch Me Up' view.
    Aggregates: last user memo, open/blocked tasks, team memos since last activity,
    recent GitHub activity, and a plain-text summary.
    """
    await get_project_membership(project_id, current_user, session)

    # Build user read
    gh_result = await session.exec(
        select(GitHubAccount).where(GitHubAccount.user_id == current_user.id)
    )
    gh_account = gh_result.first()
    user_read = UserRead(
        id=current_user.id,
        display_name=current_user.display_name,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
        github_login=gh_account.github_login if gh_account else None,
        created_at=current_user.created_at,
    )

    # Last memo by this user
    last_memo_result = await session.exec(
        select(Memo)
        .where(Memo.project_id == project_id, Memo.author_id == current_user.id, Memo.is_draft == False)
        .order_by(Memo.created_at.desc())
        .limit(1)
    )
    last_memo_obj = last_memo_result.first()
    last_session_memo = await _memo_to_read(last_memo_obj, current_user, session) if last_memo_obj else None
    last_activity_time = last_memo_obj.created_at if last_memo_obj else None

    # My open tasks
    open_tasks_result = await session.exec(
        select(Task).where(
            Task.project_id == project_id,
            Task.assignee_id == current_user.id,
            Task.status != TaskStatus.done,
        ).order_by(Task.updated_at.desc()).limit(10)
    )
    my_open_tasks = [_task_to_read(t) for t in open_tasks_result.all()]

    # My blocked tasks
    blocked_tasks_result = await session.exec(
        select(Task).where(
            Task.project_id == project_id,
            Task.assignee_id == current_user.id,
            Task.status == TaskStatus.blocked,
        ).order_by(Task.updated_at.desc())
    )
    my_blocked_tasks = [_task_to_read(t) for t in blocked_tasks_result.all()]

    # Team memos since last activity (from other users)
    team_memos_query = (
        select(Memo, User)
        .join(User, Memo.author_id == User.id)
        .where(
            Memo.project_id == project_id,
            Memo.author_id != current_user.id,
            Memo.is_draft == False,
        )
        .order_by(Memo.created_at.desc())
        .limit(5)
    )
    if last_activity_time:
        team_memos_query = team_memos_query.where(Memo.created_at > last_activity_time)

    team_memos_result = await session.exec(team_memos_query)
    team_memo_rows = team_memos_result.all()
    team_memos_since_last = [await _memo_to_read(m, u, session) for m, u in team_memo_rows]

    # Recent GitHub activity (from all memos in this project, last 7 days)
    since = datetime.now(timezone.utc) - timedelta(days=7)
    gh_activity_result = await session.exec(
        select(MemoGitHubActivity)
        .join(Memo, MemoGitHubActivity.memo_id == Memo.id)
        .where(
            Memo.project_id == project_id,
            MemoGitHubActivity.occurred_at >= since,
        )
        .order_by(MemoGitHubActivity.occurred_at.desc())
        .limit(15)
    )
    recent_github_activity = [
        MemoGitHubActivityRead(
            id=a.id,
            activity_type=a.activity_type,
            github_id=a.github_id,
            title=a.title,
            url=a.url,
            author_login=a.author_login,
            occurred_at=a.occurred_at,
        )
        for a in gh_activity_result.all()
    ]

    # Build suggested next steps from last memo
    suggested_next_steps = []
    if last_session_memo and last_session_memo.next_steps:
        for line in last_session_memo.next_steps.split("\n"):
            line = line.strip().lstrip("-•* ").strip()
            if line:
                suggested_next_steps.append(line)

    # Add blocked task context
    for task in my_blocked_tasks:
        suggested_next_steps.append(f"Unblock: {task.title}")

    # Build plain-text summary lines
    summary_lines = _build_summary(
        user_read=user_read,
        last_session_memo=last_session_memo,
        my_open_tasks=my_open_tasks,
        my_blocked_tasks=my_blocked_tasks,
        team_memos_since_last=team_memos_since_last,
        recent_github_activity=recent_github_activity,
        last_activity_time=last_activity_time,
    )

    # Signature briefing: compare the two most recent persisted intelligence snapshots.
    snapshots_result = await session.exec(
        select(ProjectIntelligenceSnapshot)
        .where(ProjectIntelligenceSnapshot.project_id == project_id)
        .order_by(ProjectIntelligenceSnapshot.created_at.desc())
        .limit(2)
    )
    snapshots = snapshots_result.all()
    latest_snapshot = snapshots[0] if snapshots else None
    previous_snapshot = snapshots[1] if len(snapshots) > 1 else None
    briefing = _build_briefing(
        project_id=project_id,
        latest_snapshot=latest_snapshot,
        previous_snapshot=previous_snapshot,
        team_memos=team_memos_since_last,
        blocked_tasks=my_blocked_tasks,
    )
    return CatchMeUpResponse(
        user=user_read,
        last_session_memo=last_session_memo,
        my_open_tasks=my_open_tasks,
        my_blocked_tasks=my_blocked_tasks,
        team_memos_since_last=team_memos_since_last,
        recent_github_activity=recent_github_activity,
        suggested_next_steps=suggested_next_steps[:5],
        summary_lines=summary_lines,
        briefing_summary=briefing["summary"],
        what_changed=briefing["changes"],
        team_activity=briefing["team"],
        attention_items=briefing["attention"],
        next_step=briefing["next_step"],
        compared_from=briefing["compared_from"],
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def _build_summary(
    user_read: UserRead,
    last_session_memo,
    my_open_tasks,
    my_blocked_tasks,
    team_memos_since_last,
    recent_github_activity,
    last_activity_time,
) -> List[str]:
    """Build a human-readable summary for Catch Me Up."""
    lines = []

    # Welcome line
    lines.append(f"Welcome back, {user_read.display_name}.")

    # Since last session
    if last_activity_time:
        from datetime import timezone as tz
        now = datetime.now(timezone.utc)
        delta = now - last_activity_time.replace(tzinfo=timezone.utc) if last_activity_time.tzinfo is None else now - last_activity_time
        if delta.days > 0:
            lines.append(f"You were last active {delta.days} day{'s' if delta.days > 1 else ''} ago.")
        else:
            hours = int(delta.seconds / 3600)
            lines.append(f"You were last active {hours} hour{'s' if hours != 1 else ''} ago.")

    # Last memo
    if last_session_memo:
        if last_session_memo.in_progress:
            lines.append(f"You were working on: {last_session_memo.in_progress[:100]}.")
        if last_session_memo.blocked:
            lines.append(f"You were blocked on: {last_session_memo.blocked[:100]}.")

    # Team activity
    if team_memos_since_last:
        lines.append(
            f"{len(team_memos_since_last)} teammate memo{'s' if len(team_memos_since_last) > 1 else ''} since your last session."
        )
        for memo in team_memos_since_last[:3]:
            if memo.author and memo.in_progress:
                lines.append(f"  • {memo.author.display_name}: {memo.in_progress[:80]}.")

    # Blockers
    if my_blocked_tasks:
        lines.append(f"You have {len(my_blocked_tasks)} blocked task{'s' if len(my_blocked_tasks) > 1 else ''}.")
        for task in my_blocked_tasks[:2]:
            lines.append(f"  • {task.title}")

    # Open tasks
    if my_open_tasks:
        open_count = len([t for t in my_open_tasks if t.status != "blocked"])
        if open_count > 0:
            lines.append(f"You have {open_count} open task{'s' if open_count > 1 else ''} in progress.")

    # GitHub activity
    if recent_github_activity:
        commit_count = sum(1 for a in recent_github_activity if a.activity_type == "commit")
        pr_count = sum(1 for a in recent_github_activity if a.activity_type == "pull_request")
        if commit_count:
            lines.append(f"{commit_count} commit{'s' if commit_count > 1 else ''} in the last 7 days.")
        if pr_count:
            lines.append(f"{pr_count} pull request{'s' if pr_count > 1 else ''} updated recently.")

    return lines


def _evidence(value: str, default_type: str = "file") -> Dict[str, Optional[str]]:
    value = str(value or "")
    lower = value.lower()
    evidence_type = "commit" if ":" in value and len(value.split(":", 1)[0]) <= 12 else default_type
    if "/pull/" in lower: evidence_type = "pull_request"
    elif "/issues/" in lower: evidence_type = "issue"
    elif lower.startswith("task "): evidence_type = "task"
    return {"type": evidence_type, "label": value, "url": value if value.startswith("http") or value.startswith("/") else None}


def _build_briefing(project_id: int, latest_snapshot, previous_snapshot, team_memos, blocked_tasks) -> Dict[str, Any]:
    if not latest_snapshot:
        attention = [{"title": task.title, "detail": "This assigned task is blocked.", "tone": "warning", "evidence": [_evidence(f"Task {task.id}", "task")]} for task in blocked_tasks[:3]]
        return {"summary": "MEMO needs one Project Intelligence update to establish your project baseline.", "changes": [], "team": [], "attention": attention, "next_step": {"title": "Update project intelligence", "detail": "Create a baseline from current GitHub activity, then return for a comparison briefing.", "tone": "neutral", "evidence": []}, "compared_from": None}

    current = json.loads(latest_snapshot.context_json)
    previous = json.loads(previous_snapshot.context_json) if previous_snapshot else None
    from app.api.intelligence import _meaningful_changes
    raw_changes = _meaningful_changes(previous, current)
    changes = [{"title": item["title"], "detail": item["description"], "tone": item.get("tone", "neutral"), "evidence": [_evidence(e, item.get("kind", "file")) for e in item.get("evidence", []) if e]} for item in raw_changes]

    previous_shas = {c.get("sha") for c in (previous or {}).get("recentCommits", [])}
    new_commits = [c for c in current.get("recentCommits", []) if not previous or c.get("sha") not in previous_shas]
    by_author: Dict[str, List[Dict[str, Any]]] = {}
    for commit in new_commits:
        by_author.setdefault(commit.get("author") or "Unknown contributor", []).append(commit)
    team = []
    for author, commits in list(by_author.items())[:5]:
        files = list(dict.fromkeys(path for commit in commits for path in commit.get("changedFiles", [])))
        summary = commits[0].get("message") or f"Added {len(commits)} commit(s)"
        evidence = [_evidence(commit.get("url") or f"{commit.get('shortSha')}: {commit.get('message')}", "commit") for commit in commits[:3]]
        evidence += [_evidence(path) for path in files[:2]]
        team.append({"name": author, "login": author, "summary": summary, "evidence": evidence})
    for memo in team_memos:
        name = memo.author.display_name if memo.author else "Team member"
        if not any(member["name"] == name for member in team):
            team.append({"name": name, "summary": memo.in_progress or memo.completed or "Shared a project memo.", "evidence": [{"type": "memo", "label": f"Memo #{memo.id}", "url": f"/projects/{project_id}/memos/{memo.id}"}]})

    try: analysis = json.loads(latest_snapshot.analysis_json)
    except (TypeError, json.JSONDecodeError): analysis = {}
    attention = []
    for gap in analysis.get("detectedGaps", [])[:4]:
        attention.append({"title": gap.get("title", "Potential gap"), "detail": gap.get("description"), "tone": "warning", "evidence": [_evidence(e) for e in gap.get("evidence", [])]})
    for task in blocked_tasks[:3]:
        if not any(item["title"] == task.title for item in attention):
            attention.append({"title": task.title, "detail": "This assigned task is blocked.", "tone": "warning", "evidence": [{"type": "task", "label": f"Task {task.id}", "url": f"/projects/{project_id}/kanban"}]})

    suggested = (analysis.get("suggestedNextSteps") or [{}])[0]
    next_step = None
    if suggested.get("title"):
        next_step = {"title": suggested["title"], "detail": suggested.get("description"), "tone": "neutral", "evidence": [_evidence(e) for e in suggested.get("evidence", [])]}
    elif attention:
        next_step = {"title": f"Review: {attention[0]['title']}", "detail": attention[0].get("detail"), "tone": "neutral", "evidence": attention[0]["evidence"]}
    elif blocked_tasks:
        next_step = {"title": f"Unblock {blocked_tasks[0].title}", "detail": "Review the blocker and decide the next action.", "tone": "neutral", "evidence": [{"type": "task", "label": f"Task {blocked_tasks[0].id}", "url": f"/projects/{project_id}/kanban"}]}
    else:
        next_step = {"title": "Review the latest project activity", "detail": "No urgent attention item was detected.", "tone": "neutral", "evidence": []}

    contributor_count = len(by_author)
    if previous_snapshot:
        summary = f"{len(changes)} meaningful change{'s' if len(changes) != 1 else ''} across {contributor_count} contributor{'s' if contributor_count != 1 else ''}."
    else:
        summary = f"Baseline context assembled from {len(current.get('recentCommits', []))} recent commits and {len(current.get('contributors', []))} contributors."
    return {"summary": summary, "changes": changes, "team": team[:6], "attention": attention[:5], "next_step": next_step, "compared_from": previous_snapshot.created_at.isoformat() if previous_snapshot else None}