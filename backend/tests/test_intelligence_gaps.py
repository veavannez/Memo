import pytest
from sqlalchemy import select

from app.api import intelligence
from app.models.models import DetectedGapRecord, Task
from tests.conftest import auth_headers


@pytest.mark.asyncio
async def test_gap_review_flow(client, session, test_user, test_project, monkeypatch):
    async def fake_context(repo, installation):
        return {"openPullRequests": [], "openIssues": [], "recentCommits": [{"author": "testuser", "changedFiles": ["src/auth/refresh.ts"], "url": "https://github.com/test/repo/commit/abc"}]}

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

    suggestion = await client.get(
        f"/api/v1/projects/{test_project.id}/intelligence/gaps/{gap['id']}/task-suggestion",
        headers=auth_headers(test_user.id),
    )
    assert suggestion.status_code == 200
    assert suggestion.json()["repository"] == "testuser/test-repo"
    assert suggestion.json()["suggested_owner_id"] == test_user.id
    assert "src/auth/refresh.ts" in suggestion.json()["assignment_reason"]

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
    assert created.json()["status"] == "todo"
    assert created.json()["ai_generated"] is True
    assert created.json()["source_type"] == "detected_gap"
    assert created.json()["source_gap_id"] == gap["id"]
    assert created.json()["source_evidence"] == ["src/auth/refresh.ts", "tests/auth/token.test.ts"]

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

def test_meaningful_changes_groups_signal_without_noise():
    from app.api.intelligence import _meaningful_changes
    previous = {"recentCommits": [{"sha": "old"}], "openPullRequests": [{"number": 4, "state": "open"}], "openIssues": [{"number": 9, "state": "open"}], "recentFileChanges": [], "contributors": ["alex"]}
    current = {"recentCommits": [{"sha": "new", "shortSha": "new", "message": "add auth tests"}], "openPullRequests": [{"number": 4, "state": "merged", "title": "Auth", "url": "https://github.test/pr/4"}], "openIssues": [{"number": 9, "state": "closed", "title": "Bug", "url": "https://github.test/issues/9"}], "recentFileChanges": [{"path": "tests/test_auth.py"}], "contributors": ["alex", "sam"]}
    changes = _meaningful_changes(previous, current)
    assert [change["kind"] for change in changes] == ["commits", "pull_request", "issue", "testing", "contributors"]
    assert changes[1]["title"] == "PR #4 merged"


def test_first_intelligence_snapshot_has_no_fake_changes():
    from app.api.intelligence import _meaningful_changes
    assert _meaningful_changes(None, {"recentCommits": [{"sha": "existing"}]}) == []

def test_catch_up_briefing_compares_snapshots_with_evidence():
    import json
    from types import SimpleNamespace
    from app.api.catchmeup import _build_briefing
    previous = {"recentCommits": [{"sha": "old"}], "openPullRequests": [{"number": 12, "state": "open"}], "openIssues": [], "recentFileChanges": [], "contributors": ["alex"]}
    current = {"recentCommits": [{"sha": "new", "shortSha": "abc1234", "message": "Finish auth", "author": "alex", "url": "https://github.test/commit/new", "changedFiles": ["src/auth.ts"]}], "openPullRequests": [{"number": 12, "state": "merged", "title": "Auth", "url": "https://github.test/pull/12"}], "openIssues": [], "recentFileChanges": [{"path": "src/auth.ts"}], "contributors": ["alex"]}
    analysis = {"detectedGaps": [{"title": "Missing callback test", "description": "No callback test was found.", "evidence": ["tests/auth.test.ts"]}], "suggestedNextSteps": [{"title": "Add callback test", "description": "Cover the merged flow.", "evidence": ["tests/auth.test.ts"]}]}
    latest = SimpleNamespace(context_json=json.dumps(current), analysis_json=json.dumps(analysis))
    older = SimpleNamespace(context_json=json.dumps(previous), created_at=__import__('datetime').datetime(2026, 1, 1))
    briefing = _build_briefing(1, latest, older, [], [])
    assert any(item["title"] == "PR #12 merged" for item in briefing["changes"])
    assert briefing["team"][0]["name"] == "alex"
    assert briefing["attention"][0]["evidence"][0]["type"] == "file"
    assert briefing["next_step"]["title"] == "Add callback test"


def test_catch_up_without_snapshot_requests_baseline():
    from app.api.catchmeup import _build_briefing
    briefing = _build_briefing(1, None, None, [], [])
    assert briefing["changes"] == []
    assert "baseline" in briefing["summary"].lower()
@pytest.mark.asyncio
async def test_handoff_synthesis_preserves_manual_context(client, test_user, test_project, monkeypatch):
    async def fake_context(repo, installation):
        return {"recentCommits": [{"message": "implemented refresh", "url": "https://github.test/commit/1"}], "openPullRequests": [], "openIssues": []}
    async def fake_generate(context, memo, tasks, manual_context=None):
        assert manual_context["completed"] == "I finished the callback"
        return {"completed": "AI replacement", "in_progress": "AI inferred integration", "blocked": None, "next_steps": "Add tests", "notes": "Evidence-backed note", "generatedAt": "2026-01-01T00:00:00Z", "isFallback": False}
    monkeypatch.setattr(intelligence, "_fetch_project_context", fake_context)
    monkeypatch.setattr(intelligence.watsonx_service, "generate_memo", fake_generate)
    response = await client.post(f"/api/v1/projects/{test_project.id}/intelligence/generate-memo", json={"completed": "I finished the callback", "blocked": "Waiting for credentials"}, headers=auth_headers(test_user.id))
    assert response.status_code == 200
    assert response.json()["completed"] == "I finished the callback"
    assert response.json()["blocked"] == "Waiting for credentials"
    assert response.json()["in_progress"] == "AI inferred integration"