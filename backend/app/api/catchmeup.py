"""
Catch Me Up — deterministic aggregation of context for a returning developer.
"""
from typing import List
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.models.models import (
    User, Memo, Task, MemoGitHubActivity, GitHubAccount, ProjectMember, TaskStatus,
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

    return CatchMeUpResponse(
        user=user_read,
        last_session_memo=last_session_memo,
        my_open_tasks=my_open_tasks,
        my_blocked_tasks=my_blocked_tasks,
        team_memos_since_last=team_memos_since_last,
        recent_github_activity=recent_github_activity,
        suggested_next_steps=suggested_next_steps[:5],
        summary_lines=summary_lines,
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
