"""
GitHub integration routes — installations and repositories.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_session
from app.models.models import User, GitHubAccount, GitHubInstallation, Repository
from app.schemas.schemas import InstallationRead, RepositoryRead
from app.services import github_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/github", tags=["github"])


async def _get_user_github_account(user: User, session: AsyncSession) -> GitHubAccount:
    result = await session.exec(
        select(GitHubAccount).where(GitHubAccount.user_id == user.id)
    )
    account = result.first()
    if not account:
        raise HTTPException(status_code=400, detail="No GitHub account linked")
    return account


@router.get("/installations", response_model=List[InstallationRead])
async def list_installations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    List GitHub App installations accessible to the current user.
    Syncs from GitHub API and stores locally.
    """
    account = await _get_user_github_account(current_user, session)
    gh_installations = await github_service.get_installations_for_user(account.access_token_enc)

    results = []
    for inst in gh_installations:
        installation_id = inst["id"]
        account_login = inst["account"]["login"]
        account_type = inst["account"]["type"]
        avatar_url = inst["account"].get("avatar_url")

        # Upsert installation record
        existing = await session.exec(
            select(GitHubInstallation).where(
                GitHubInstallation.installation_id == installation_id
            )
        )
        db_inst = existing.first()
        if db_inst:
            db_inst.account_login = account_login
            db_inst.account_avatar_url = avatar_url
            db_inst.is_active = True
            db_inst.updated_at = datetime.now(timezone.utc)
        else:
            db_inst = GitHubInstallation(
                installation_id=installation_id,
                account_login=account_login,
                account_type=account_type,
                account_avatar_url=avatar_url,
                installer_user_id=current_user.id,
            )
        session.add(db_inst)
        results.append(db_inst)

    await session.commit()
    for inst in results:
        await session.refresh(inst)
    return results


@router.get("/installations/{installation_id}/repositories", response_model=List[RepositoryRead])
async def list_installation_repositories(
    installation_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    List repositories accessible to a GitHub App installation.
    Syncs from GitHub API and stores locally.
    """
    # Verify the installation exists and is accessible
    inst_result = await session.exec(
        select(GitHubInstallation).where(
            GitHubInstallation.installation_id == installation_id
        )
    )
    db_installation = inst_result.first()
    if not db_installation:
        raise HTTPException(status_code=404, detail="Installation not found")

    gh_repos = await github_service.get_installation_repositories(installation_id)

    results = []
    for repo in gh_repos:
        github_repo_id = repo["id"]
        existing = await session.exec(
            select(Repository).where(Repository.github_repo_id == github_repo_id)
        )
        db_repo = existing.first()
        if db_repo:
            db_repo.full_name = repo["full_name"]
            db_repo.name = repo["name"]
            db_repo.is_private = repo.get("private", False)
            db_repo.default_branch = repo.get("default_branch", "main")
            db_repo.html_url = repo.get("html_url")
            db_repo.is_active = True
            db_repo.updated_at = datetime.now(timezone.utc)
        else:
            db_repo = Repository(
                installation_id=db_installation.id,
                github_repo_id=github_repo_id,
                full_name=repo["full_name"],
                name=repo["name"],
                owner_login=repo["full_name"].split("/")[0],
                is_private=repo.get("private", False),
                default_branch=repo.get("default_branch", "main"),
                html_url=repo.get("html_url"),
            )
        session.add(db_repo)
        results.append(db_repo)

    await session.commit()
    for r in results:
        await session.refresh(r)
    return results
