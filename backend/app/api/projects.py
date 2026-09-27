"""
Project routes — CRUD, membership, and dashboard.
"""
from typing import List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from sqlalchemy import func

from app.core.database import get_session
from app.models.models import (
    User, Project, ProjectMember, Repository, Memo, Task, GitHubAccount,
    ProjectRole, TaskStatus,
)
from app.schemas.schemas import (
    ProjectCreate, ProjectRead, ProjectUpdate,
    ProjectMemberRead, ProjectMemberInvite, ProjectMemberUpdate,
    DashboardResponse, TeamMemberStatus, MemoRead, TaskRead, UserRead,
    MemoGitHubActivityRead,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


# ─────────────────────────────────────────────
# Authorization helpers
# ─────────────────────────────────────────────

async def get_project_membership(
    project_id: int,
    user: User,
    session: AsyncSession,
) -> ProjectMember:
    """Raise 403/404 if user is not a member of the project."""
    result = await session.exec(
        select(Project).where(Project.id == project_id, Project.is_active == True)
    )
    project = result.first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await session.exec(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id,
        )
    )
    membership = result.first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this project")
    return membership


async def require_owner(project_id: int, user: User, session: AsyncSession) -> ProjectMember:
    membership = await get_project_membership(project_id, user, session)
    if membership.role != ProjectRole.owner:
        raise HTTPException(status_code=403, detail="Owner access required")
    return membership


# ─────────────────────────────────────────────
# Projects CRUD
# ─────────────────────────────────────────────

@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new MEMO project linked to a repository."""
    # Verify repository exists
    repo_result = await session.exec(
        select(Repository).where(Repository.id == data.repository_id, Repository.is_active == True)
    )
    repository = repo_result.first()
    if not repository:
        raise HTTPException(status_code=404, detail="Repository not found")

    project = Project(
        name=data.name,
        description=data.description,
        repository_id=data.repository_id,
    )
    session.add(project)
    await session.flush()

    # Creator becomes owner
    membership = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        role=ProjectRole.owner,
    )
    session.add(membership)
    await session.commit()
    await session.refresh(project)

    return _project_to_read(project, repository)


@router.get("", response_model=List[ProjectRead])
async def list_projects(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all projects the current user is a member of."""
    result = await session.exec(
        select(Project, Repository)
        .join(Repository, Project.repository_id == Repository.id)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == current_user.id, Project.is_active == True)
    )
    rows = result.all()
    return [_project_to_read(p, r) for p, r in rows]


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(Project, Repository)
        .join(Repository, Project.repository_id == Repository.id)
        .where(Project.id == project_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_read(row[0], row[1])


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: int,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await require_owner(project_id, current_user, session)
    result = await session.exec(select(Project).where(Project.id == project_id))
    project = result.first()
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    repo_result = await session.exec(select(Repository).where(Repository.id == project.repository_id))
    repo = repo_result.first()
    return _project_to_read(project, repo)


# ─────────────────────────────────────────────
# Members
# ─────────────────────────────────────────────

@router.get("/{project_id}/members", response_model=List[ProjectMemberRead])
async def list_members(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project_id)
    )
    rows = result.all()
    members = []
    for membership, user in rows:
        gh_result = await session.exec(select(GitHubAccount).where(GitHubAccount.user_id == user.id))
        gh_account = gh_result.first()
        user_read = UserRead(
            id=user.id,
            display_name=user.display_name,
            email=user.email,
            avatar_url=user.avatar_url,
            github_login=gh_account.github_login if gh_account else None,
            created_at=user.created_at,
        )
        members.append(ProjectMemberRead(
            id=membership.id,
            project_id=membership.project_id,
            user_id=membership.user_id,
            role=membership.role,
            joined_at=membership.joined_at,
            user=user_read,
        ))
    return members


@router.post("/{project_id}/members", response_model=ProjectMemberRead, status_code=201)
async def invite_member(
    project_id: int,
    data: ProjectMemberInvite,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a member by GitHub login (they must already have a MEMO account)."""
    await require_owner(project_id, current_user, session)

    # Find user by GitHub login
    gh_result = await session.exec(
        select(GitHubAccount).where(GitHubAccount.github_login == data.github_login)
    )
    gh_account = gh_result.first()
    if not gh_account:
        raise HTTPException(
            status_code=404,
            detail=f"No MEMO user found with GitHub login '{data.github_login}'. They must sign in to MEMO first."
        )

    # Check not already a member
    existing = await session.exec(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == gh_account.user_id,
        )
    )
    if existing.first():
        raise HTTPException(status_code=409, detail="User is already a member")

    membership = ProjectMember(
        project_id=project_id,
        user_id=gh_account.user_id,
        role=data.role,
        invited_by_user_id=current_user.id,
    )
    session.add(membership)
    await session.commit()
    await session.refresh(membership)

    user_result = await session.exec(select(User).where(User.id == gh_account.user_id))
    user = user_result.first()
    user_read = UserRead(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        github_login=gh_account.github_login,
        created_at=user.created_at,
    )
    return ProjectMemberRead(
        id=membership.id,
        project_id=membership.project_id,
        user_id=membership.user_id,
        role=membership.role,
        joined_at=membership.joined_at,
        user=user_read,
    )


@router.delete("/{project_id}/members/{user_id}", status_code=204)
async def remove_member(
    project_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    membership = await require_owner(project_id, current_user, session)
    # Can't remove yourself if you're the only owner
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    result = await session.exec(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    target = result.first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    await session.delete(target)
    await session.commit()


# ─────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────

@router.get("/{project_id}/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    project_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Aggregate team status for the project dashboard."""
    await get_project_membership(project_id, current_user, session)

    # Get project + repo
    proj_result = await session.exec(
        select(Project, Repository)
        .join(Repository, Project.repository_id == Repository.id)
        .where(Project.id == project_id)
    )
    proj_row = proj_result.first()
    project, repo = proj_row
    project_read = _project_to_read(project, repo)

    # Get all members
    members_result = await session.exec(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project_id)
    )
    member_rows = members_result.all()

    # Recent memos (last 10)
    memos_result = await session.exec(
        select(Memo, User)
        .join(User, Memo.author_id == User.id)
        .where(Memo.project_id == project_id, Memo.is_draft == False)
        .order_by(Memo.created_at.desc())
        .limit(10)
    )
    memo_rows = memos_result.all()
    recent_memos = [await _memo_to_read(memo, user, session) for memo, user in memo_rows]

    # Recent tasks
    tasks_result = await session.exec(
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.updated_at.desc())
        .limit(20)
    )
    recent_tasks = [_task_to_read(t) for t in tasks_result.all()]

    # Build team status cards
    team = []
    for membership, user in member_rows:
        gh_result = await session.exec(select(GitHubAccount).where(GitHubAccount.user_id == user.id))
        gh_account = gh_result.first()
        user_read = UserRead(
            id=user.id,
            display_name=user.display_name,
            email=user.email,
            avatar_url=user.avatar_url,
            github_login=gh_account.github_login if gh_account else None,
            created_at=user.created_at,
        )

        # Latest memo for this user
        latest_memo_result = await session.exec(
            select(Memo)
            .where(Memo.project_id == project_id, Memo.author_id == user.id, Memo.is_draft == False)
            .order_by(Memo.created_at.desc())
            .limit(1)
        )
        latest_memo_obj = latest_memo_result.first()
        latest_memo = await _memo_to_read(latest_memo_obj, user, session) if latest_memo_obj else None

        # Current in_progress task
        current_task_result = await session.exec(
            select(Task).where(
                Task.project_id == project_id,
                Task.assignee_id == user.id,
                Task.status == TaskStatus.in_progress,
            ).order_by(Task.updated_at.desc()).limit(1)
        )
        current_task_obj = current_task_result.first()
        current_task = _task_to_read(current_task_obj) if current_task_obj else None

        open_count_result = await session.exec(
            select(func.count(Task.id)).where(
                Task.project_id == project_id,
                Task.assignee_id == user.id,
                Task.status != TaskStatus.done,
            )
        )
        open_count = open_count_result.one()

        blocked_count_result = await session.exec(
            select(func.count(Task.id)).where(
                Task.project_id == project_id,
                Task.assignee_id == user.id,
                Task.status == TaskStatus.blocked,
            )
        )
        blocked_count = blocked_count_result.one()

        team.append(TeamMemberStatus(
            user=user_read,
            role=membership.role,
            latest_memo=latest_memo,
            current_task=current_task,
            open_tasks_count=open_count,
            blocked_tasks_count=blocked_count,
        ))

    return DashboardResponse(
        project=project_read,
        team=team,
        recent_memos=recent_memos,
        recent_tasks=recent_tasks,
    )


# ─────────────────────────────────────────────
# Serialization helpers
# ─────────────────────────────────────────────

def _project_to_read(project: Project, repo: Repository) -> ProjectRead:
    repo_read = None
    if repo:
        from app.schemas.schemas import RepositoryRead
        repo_read = RepositoryRead(
            id=repo.id,
            github_repo_id=repo.github_repo_id,
            full_name=repo.full_name,
            name=repo.name,
            owner_login=repo.owner_login,
            is_private=repo.is_private,
            default_branch=repo.default_branch,
            html_url=repo.html_url,
            installation_id=repo.installation_id,
        )
    return ProjectRead(
        id=project.id,
        name=project.name,
        description=project.description,
        repository_id=project.repository_id,
        repository=repo_read,
        is_active=project.is_active,
        created_at=project.created_at,
    )


async def _memo_to_read(memo: Memo, author: User, session: AsyncSession) -> MemoRead:
    from app.models.models import MemoGitHubActivity
    activities_result = await session.exec(
        select(MemoGitHubActivity).where(MemoGitHubActivity.memo_id == memo.id)
    )
    activities = [
        MemoGitHubActivityRead(
            id=a.id,
            activity_type=a.activity_type,
            github_id=a.github_id,
            title=a.title,
            url=a.url,
            author_login=a.author_login,
            occurred_at=a.occurred_at,
        )
        for a in activities_result.all()
    ]
    gh_result = await session.exec(select(GitHubAccount).where(GitHubAccount.user_id == author.id))
    gh_account = gh_result.first()
    author_read = UserRead(
        id=author.id,
        display_name=author.display_name,
        email=author.email,
        avatar_url=author.avatar_url,
        github_login=gh_account.github_login if gh_account else None,
        created_at=author.created_at,
    )
    return MemoRead(
        id=memo.id,
        project_id=memo.project_id,
        author_id=memo.author_id,
        author=author_read,
        completed=memo.completed,
        in_progress=memo.in_progress,
        blocked=memo.blocked,
        next_steps=memo.next_steps,
        notes=memo.notes,
        is_draft=memo.is_draft,
        github_activities=activities,
        created_at=memo.created_at,
        updated_at=memo.updated_at,
    )


def _task_to_read(task: Task) -> TaskRead:
    return TaskRead(
        id=task.id,
        project_id=task.project_id,
        source_memo_id=task.source_memo_id,
        assignee_id=task.assignee_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        github_issue_url=task.github_issue_url,
        position=task.position,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
