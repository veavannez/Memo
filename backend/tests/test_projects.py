"""
Integration tests for project API endpoints.
"""
import pytest
import pytest_asyncio
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_create_project(client, test_user, test_repository):
    response = await client.post(
        "/api/v1/projects",
        json={"name": "My Project", "repository_id": test_repository.id},
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Project"
    assert data["repository_id"] == test_repository.id
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_create_project_invalid_repo(client, test_user):
    response = await client.post(
        "/api/v1/projects",
        json={"name": "Bad Project", "repository_id": 99999},
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_projects(client, test_user, test_project):
    response = await client.get(
        "/api/v1/projects",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(p["id"] == test_project.id for p in data)


@pytest.mark.asyncio
async def test_get_project(client, test_user, test_project):
    response = await client.get(
        f"/api/v1/projects/{test_project.id}",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_project.id


@pytest.mark.asyncio
async def test_get_project_unauthorized(client, session, test_project):
    """User with no membership cannot access the project."""
    from app.models.models import User
    other_user = User(display_name="Other", email="other@example.com")
    session.add(other_user)
    await session.commit()
    await session.refresh(other_user)

    response = await client.get(
        f"/api/v1/projects/{test_project.id}",
        headers=auth_headers(other_user.id),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_members(client, test_user, test_project):
    response = await client.get(
        f"/api/v1/projects/{test_project.id}/members",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["user_id"] == test_user.id
    assert data[0]["role"] == "owner"


@pytest.mark.asyncio
async def test_dashboard(client, test_user, test_project):
    response = await client.get(
        f"/api/v1/projects/{test_project.id}/dashboard",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    data = response.json()
    assert "project" in data
    assert "team" in data
    assert "recent_memos" in data
    assert "recent_tasks" in data
