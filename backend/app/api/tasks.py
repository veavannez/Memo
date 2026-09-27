"""
Task routes — CRUD, Kanban status, Memo-to-task conversion.
"""
import json
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.models.models import User, Task, Memo, ProjectMember, GitHubAccount, TaskStatus
from app.schemas.schemas import (
    TaskCreate, TaskUpdate, TaskRead, TaskFromNextSteps, UserRead,
)
from app.api.deps import get_current_user
from app.api.projects import get_project_membership

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])


def _task_to_read(task: Task, assignee: Optional[User] = None, gh_login: Optional[str] = None) -> TaskRead:
    assignee_read = None
    if assignee:
        assignee_read = UserRead(
            id=assignee.id,
            display_name=assignee.display_name,
            email=assignee.email,
            avatar_url=assignee.avatar_url,
            github_login=gh_login,
            created_at=assignee.created_at,
        )
    return TaskRead(
        id=task.id,
        project_id=task.project_id,
        source_memo_id=task.source_memo_id,
        assignee_id=task.assignee_id,
        assignee=assignee_read,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        github_issue_url=task.github_issue_url,
        source_type=task.source_type,
        source_gap_id=task.source_gap_id,
        source_evidence=json.loads(task.source_evidence_json or "[]"),
        ai_generated=task.ai_generated,
        assignment_reason=task.assignment_reason,
        assignment_confidence=task.assignment_confidence,
        position=task.position,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def _enrich_task(task: Task, session: AsyncSession) -> TaskRead:
    assignee = None
    gh_login = None
    if task.assignee_id:
        result = await session.exec(select(User).where(User.id == task.assignee_id))
        assignee = result.first()
        if assignee:
            gh_result = await session.exec(
                select(GitHubAccount).where(GitHubAccount.user_id == assignee.id)
            )
            gh_account = gh_result.first()
            gh_login = gh_account.github_login if gh_account else None
    return _task_to_read(task, assignee, gh_login)


@router.post("", response_model=TaskRead, status_code=201)
async def create_task(
    project_id: int,
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)

    # Validate assignee is a project member if provided
    if data.assignee_id:
        member_check = await session.exec(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == data.assignee_id,
            )
        )
        if not member_check.first():
            raise HTTPException(status_code=400, detail="Assignee is not a project member")

    # Validate source memo belongs to this project
    if data.source_memo_id:
        memo_check = await session.exec(
            select(Memo).where(Memo.id == data.source_memo_id, Memo.project_id == project_id)
        )
        if not memo_check.first():
            raise HTTPException(status_code=400, detail="Source memo not found in this project")

    task = Task(
        project_id=project_id,
        title=data.title,
        description=data.description,
        status=data.status,
        priority=data.priority,
        assignee_id=data.assignee_id,
        source_memo_id=data.source_memo_id,
        github_issue_url=data.github_issue_url,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return await _enrich_task(task, session)


@router.post("/from-memo/{memo_id}", response_model=List[TaskRead], status_code=201)
async def create_tasks_from_memo(
    project_id: int,
    memo_id: int,
    data: TaskFromNextSteps,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Convert Memo next_steps lines into individual tasks."""
    await get_project_membership(project_id, current_user, session)

    memo_check = await session.exec(
        select(Memo).where(Memo.id == memo_id, Memo.project_id == project_id)
    )
    if not memo_check.first():
        raise HTTPException(status_code=404, detail="Memo not found")

    if data.assignee_id:
        member_check = await session.exec(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == data.assignee_id,
            )
        )
        if not member_check.first():
            raise HTTPException(status_code=400, detail="Assignee is not a project member")

    created_tasks = []
    for i, step in enumerate(data.next_steps):
        step = step.strip()
        if not step:
            continue
        task = Task(
            project_id=project_id,
            source_memo_id=memo_id,
            title=step,
            status=TaskStatus.todo,
            priority=data.priority,
            assignee_id=data.assignee_id,
            position=i,
        )
        session.add(task)
        created_tasks.append(task)

    await session.commit()
    for t in created_tasks:
        await session.refresh(t)
    return [await _enrich_task(t, session) for t in created_tasks]


@router.get("", response_model=List[TaskRead])
async def list_tasks(
    project_id: int,
    status: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)

    query = select(Task).where(Task.project_id == project_id)
    if status:
        query = query.where(Task.status == status)
    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)
    query = query.order_by(Task.position, Task.created_at)

    result = await session.exec(query)
    tasks = result.all()
    return [await _enrich_task(t, session) for t in tasks]


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(
    project_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return await _enrich_task(task, session)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    project_id: int,
    task_id: int,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.status is not None:
        task.status = data.status
    if data.priority is not None:
        task.priority = data.priority
    if data.assignee_id is not None:
        # Validate assignee
        member_check = await session.exec(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == data.assignee_id,
            )
        )
        if not member_check.first():
            raise HTTPException(status_code=400, detail="Assignee is not a project member")
        task.assignee_id = data.assignee_id
    if data.github_issue_url is not None:
        task.github_issue_url = data.github_issue_url
    if data.position is not None:
        task.position = data.position
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return await _enrich_task(task, session)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    project_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    membership = await get_project_membership(project_id, current_user, session)
    result = await session.exec(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    task = result.first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    # Only assignee or project owner can delete
    if task.assignee_id != current_user.id and membership.role != "owner":
        raise HTTPException(status_code=403, detail="Not authorized to delete this task")
    await session.delete(task)
    await session.commit()
