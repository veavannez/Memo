"""
Auth routes — GitHub OAuth flow and session management.
"""
import secrets
from urllib.parse import urlencode
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Cookie
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.core.config import settings
from app.core.database import get_session
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.models import User, GitHubAccount
from app.schemas.schemas import TokenResponse, UserRead
from app.services import github_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory state store for OAuth CSRF protection (use Redis in production)
_oauth_states: dict[str, str] = {}


@router.get("/github/login")
async def github_login(request: Request):
    """Redirect URL generator for GitHub OAuth flow."""
    if not settings.GITHUB_APP_CLIENT_ID or not settings.GITHUB_APP_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "GitHub OAuth is not configured. Set GITHUB_APP_CLIENT_ID and "
                "GITHUB_APP_CLIENT_SECRET in backend/.env, then restart the backend."
            ),
        )

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = state
    install_url = (
        f"https://github.com/apps/{settings.GITHUB_APP_SLUG}/installations/new"
        f"?state={state}"
    )
    # Bind OAuth to the frontend origin that initiated the request.
    request_origin = request.headers.get("origin", "").rstrip("/")
    frontend_origin = (
        request_origin if request_origin in settings.cors_origins
        else settings.FRONTEND_URL.rstrip("/")
    )
    redirect_uri = f"{frontend_origin}/auth/callback"
    auth_url = "https://github.com/login/oauth/authorize?" + urlencode({
        "client_id": settings.GITHUB_APP_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "read:user,user:email",
    })
    return {
        "auth_url": auth_url,
        "install_url": install_url,
        "state": state,
    }


@router.post("/github/callback")
async def github_callback(
    code: str,
    state: str,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """
    Handle GitHub OAuth callback.
    Exchange code → access token → user info → create/update MEMO user.
    """
    # Validate state (CSRF protection)
    if state not in _oauth_states:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")
    del _oauth_states[state]

    # Exchange code for GitHub access token
    token_data = await github_service.exchange_code_for_token(code)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange OAuth code for token",
        )

    access_token = token_data["access_token"]
    scope = token_data.get("scope", "")

    # Fetch GitHub user info
    gh_user = await github_service.get_user_from_token(access_token)
    if not gh_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch GitHub user info",
        )

    github_user_id = gh_user["id"]
    github_login = gh_user["login"]
    avatar_url = gh_user.get("avatar_url")
    display_name = gh_user.get("name") or github_login
    email = gh_user.get("email")

    # Find or create MEMO user
    result = await session.exec(
        select(GitHubAccount).where(GitHubAccount.github_user_id == github_user_id)
    )
    github_account = result.first()

    if github_account:
        # Update existing account
        user_result = await session.exec(select(User).where(User.id == github_account.user_id))
        user = user_result.first()
        if not user:
            raise HTTPException(status_code=500, detail="User record inconsistency")
        user.avatar_url = avatar_url
        user.display_name = display_name
        if email:
            user.email = email
        user.updated_at = datetime.now(timezone.utc)
        github_account.access_token_enc = access_token  # TODO: encrypt in production
        github_account.token_scope = scope
        github_account.github_login = github_login
        github_account.updated_at = datetime.now(timezone.utc)
        session.add(user)
        session.add(github_account)
    else:
        # Create new user
        user = User(
            display_name=display_name,
            email=email,
            avatar_url=avatar_url,
        )
        session.add(user)
        await session.flush()  # Get user.id

        github_account = GitHubAccount(
            user_id=user.id,
            github_user_id=github_user_id,
            github_login=github_login,
            access_token_enc=access_token,  # TODO: encrypt in production
            token_scope=scope,
        )
        session.add(github_account)

    await session.commit()
    await session.refresh(user)

    # Issue MEMO JWT
    memo_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # Set httpOnly cookie for web clients
    response.set_cookie(
        "access_token",
        memo_token,
        httponly=True,
        secure=False,  # Set True in production with HTTPS
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )

    user_read = UserRead(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        avatar_url=user.avatar_url,
        github_login=github_account.github_login,
        created_at=user.created_at,
    )

    return TokenResponse(access_token=memo_token, user=user_read)


@router.post("/refresh")
async def refresh_token_endpoint(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Issue a new access token using a valid refresh token."""
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await session.exec(select(User).where(User.id == int(user_id)))
    user = result.first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_token = create_access_token(str(user.id))
    response.set_cookie("access_token", new_token, httponly=True, secure=False, samesite="lax",
                        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    return {"access_token": new_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    """Clear auth cookies."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserRead)
async def get_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return current authenticated user."""
    result = await session.exec(
        select(GitHubAccount).where(GitHubAccount.user_id == current_user.id)
    )
    github_account = result.first()
    return UserRead(
        id=current_user.id,
        display_name=current_user.display_name,
        email=current_user.email,
        avatar_url=current_user.avatar_url,
        github_login=github_account.github_login if github_account else None,
        created_at=current_user.created_at,
    )
