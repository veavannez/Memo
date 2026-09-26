"""
GitHub App service — handles GitHub API calls using installation tokens.
Uses PyGithub for convenience and httpx for direct calls where needed.
"""
import time
import json
import hashlib
import hmac
from typing import Optional, List
from datetime import datetime, timezone, timedelta

import httpx
import jwt as pyjwt

from app.core.config import settings


def _generate_app_jwt() -> Optional[str]:
    """Generate a JWT for authenticating as the GitHub App itself."""
    key = settings.github_private_key
    if not key or not settings.GITHUB_APP_ID:
        return None
    now = int(time.time())
    payload = {
        "iat": now - 60,  # issued 60s ago to allow clock drift
        "exp": now + 600,  # expires in 10 minutes
        "iss": settings.GITHUB_APP_ID,
    }
    return pyjwt.encode(payload, key, algorithm="RS256")


async def get_installation_token(installation_id: int) -> Optional[str]:
    """Exchange an installation ID for a short-lived installation access token."""
    app_jwt = _generate_app_jwt()
    if not app_jwt:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        if resp.status_code == 201:
            return resp.json()["token"]
    return None


async def get_user_from_token(access_token: str) -> Optional[dict]:
    """Fetch GitHub user info using an OAuth access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"token {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        if resp.status_code == 200:
            return resp.json()
    return None


async def exchange_code_for_token(code: str) -> Optional[dict]:
    """Exchange GitHub OAuth code for an access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_APP_CLIENT_ID,
                "client_secret": settings.GITHUB_APP_CLIENT_SECRET,
                "code": code,
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            if "access_token" in data:
                return data
    return None


async def get_installations_for_user(access_token: str) -> List[dict]:
    """List GitHub App installations accessible to a user."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/installations",
            headers={
                "Authorization": f"token {access_token}",
                "Accept": "application/vnd.github+json",
            },
        )
        if resp.status_code == 200:
            return resp.json().get("installations", [])
    return []


async def get_installation_repositories(installation_id: int) -> List[dict]:
    """List repositories accessible to an installation."""
    token = await get_installation_token(installation_id)
    if not token:
        return []
    all_repos = []
    page = 1
    async with httpx.AsyncClient() as client:
        while True:
            resp = await client.get(
                f"https://api.github.com/installation/repositories?per_page=100&page={page}",
                headers={
                    "Authorization": f"token {token}",
                    "Accept": "application/vnd.github+json",
                },
            )
            if resp.status_code != 200:
                break
            data = resp.json()
            repos = data.get("repositories", [])
            all_repos.extend(repos)
            if len(repos) < 100:
                break
            page += 1
    return all_repos


async def get_recent_commits(
    installation_id: int,
    repo_full_name: str,
    author_login: Optional[str] = None,
    since: Optional[datetime] = None,
    max_results: int = 20,
) -> List[dict]:
    """Fetch recent commits from a repository."""
    token = await get_installation_token(installation_id)
    if not token:
        return []
    params: dict = {"per_page": max_results}
    if author_login:
        params["author"] = author_login
    if since:
        params["since"] = since.isoformat()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo_full_name}/commits",
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github+json",
            },
            params=params,
        )
        if resp.status_code == 200:
            return resp.json()
    return []


async def get_recent_pull_requests(
    installation_id: int,
    repo_full_name: str,
    state: str = "all",
    max_results: int = 10,
) -> List[dict]:
    """Fetch recent pull requests from a repository."""
    token = await get_installation_token(installation_id)
    if not token:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo_full_name}/pulls",
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github+json",
            },
            params={"state": state, "per_page": max_results, "sort": "updated"},
        )
        if resp.status_code == 200:
            return resp.json()
    return []


async def get_recent_issues(
    installation_id: int,
    repo_full_name: str,
    state: str = "open",
    max_results: int = 10,
) -> List[dict]:
    """Fetch recent issues from a repository (excludes PRs)."""
    token = await get_installation_token(installation_id)
    if not token:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo_full_name}/issues",
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github+json",
            },
            params={"state": state, "per_page": max_results, "sort": "updated"},
        )
        if resp.status_code == 200:
            # GitHub issues endpoint includes PRs; filter them out
            return [i for i in resp.json() if "pull_request" not in i]
    return []


async def get_user_by_login(installation_id: int, login: str) -> Optional[dict]:
    """Fetch a GitHub user profile by login."""
    token = await get_installation_token(installation_id)
    if not token:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/users/{login}",
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github+json",
            },
        )
        if resp.status_code == 200:
            return resp.json()
    return None


def verify_webhook_signature(payload: bytes, signature_header: Optional[str]) -> bool:
    """Verify GitHub webhook payload signature using HMAC-SHA256."""
    secret = settings.GITHUB_APP_WEBHOOK_SECRET
    if not secret:
        return True  # Dev mode: skip verification if no secret configured
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    mac = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256)
    expected = "sha256=" + mac.hexdigest()
    return hmac.compare_digest(expected, signature_header)
