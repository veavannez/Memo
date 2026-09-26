"""
Webhook receiver — validates GitHub signatures, deduplicates, processes events.
"""
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, Depends, Header
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import get_session
from app.models.models import GitHubEvent, GitHubInstallation, Repository
from app.services.github_service import verify_webhook_signature

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


@router.post("/github")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(None),
    x_github_delivery: str = Header(None),
    x_hub_signature_256: str = Header(None),
    session: AsyncSession = Depends(get_session),
):
    """
    Receive and process GitHub App webhooks.
    - Validates HMAC-SHA256 signature
    - Deduplicates by X-GitHub-Delivery ID
    - Processes relevant events
    """
    if not x_github_event or not x_github_delivery:
        raise HTTPException(status_code=400, detail="Missing required GitHub headers")

    body = await request.body()

    # Verify signature
    if not verify_webhook_signature(body, x_hub_signature_256):
        logger.warning(f"Invalid webhook signature for delivery {x_github_delivery}")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Deduplicate by delivery ID
    try:
        event_record = GitHubEvent(
            delivery_id=x_github_delivery,
            event_type=x_github_event,
            received_at=datetime.now(timezone.utc),
        )
        session.add(event_record)
        await session.flush()
    except IntegrityError:
        # Already processed this delivery
        logger.info(f"Duplicate webhook delivery {x_github_delivery}, skipping")
        await session.rollback()
        return {"status": "duplicate", "delivery_id": x_github_delivery}

    # Parse payload
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    action = payload.get("action", "")
    installation_id = payload.get("installation", {}).get("id")

    event_record.action = action
    event_record.installation_id = installation_id
    if "repository" in payload:
        event_record.repository_full_name = payload["repository"].get("full_name")

    # Route to event handlers
    try:
        if x_github_event == "installation":
            await _handle_installation(payload, action, installation_id, session)
        elif x_github_event == "installation_repositories":
            await _handle_installation_repositories(payload, action, installation_id, session)
        elif x_github_event in ("push", "pull_request", "issues"):
            # These are stored for activity context; no active processing needed at this stage
            logger.info(f"Received {x_github_event} event for {event_record.repository_full_name}")

        event_record.processed = True
    except Exception as e:
        logger.exception(f"Error processing webhook {x_github_delivery}: {e}")
        # Still commit the record to prevent reprocessing; mark as unprocessed
        event_record.processed = False

    await session.commit()
    return {"status": "ok", "delivery_id": x_github_delivery}


async def _handle_installation(
    payload: dict,
    action: str,
    installation_id: int,
    session: AsyncSession,
):
    """Handle GitHub App installation events."""
    if action == "deleted" or action == "suspend":
        result = await session.exec(
            select(GitHubInstallation).where(
                GitHubInstallation.installation_id == installation_id
            )
        )
        inst = result.first()
        if inst:
            inst.is_active = False
            inst.updated_at = datetime.now(timezone.utc)
            session.add(inst)
            # Mark all repos inactive
            repos_result = await session.exec(
                select(Repository).where(Repository.installation_id == inst.id)
            )
            for repo in repos_result.all():
                repo.is_active = False
                session.add(repo)
            logger.info(f"Deactivated installation {installation_id} (action={action})")

    elif action == "unsuspend":
        result = await session.exec(
            select(GitHubInstallation).where(
                GitHubInstallation.installation_id == installation_id
            )
        )
        inst = result.first()
        if inst:
            inst.is_active = True
            inst.updated_at = datetime.now(timezone.utc)
            session.add(inst)


async def _handle_installation_repositories(
    payload: dict,
    action: str,
    installation_id: int,
    session: AsyncSession,
):
    """Handle repositories being added/removed from an installation."""
    inst_result = await session.exec(
        select(GitHubInstallation).where(
            GitHubInstallation.installation_id == installation_id
        )
    )
    db_installation = inst_result.first()
    if not db_installation:
        logger.warning(f"Received repo event for unknown installation {installation_id}")
        return

    if action == "removed":
        removed_repos = payload.get("repositories_removed", [])
        for repo_data in removed_repos:
            repo_result = await session.exec(
                select(Repository).where(
                    Repository.github_repo_id == repo_data["id"]
                )
            )
            repo = repo_result.first()
            if repo:
                repo.is_active = False
                repo.updated_at = datetime.now(timezone.utc)
                session.add(repo)
                logger.info(f"Deactivated repository {repo_data.get('full_name')}")

    elif action == "added":
        added_repos = payload.get("repositories_added", [])
        for repo_data in added_repos:
            existing = await session.exec(
                select(Repository).where(
                    Repository.github_repo_id == repo_data["id"]
                )
            )
            repo = existing.first()
            if repo:
                repo.is_active = True
                repo.updated_at = datetime.now(timezone.utc)
            else:
                repo = Repository(
                    installation_id=db_installation.id,
                    github_repo_id=repo_data["id"],
                    full_name=repo_data.get("full_name", ""),
                    name=repo_data.get("name", ""),
                    owner_login=repo_data.get("full_name", "/").split("/")[0],
                    is_private=repo_data.get("private", False),
                )
            session.add(repo)
