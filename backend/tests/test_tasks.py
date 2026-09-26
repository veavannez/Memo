"""
Tests for tasks, Kanban status changes, and Memo-to-task conversion.
"""
import pytest
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_create_task(client, test_user, test_project):
    response = await client.post(
        f"/api/v1/projects/{test_project.id}/tasks",
        json={
            "title": "Set up CI",
            "description": "Configure GitHub Actions",
            "status": "todo",
            "priority": "high",
        },
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Set up CI"
    assert data["status"] == "todo"
    assert data["priority"] == "high"


@pytest.mark.asyncio
async def test_list_tasks(client, test_user, test_project):
    await client.post(
        f"/api/v1/projects/{test_project.id}/tasks",
        json={"title": "Task A", "status": "todo", "priority": "medium"},
        headers=auth_headers(test_user.id),
    )
    await client.post(
        f"/api/v1/projects/{test_project.id}/tasks",
        json={"title": "Task B", "status": "in_progress", "priority": "low"},
        headers=auth_headers(test_user.id),
    )

    response = await client.get(
        f"/api/v1/projects/{test_project.id}/tasks",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_filter_tasks_by_status(client, test_user, test_project):
    await client.post(
        f"/api/v1/projects/{test_project.id}/tasks",
        json={"title": "Task A", "status": "todo", "priority": "medium"},
        headers=auth_headers(test_user.id),
    )
    await client.post(
        f"/api/v1/projects/{test_project.id}/tasks",
        json={"title": "Task B", "status": "done", "priority": "low"},
        headers=auth_headers(test_user.id),
    )

    response = await client.get(
        f"/api/v1/projects/{test_project.id}/tasks?status=done",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "done"


@pytest.mark.asyncio
async def test_update_task_status_kanban(client, test_user, test_project):
    """Simulate moving a task through the Kanban board."""
    create_resp = await client.post(
        f"/api/v1/projects/{test_project.id}/tasks",
        json={"title": "Deploy API", "status": "todo", "priority": "high"},
        headers=auth_headers(test_user.id),
    )
    task_id = create_resp.json()["id"]

    # Move to in_progress
    response = await client.patch(
        f"/api/v1/projects/{test_project.id}/tasks/{task_id}",
        json={"status": "in_progress"},
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

    # Move to blocked
    response = await client.patch(
        f"/api/v1/projects/{test_project.id}/tasks/{task_id}",
        json={"status": "blocked"},
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "blocked"

    # Move to done
    response = await client.patch(
        f"/api/v1/projects/{test_project.id}/tasks/{task_id}",
        json={"status": "done"},
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "done"


@pytest.mark.asyncio
async def test_tasks_from_memo(client, test_user, test_project):
    """Convert Memo next_steps into tasks."""
    memo_resp = await client.post(
        f"/api/v1/projects/{test_project.id}/memos",
        json={
            "next_steps": "- Connect frontend\n- Write tests\n- Update docs",
            "is_draft": False,
        },
        headers=auth_headers(test_user.id),
    )
    memo_id = memo_resp.json()["id"]

    response = await client.post(
        f"/api/v1/projects/{test_project.id}/tasks/from-memo/{memo_id}",
        json={
            "next_steps": ["Connect frontend", "Write tests", "Update docs"],
            "assignee_id": test_user.id,
            "priority": "medium",
        },
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 3
    titles = [t["title"] for t in data]
    assert "Connect frontend" in titles
    assert "Write tests" in titles
    assert all(t["source_memo_id"] == memo_id for t in data)
    assert all(t["assignee_id"] == test_user.id for t in data)


@pytest.mark.asyncio
async def test_task_assignee_must_be_member(client, test_user, test_project, session):
    """Cannot assign a task to someone not in the project."""
    from app.models.models import User
    outsider = User(display_name="Outsider", email="outsider3@example.com")
    session.add(outsider)
    await session.commit()
    await session.refresh(outsider)

    response = await client.post(
        f"/api/v1/projects/{test_project.id}/tasks",
        json={"title": "Bad task", "status": "todo", "priority": "low", "assignee_id": outsider.id},
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_catch_me_up(client, test_user, test_project):
    # Create a memo
    await client.post(
        f"/api/v1/projects/{test_project.id}/memos",
        json={"in_progress": "Auth integration", "blocked": "API spec missing", "is_draft": False},
        headers=auth_headers(test_user.id),
    )
    # Create a task
    await client.post(
        f"/api/v1/projects/{test_project.id}/tasks",
        json={"title": "Connect frontend", "status": "in_progress", "priority": "high"},
        headers=auth_headers(test_user.id),
    )

    response = await client.get(
        f"/api/v1/projects/{test_project.id}/catch-me-up",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == test_user.id
    assert data["last_session_memo"] is not None
    assert len(data["summary_lines"]) > 0


@pytest.mark.asyncio
async def test_webhook_signature_verification():
    """Unit test webhook signature verification."""
    import hmac as hmac_lib
    import hashlib
    from app.services.github_service import verify_webhook_signature
    from app.core.config import settings

    original_secret = settings.GITHUB_APP_WEBHOOK_SECRET
    settings.GITHUB_APP_WEBHOOK_SECRET = "test-secret"

    payload = b'{"action": "opened"}'
    sig = "sha256=" + hmac_lib.new(b"test-secret", payload, hashlib.sha256).hexdigest()

    assert verify_webhook_signature(payload, sig) is True
    assert verify_webhook_signature(payload, "sha256=invalidsig") is False
    assert verify_webhook_signature(payload, None) is False

    settings.GITHUB_APP_WEBHOOK_SECRET = original_secret
