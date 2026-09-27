"""
GitHub integration routes — installations, repositories, and project context.
"""
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from datetime import datetime, timezone

from app.core.database import get_session
from app.core.config import settings
from app.models.models import User, GitHubAccount, GitHubInstallation, Repository
from app.schemas.schemas import InstallationRead, RepositoryRead
from app.services import github_service
from app.services.github_normalizer import build_project_context
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
    if not settings.GITHUB_APP_ID or not settings.github_private_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "GitHub repository access is not configured. Check GITHUB_APP_ID "
                "and GITHUB_APP_PRIVATE_KEY_PATH in backend/.env, then restart the backend."
            ),
        )

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


# ─── Repository metadata ──────────────────────────────────────────────────────

@router.get("/repos/{owner}/{repo}/metadata")
async def get_repo_metadata(
    owner: str,
    repo: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Return enriched repository metadata (description, language, stars, etc.)
    from GitHub. Requires the MEMO GitHub App to be installed on the account.
    """
    full_name = f"{owner}/{repo}"
    # Find the installation record for this repo
    repo_result = await session.exec(
        select(Repository).where(Repository.full_name == full_name)
    )
    db_repo = repo_result.first()
    if not db_repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository {full_name} not found. Install the MEMO GitHub App first.",
        )

    # Get the installation
    inst_result = await session.exec(
        select(GitHubInstallation).where(GitHubInstallation.id == db_repo.installation_id)
    )
    db_inst = inst_result.first()
    if not db_inst:
        raise HTTPException(status_code=404, detail="Installation not found")

    meta = await github_service.get_repository_metadata(db_inst.installation_id, full_name)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch repository metadata from GitHub. Check installation permissions.",
        )
    return meta


# ─── Project context collection ───────────────────────────────────────────────

@router.get("/repos/{owner}/{repo}/context")
async def get_project_context(
    owner: str,
    repo: str,
    branch: Optional[str] = Query(default=None, description="Branch to collect context for. Defaults to default branch."),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Collect and normalise the full project context for a repository.

    Returns a ProjectContext object containing:
    - Repository metadata
    - Recent commits with diff stats
    - Open pull requests with file lists
    - Open issues
    - Branches
    - Recent file changes
    - Contributors

    Requires the MEMO GitHub App to be installed on the repository.
    """
    full_name = f"{owner}/{repo}"

    # Resolve the DB repo + installation
    repo_result = await session.exec(
        select(Repository).where(Repository.full_name == full_name)
    )
    db_repo = repo_result.first()
    if not db_repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository {full_name} not found in MEMO. "
                   "Install the GitHub App and sync the repository first.",
        )

    inst_result = await session.exec(
        select(GitHubInstallation).where(GitHubInstallation.id == db_repo.installation_id)
    )
    db_inst = inst_result.first()
    if not db_inst or not db_inst.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="GitHub App installation is inactive or not found. Please reinstall.",
        )

    installation_id = db_inst.installation_id
    active_branch = branch or db_repo.default_branch

    # Collect data in parallel where possible — sequential here for simplicity
    # (could be asyncio.gather in future)
    repo_meta = await github_service.get_repository_metadata(installation_id, full_name)
    if not repo_meta:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GitHub API unreachable or installation token expired. Try reinstalling the GitHub App.",
        )

    commits = await github_service.get_commits_with_stats(
        installation_id, full_name, branch=active_branch, max_results=20
    )
    pull_requests = await github_service.get_pull_requests_with_files(
        installation_id, full_name, state="open", max_results=15
    )
    issues = await github_service.get_issues_with_comments(
        installation_id, full_name, state="open", max_results=20
    )
    branches = await github_service.get_branches(installation_id, full_name, max_results=30)
    contributors = await github_service.get_contributors(installation_id, full_name, max_results=20)

    context = build_project_context(
        repo_meta=repo_meta,
        commits=commits,
        pull_requests=pull_requests,
        issues=issues,
        branches=branches,
        contributors=contributors,
        active_branch=active_branch,
    )
    return context
