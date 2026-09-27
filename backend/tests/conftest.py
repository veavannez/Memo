"""
Shared pytest fixtures for MEMO backend tests.
Uses an in-memory SQLite database for fast, isolated tests.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

from app.main import app
from app.core.database import get_session
from app.models.models import User, GitHubAccount, Project, ProjectMember, Repository, GitHubInstallation


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def engine():
    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield test_engine
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def session(engine):
    TestSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with TestSessionLocal() as s:
        yield s


@pytest_asyncio.fixture(scope="function")
async def client(session):
    """AsyncClient with overridden DB session."""
    async def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


def utcnow():
    return datetime.now(timezone.utc)


@pytest_asyncio.fixture
async def test_user(session) -> User:
    user = User(display_name="Test User", email="test@example.com", avatar_url=None)
    session.add(user)
    await session.commit()
    await session.refresh(user)

    gh_account = GitHubAccount(
        user_id=user.id,
        github_user_id=12345,
        github_login="testuser",
        access_token_enc="fake_token",
        token_scope="read:user",
    )
    session.add(gh_account)
    await session.commit()
    return user


@pytest_asyncio.fixture
async def test_installation(session, test_user) -> GitHubInstallation:
    inst = GitHubInstallation(
        installation_id=99999,
        account_login="testuser",
        account_type="User",
        installer_user_id=test_user.id,
    )
    session.add(inst)
    await session.commit()
    await session.refresh(inst)
    return inst


@pytest_asyncio.fixture
async def test_repository(session, test_installation) -> Repository:
    repo = Repository(
        installation_id=test_installation.id,
        github_repo_id=111111,
        full_name="testuser/test-repo",
        name="test-repo",
        owner_login="testuser",
        is_private=False,
        default_branch="main",
        html_url="https://github.com/testuser/test-repo",
    )
    session.add(repo)
    await session.commit()
    await session.refresh(repo)
    return repo


@pytest_asyncio.fixture
async def test_project(session, test_repository, test_user) -> Project:
    project = Project(
        name="Test Project",
        description="A test project",
        repository_id=test_repository.id,
    )
    session.add(project)
    await session.flush()

    membership = ProjectMember(
        project_id=project.id,
        user_id=test_user.id,
        role="owner",
    )
    session.add(membership)
    await session.commit()
    await session.refresh(project)
    return project


def auth_headers(user_id: int) -> dict:
    """Generate auth headers with a valid JWT for a given user."""
    from app.core.security import create_access_token
    token = create_access_token(str(user_id))
    return {"Authorization": f"Bearer {token}"}
