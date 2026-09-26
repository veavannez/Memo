"""
Integration tests for Memo API endpoints.
"""
import pytest
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_create_memo(client, test_user, test_project):
    response = await client.post(
        f"/api/v1/projects/{test_project.id}/memos",
        json={
            "completed": "Fixed login bug",
            "in_progress": "Auth integration",
            "blocked": "Waiting on API spec",
            "next_steps": "- Connect frontend\n- Write tests",
            "notes": "Check the new token format",
            "is_draft": False,
        },
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["completed"] == "Fixed login bug"
    assert data["author_id"] == test_user.id
    assert data["project_id"] == test_project.id
    assert data["is_draft"] is False


@pytest.mark.asyncio
async def test_list_memos(client, test_user, test_project):
    # Create two memos
    for i in range(2):
        await client.post(
            f"/api/v1/projects/{test_project.id}/memos",
            json={"completed": f"Task {i}", "is_draft": False},
            headers=auth_headers(test_user.id),
        )

    response = await client.get(
        f"/api/v1/projects/{test_project.id}/memos",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_memo(client, test_user, test_project):
    create_resp = await client.post(
        f"/api/v1/projects/{test_project.id}/memos",
        json={"in_progress": "Working on X", "is_draft": False},
        headers=auth_headers(test_user.id),
    )
    memo_id = create_resp.json()["id"]

    response = await client.get(
        f"/api/v1/projects/{test_project.id}/memos/{memo_id}",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    assert response.json()["id"] == memo_id


@pytest.mark.asyncio
async def test_update_memo(client, test_user, test_project):
    create_resp = await client.post(
        f"/api/v1/projects/{test_project.id}/memos",
        json={"completed": "Initial work", "is_draft": True},
        headers=auth_headers(test_user.id),
    )
    memo_id = create_resp.json()["id"]

    response = await client.patch(
        f"/api/v1/projects/{test_project.id}/memos/{memo_id}",
        json={"completed": "Updated work", "is_draft": False},
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["completed"] == "Updated work"
    assert data["is_draft"] is False


@pytest.mark.asyncio
async def test_memo_only_author_can_edit(client, session, test_project):
    """Non-author cannot edit a memo."""
    from app.models.models import User, ProjectMember
    author = User(display_name="Author", email="author@example.com")
    session.add(author)
    await session.flush()
    membership = ProjectMember(project_id=test_project.id, user_id=author.id, role="member")
    session.add(membership)
    await session.commit()

    create_resp = await client.post(
        f"/api/v1/projects/{test_project.id}/memos",
        json={"completed": "Author work", "is_draft": False},
        headers=auth_headers(author.id),
    )
    memo_id = create_resp.json()["id"]

    # Different member tries to edit
    from app.models.models import User as UserModel
    other = User(display_name="Other", email="other2@example.com")
    session.add(other)
    await session.flush()
    other_membership = ProjectMember(project_id=test_project.id, user_id=other.id, role="member")
    session.add(other_membership)
    await session.commit()

    response = await client.patch(
        f"/api/v1/projects/{test_project.id}/memos/{memo_id}",
        json={"completed": "Hacked"},
        headers=auth_headers(other.id),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_memo_not_visible_outside_project(client, session, test_project, test_user):
    """A user not in the project cannot read memos."""
    outsider = User(display_name="Outsider", email="outsider@example.com")
    from app.models.models import User
    session.add(outsider)
    await session.commit()
    await session.refresh(outsider)

    create_resp = await client.post(
        f"/api/v1/projects/{test_project.id}/memos",
        json={"completed": "Secret work", "is_draft": False},
        headers=auth_headers(test_user.id),
    )
    memo_id = create_resp.json()["id"]

    response = await client.get(
        f"/api/v1/projects/{test_project.id}/memos/{memo_id}",
        headers=auth_headers(outsider.id),
    )
    assert response.status_code == 403
