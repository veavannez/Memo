import pytest
from sqlalchemy import select

from app.api import intelligence
from app.models.models import DetectedGapRecord, Task
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_gap_review_flow(client, session, test_user, test_project, monkeypatch):
    async def fake_context(repo, installation):
        return {"openPullRequests": [], "openIssues": []}

    async def fake_analysis(context, memo, tasks):
        return {
            "projectState": {"completed": [], "inProgress": [], "blocked": []},
            "detectedGaps": [{
                "category": "TESTING",
                "title": "Add expired-token test",
                "description": "Refresh logic changed without matching test activity.",
                "reason": "Observed implementation and test evidence do not cover expiry.",
                "confidence": 0.83,
                "evidence": ["src/auth/refresh.ts", "tests/auth/token.test.ts"],
            }],
            "suggestedNextSteps": [],
            "generatedAt": "2026-01-01T00:00:00Z",
            "modelId": "test-model",
            "isFallback": False,
        }

    monkeypatch.setattr(intelligence, "_fetch_project_context", fake_context)
    monkeypatch.setattr(intelligence.watsonx_service, "analyze_project_context", fake_analysis)

    response = await client.post(
        f"/api/v1/projects/{test_project.id}/intelligence/analyze",
        headers=auth_headers(test_user.id),
    )
    assert response.status_code == 200
    gap = response.json()["detectedGaps"][0]
    assert gap["category"] == "TESTING"
    assert gap["evidence"]
    assert gap["id"]

    edited = await client.patch(
        f"/api/v1/projects/{test_project.id}/intelligence/gaps/{gap['id']}",
        json={"title": "Test expired refresh tokens", "category": "SECURITY"},
        headers=auth_headers(test_user.id),
    )
    assert edited.status_code == 200
    assert edited.json()["category"] == "SECURITY"

    created = await client.post(
        f"/api/v1/projects/{test_project.id}/intelligence/gaps/{gap['id']}/task",
        json={"title": "Test expired refresh tokens", "priority": "high"},
        headers=auth_headers(test_user.id),
    )
    assert created.status_code == 201
    assert created.json()["priority"] == "high"

    record = (await session.execute(select(DetectedGapRecord))).scalar_one()
    assert record.status == "created"
    assert (await session.execute(select(Task))).scalar_one().title == "Test expired refresh tokens"


@pytest.mark.asyncio
async def test_dismissed_gap_does_not_return(client, test_user, test_project, monkeypatch):
    raw_gap = {
        "category": "INTEGRATION", "title": "Connect frontend", "description": "Backend only evidence.",
        "reason": "No client change in this window.", "confidence": 0.6, "evidence": ["api/auth.py"],
    }

    async def fake_context(repo, installation): return {"openPullRequests": [], "openIssues": []}
    async def fake_detect(context, tasks): return [raw_gap]
    monkeypatch.setattr(intelligence, "_fetch_project_context", fake_context)
    monkeypatch.setattr(intelligence.watsonx_service, "detect_missing_work", fake_detect)

    first = await client.post(f"/api/v1/projects/{test_project.id}/intelligence/detect-gaps", headers=auth_headers(test_user.id))
    gap_id = first.json()[0]["id"]
    dismissed = await client.post(f"/api/v1/projects/{test_project.id}/intelligence/gaps/{gap_id}/dismiss", headers=auth_headers(test_user.id))
    assert dismissed.status_code == 204
    second = await client.post(f"/api/v1/projects/{test_project.id}/intelligence/detect-gaps", headers=auth_headers(test_user.id))
    assert second.json() == []