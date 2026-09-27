"""
Memo routes — create, read, update, GitHub activity association.
"""
import json
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.models.models import (
    User, Memo, MemoGitHubActivity, Project, ProjectMember,
    Repository, GitHubInstallation, GitHubAccount,
)
from app.schemas.schemas import (
    MemoCreate, MemoUpdate, MemoRead, MemoGitHubActivityRead, UserRead,
)
from app.services import github_service
from app.api.deps import get_current_user
from app.api.projects import get_project_membership, _memo_to_read

router = APIRouter(prefix="/projects/{project_id}/memos", tags=["memos"])


@router.post("", response_model=MemoRead, status_code=201)
async def create_memo(
    project_id: int,
    data: MemoCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new Memo for the project and attach recent GitHub activity."""
    await get_project_membership(project_id, current_user, session)

    memo = Memo(
        project_id=project_id,
        author_id=current_user.id,
        completed=data.completed,
        in_progress=data.in_progress,
        blocked=data.blocked,
        next_steps=data.next_steps,
        notes=data.notes,
        is_draft=data.is_draft,
    )
    session.add(memo)
    await session.flush()

    # Auto-attach recent GitHub activity for this user
    await _attach_github_activity(memo, current_user, project_id, session)

    await session.commit()
    await session.refresh(memo)
    return await _memo_to_read(memo, current_user, session)


@router.get("", response_model=List[MemoRead])
async def list_memos(
    project_id: int,
    author_id: Optional[int] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List Memos for a project, most recent first."""
    await get_project_membership(project_id, current_user, session)

    query = (
        select(Memo, User)
        .join(User, Memo.author_id == User.id)
        .where(Memo.project_id == project_id, Memo.is_draft == False)
    )
    if author_id:
        query = query.where(Memo.author_id == author_id)
    query = query.order_by(Memo.created_at.desc()).offset(offset).limit(limit)

    result = await session.exec(query)
    rows = result.all()
    return [await _memo_to_read(memo, user, session) for memo, user in rows]


@router.get("/session-context")
async def get_session_context(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """GitHub evidence since this developer's previous completed session."""
    await get_project_membership(project_id, current_user, session)
    project = (await session.exec(select(Project).where(Project.id == project_id))).first()
    repo = (await session.exec(select(Repository).where(Repository.id == project.repository_id))).first() if project else None
    installation = (await session.exec(select(GitHubInstallation).where(GitHubInstallation.id == repo.installation_id))).first() if repo else None
    if not repo or not installation:
        return {"branch": "main", "commits": [], "pull_requests": [], "changed_files": [], "open_issues": []}

    from app.api.intelligence import _fetch_project_context
    context = await _fetch_project_context(repo, installation)
    previous = (await session.exec(select(Memo).where(Memo.project_id == project_id, Memo.author_id == current_user.id, Memo.is_draft == False).order_by(Memo.created_at.desc()).limit(1))).first()
    since = previous.created_at if previous else datetime.now(timezone.utc) - timedelta(days=1)
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    gh_account = (await session.exec(select(GitHubAccount).where(GitHubAccount.user_id == current_user.id))).first()
    login = gh_account.github_login if gh_account else None

    def recent(timestamp):
        if not timestamp: return True
        try: return datetime.fromisoformat(timestamp.replace("Z", "+00:00")) > since
        except (ValueError, TypeError): return False

    commits = []
    for index, commit in enumerate(context.get("recentCommits", [])):
        if recent(commit.get("timestamp")) and (not login or commit.get("author") == login):
            commits.append({"id": index + 1, "activity_type": "commit", "github_id": commit.get("sha", ""), "title": commit.get("message"), "url": commit.get("url"), "author_login": commit.get("author"), "occurred_at": commit.get("timestamp"), "branch": commit.get("branch"), "changed_files": commit.get("changedFiles", []), "additions": commit.get("additions", 0), "deletions": commit.get("deletions", 0)})
    pull_requests = []
    for index, pr in enumerate(context.get("openPullRequests", [])):
        if recent(pr.get("updatedAt")) and (not login or pr.get("author") == login):
            pull_requests.append({"id": index + 1000, "activity_type": "pull_request", "github_id": str(pr.get("number", "")), "title": pr.get("title"), "url": pr.get("url"), "author_login": pr.get("author"), "occurred_at": pr.get("updatedAt"), "changed_files": pr.get("changedFiles", []), "additions": pr.get("additions", 0), "deletions": pr.get("deletions", 0), "pr_state": pr.get("state"), "pr_number": pr.get("number")})
    files = list(dict.fromkeys(path for item in commits + pull_requests for path in (item.get("changed_files") or [])))
    issues = [{"id": issue.get("number"), "number": issue.get("number"), "title": issue.get("title"), "url": issue.get("url")} for issue in context.get("openIssues", []) if issue.get("state") == "open"]
    return {"branch": context.get("activeBranch", repo.default_branch), "commits": commits, "pull_requests": pull_requests, "changed_files": files, "open_issues": issues}

@router.get("/{memo_id}", response_model=MemoRead)
async def get_memo(
    project_id: int,
    memo_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(Memo, User)
        .join(User, Memo.author_id == User.id)
        .where(Memo.id == memo_id, Memo.project_id == project_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Memo not found")
    return await _memo_to_read(row[0], row[1], session)


@router.patch("/{memo_id}", response_model=MemoRead)
async def update_memo(
    project_id: int,
    memo_id: int,
    data: MemoUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update a Memo. Only the author may edit."""
    await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(Memo).where(Memo.id == memo_id, Memo.project_id == project_id)
    )
    memo = result.first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    if memo.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can edit this Memo")

    if data.completed is not None:
        memo.completed = data.completed
    if data.in_progress is not None:
        memo.in_progress = data.in_progress
    if data.blocked is not None:
        memo.blocked = data.blocked
    if data.next_steps is not None:
        memo.next_steps = data.next_steps
    if data.notes is not None:
        memo.notes = data.notes
    if data.is_draft is not None:
        memo.is_draft = data.is_draft
    memo.updated_at = datetime.now(timezone.utc)
    session.add(memo)
    await session.commit()
    await session.refresh(memo)

    user_result = await session.exec(select(User).where(User.id == memo.author_id))
    user = user_result.first()
    return await _memo_to_read(memo, user, session)


@router.delete("/{memo_id}", status_code=204)
async def delete_memo(
    project_id: int,
    memo_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a Memo. Only the author or project owner may delete."""
    membership = await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(Memo).where(Memo.id == memo_id, Memo.project_id == project_id)
    )
    memo = result.first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    if memo.author_id != current_user.id and membership.role != "owner":
        raise HTTPException(status_code=403, detail="Not authorized to delete this Memo")
    await session.delete(memo)
    await session.commit()


@router.post("/{memo_id}/refresh-activity", response_model=MemoRead)
async def refresh_memo_activity(
    project_id: int,
    memo_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Manually refresh GitHub activity attached to a Memo."""
    await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(Memo).where(Memo.id == memo_id, Memo.project_id == project_id)
    )
    memo = result.first()
    if not memo:
        raise HTTPException(status_code=404, detail="Memo not found")
    if memo.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can refresh activity")

    # Clear existing activity
    existing = await session.exec(
        select(MemoGitHubActivity).where(MemoGitHubActivity.memo_id == memo_id)
    )
    for act in existing.all():
        await session.delete(act)

    await _attach_github_activity(memo, current_user, project_id, session)
    await session.commit()
    await session.refresh(memo)

    user_result = await session.exec(select(User).where(User.id == memo.author_id))
    user = user_result.first()
    return await _memo_to_read(memo, user, session)


# ─────────────────────────────────────────────
# GitHub activity attachment
# ─────────────────────────────────────────────

async def _attach_github_activity(
    memo: Memo,
    author: User,
    project_id: int,
    session: AsyncSession,
):
    """Fetch recent GitHub activity for the memo author and attach it to the memo."""
    try:
        # Get repository for this project
        proj_result = await session.exec(
            select(Project).where(Project.id == project_id)
        )
        project = proj_result.first()
        if not project:
            return

        repo_result = await session.exec(
            select(Repository).where(Repository.id == project.repository_id)
        )
        repo = repo_result.first()
        if not repo:
            return

        inst_result = await session.exec(
            select(GitHubInstallation).where(GitHubInstallation.id == repo.installation_id)
        )
        installation = inst_result.first()
        if not installation:
            return

        # Get the author's GitHub login
        gh_result = await session.exec(
            select(GitHubAccount).where(GitHubAccount.user_id == author.id)
        )
        gh_account = gh_result.first()
        if not gh_account:
            return

        since = datetime.now(timezone.utc) - timedelta(days=1)

        # Commits
        commits = await github_service.get_recent_commits(
            installation.installation_id,
            repo.full_name,
            author_login=gh_account.github_login,
            since=since,
            max_results=10,
        )
        for commit in commits:
            sha = commit["sha"]
            message = commit["commit"]["message"].split("\n")[0][:200]
            url = commit.get("html_url", "")
            occurred = commit["commit"]["committer"].get("date")
            if occurred:
                try:
                    occurred = datetime.fromisoformat(occurred.replace("Z", "+00:00"))
                except Exception:
                    occurred = None
            activity = MemoGitHubActivity(
                memo_id=memo.id,
                activity_type="commit",
                github_id=sha[:7],
                title=message,
                url=url,
                author_login=gh_account.github_login,
                occurred_at=occurred,
            )
            session.add(activity)

        # Pull requests
        prs = await github_service.get_recent_pull_requests(
            installation.installation_id,
            repo.full_name,
            state="all",
            max_results=5,
        )
        for pr in prs:
            # Only include PRs authored by this user
            if pr.get("user", {}).get("login") != gh_account.github_login:
                continue
            occurred = pr.get("updated_at")
            if occurred:
                try:
                    occurred = datetime.fromisoformat(occurred.replace("Z", "+00:00"))
                except Exception:
                    occurred = None
            activity = MemoGitHubActivity(
                memo_id=memo.id,
                activity_type="pull_request",
                github_id=str(pr["number"]),
                title=pr.get("title", "")[:200],
                url=pr.get("html_url", ""),
                author_login=gh_account.github_login,
                occurred_at=occurred,
            )
            session.add(activity)

    except Exception as e:
        # Non-fatal: log but don't fail memo creation
        import logging
        logging.getLogger(__name__).warning(f"Failed to attach GitHub activity: {e}")
