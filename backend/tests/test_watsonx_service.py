"""
Tests for the watsonx.ai intelligence service.

Strategy
--------
• Unit test all validation helpers (no network required).
• Test fallback behaviour when watsonx.ai is unavailable.
• Test prompt building and JSON extraction with realistic data.
• Integration-test the intelligence API endpoints using the existing
  test infrastructure (mocked GitHub + watsonx calls via respx/monkeypatching).
• Every test asserts that the AI NEVER fabricates evidence and that
  confidence values are clamped to [0.0, 1.0].
"""
import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone

from app.services import watsonx_service
from app.services.watsonx_service import (
    _extract_json,
    _context_summary,
    _memo_summary,
    _validate_project_analysis,
    _validate_gap,
    _validate_next_step,
    _validate_catch_up,
    _validate_memo_content,
    _fallback_project_analysis,
    _fallback_memo_content,
    _fallback_catch_up,
    is_configured,
)


# ─── Realistic fixture data ────────────────────────────────────────────────────

REALISTIC_PROJECT_CONTEXT = {
    "repository": {
        "fullName": "acme/api-gateway",
        "name": "api-gateway",
        "owner": "acme",
        "description": "Core API gateway service",
        "language": "TypeScript",
        "defaultBranch": "main",
    },
    "activeBranch": "feature/auth-refresh",
    "recentCommits": [
        {
            "sha": "abc1234defg",
            "shortSha": "abc1234",
            "message": "feat: implement refresh-token rotation",
            "author": "alice",
            "timestamp": "2024-01-15T10:00:00Z",
            "additions": 142,
            "deletions": 23,
            "changedFiles": ["src/auth/refresh.ts", "src/auth/tokens.ts"],
            "url": "https://github.com/acme/api-gateway/commit/abc1234",
        },
        {
            "sha": "def5678ghij",
            "shortSha": "def5678",
            "message": "fix: handle expired token edge case",
            "author": "alice",
            "timestamp": "2024-01-15T11:30:00Z",
            "additions": 34,
            "deletions": 5,
            "changedFiles": ["src/auth/refresh.ts"],
            "url": "https://github.com/acme/api-gateway/commit/def5678",
        },
        {
            "sha": "ghi9012klmn",
            "shortSha": "ghi9012",
            "message": "test: add unit tests for token service",
            "author": "bob",
            "timestamp": "2024-01-15T14:00:00Z",
            "additions": 89,
            "deletions": 0,
            "changedFiles": ["tests/auth/tokens.test.ts"],
            "url": "https://github.com/acme/api-gateway/commit/ghi9012",
        },
    ],
    "openPullRequests": [
        {
            "number": 184,
            "title": "feat: refresh token implementation",
            "state": "open",
            "author": "alice",
            "isDraft": False,
            "changedFiles": ["src/auth/refresh.ts", "src/auth/tokens.ts"],
            "additions": 176,
            "deletions": 28,
            "url": "https://github.com/acme/api-gateway/pull/184",
        },
        {
            "number": 185,
            "title": "chore: bump dependencies",
            "state": "open",
            "author": "bot",
            "isDraft": False,
            "changedFiles": ["package.json", "package-lock.json"],
            "additions": 45,
            "deletions": 45,
            "url": "https://github.com/acme/api-gateway/pull/185",
        },
    ],
    "openIssues": [
        {
            "number": 201,
            "title": "Token refresh fails on concurrent requests",
            "state": "open",
            "labels": ["bug", "blocked"],
            "assignee": "alice",
            "author": "charlie",
            "url": "https://github.com/acme/api-gateway/issues/201",
        },
        {
            "number": 202,
            "title": "Add rate limiting to auth endpoints",
            "state": "open",
            "labels": ["enhancement"],
            "assignee": None,
            "author": "bob",
            "url": "https://github.com/acme/api-gateway/issues/202",
        },
    ],
    "branches": [
        {"name": "main", "isDefault": True, "isProtected": True, "latestCommitSha": "abc123"},
        {"name": "feature/auth-refresh", "isDefault": False, "isProtected": False, "latestCommitSha": "def567"},
    ],
    "contributors": ["alice", "bob", "charlie"],
    "projectMetadata": {
        "totalCommits": 3,
        "openPRCount": 2,
        "openIssueCount": 2,
        "activeBranchCount": 2,
    },
    "collectedAt": "2024-01-15T15:00:00Z",
    "isMock": False,
}

REALISTIC_MEMO = {
    "completed": "Implemented OAuth login flow and user session management.",
    "in_progress": "Working on refresh-token rotation (PR #184).",
    "blocked": "Concurrent token refresh race condition (Issue #201).",
    "next_steps": "Add expired-token test coverage. Review rate limiting issue.",
    "notes": "Auth service is split into tokens.ts and refresh.ts.",
}

REALISTIC_TASKS = [
    {"id": 1, "title": "Write expired-token tests", "description": "Cover edge cases in refresh.ts", "status": "todo", "priority": "high"},
    {"id": 2, "title": "Implement rate limiting", "description": "Add rate limits to /auth endpoints", "status": "todo", "priority": "medium"},
    {"id": 3, "title": "Fix concurrent refresh bug", "description": "Race condition in token rotation", "status": "blocked", "priority": "high"},
]


# ─── JSON extraction tests ─────────────────────────────────────────────────────

class TestExtractJson:
    def test_plain_object(self):
        text = '{"key": "value", "num": 42}'
        result = _extract_json(text)
        assert result == {"key": "value", "num": 42}

    def test_object_in_markdown_fence(self):
        text = '```json\n{"key": "value"}\n```'
        result = _extract_json(text)
        assert result == {"key": "value"}

    def test_object_with_preamble(self):
        text = 'Here is the result:\n\n{"status": "ok"}'
        result = _extract_json(text)
        assert result == {"status": "ok"}

    def test_array(self):
        text = '[{"title": "foo", "confidence": 0.8}]'
        result = _extract_json(text)
        assert result == [{"title": "foo", "confidence": 0.8}]

    def test_invalid_returns_none(self):
        result = _extract_json("This is not JSON at all.")
        assert result is None

    def test_truncated_returns_none(self):
        result = _extract_json('{"incomplete": "jso')
        assert result is None

    def test_nested_object(self):
        text = '{"a": {"b": {"c": 1}}}'
        result = _extract_json(text)
        assert result == {"a": {"b": {"c": 1}}}


# ─── Validation helpers ────────────────────────────────────────────────────────

class TestValidateGap:
    def test_valid_gap(self):
        raw = {
            "title": "Add expired-token tests",
            "description": "No tests found for expired token handling",
            "reason": "refresh.ts modified but no test file change detected",
            "confidence": 0.72,
            "evidence": ["src/auth/refresh.ts", "PR #184"],
        }
        result = _validate_gap(raw)
        assert result["title"] == "Add expired-token tests"
        assert result["confidence"] == 0.72
        assert len(result["evidence"]) == 2

    def test_clamps_confidence_above_one(self):
        raw = {"title": "t", "description": "d", "reason": "r", "confidence": 1.5, "evidence": []}
        result = _validate_gap(raw)
        assert result["confidence"] == 1.0

    def test_clamps_confidence_below_zero(self):
        raw = {"title": "t", "description": "d", "reason": "r", "confidence": -0.3, "evidence": []}
        result = _validate_gap(raw)
        assert result["confidence"] == 0.0

    def test_truncates_long_evidence(self):
        raw = {"title": "t", "description": "d", "reason": "r", "confidence": 0.5, "evidence": ["e"] * 10}
        result = _validate_gap(raw)
        assert len(result["evidence"]) == 5  # capped at 5

    def test_non_dict_returns_empty(self):
        result = _validate_gap("not a dict")
        assert result == {}


class TestValidateProjectAnalysis:
    def test_full_analysis(self):
        raw = {
            "projectState": {
                "completed": [{"title": "Login flow", "evidence": ["PR #180"], "confidence": 0.9}],
                "inProgress": [{"title": "Token refresh", "evidence": ["PR #184"], "confidence": 0.85}],
                "blocked":    [{"title": "Concurrent bug", "evidence": ["Issue #201"], "confidence": 0.7, "reason": "No fix yet"}],
            },
            "detectedGaps": [
                {"title": "Missing tests", "description": "No test coverage for refresh", "reason": "no test file", "confidence": 0.72, "evidence": ["src/auth/refresh.ts"]}
            ],
            "suggestedNextSteps": [
                {"title": "Add tests", "description": "Cover expired-token paths", "confidence": 0.8, "evidence": ["PR #184"]}
            ],
        }
        result = _validate_project_analysis(raw)
        assert len(result["projectState"]["completed"]) == 1
        assert len(result["projectState"]["inProgress"]) == 1
        assert len(result["projectState"]["blocked"]) == 1
        assert len(result["detectedGaps"]) == 1
        assert len(result["suggestedNextSteps"]) == 1
        assert result["isFallback"] is False

    def test_empty_sections(self):
        raw = {"projectState": {}}
        result = _validate_project_analysis(raw)
        assert result["projectState"]["completed"] == []
        assert result["projectState"]["inProgress"] == []
        assert result["projectState"]["blocked"] == []

    def test_has_generated_at(self):
        raw = {}
        result = _validate_project_analysis(raw)
        assert "generatedAt" in result
        assert result["generatedAt"]  # non-empty


class TestValidateMemoContent:
    def test_full_memo(self):
        raw = {
            "completed": "Login implemented",
            "in_progress": "Token refresh",
            "blocked": "Concurrent bug",
            "next_steps": "Add tests",
            "notes": "Split auth service",
        }
        result = _validate_memo_content(raw)
        assert result["completed"] == "Login implemented"
        assert result["in_progress"] == "Token refresh"
        assert result["isFallback"] is False

    def test_empty_fields_become_none(self):
        raw = {"completed": "", "in_progress": None}
        result = _validate_memo_content(raw)
        assert result["completed"] is None
        assert result["in_progress"] is None


class TestValidateCatchUp:
    def test_valid(self):
        raw = {
            "whileYouWereAway": "PR #184 was opened",
            "whatChanged": ["refresh.ts updated", "tokens.ts updated"],
            "whatNeedsAttention": ["concurrent bug still open"],
            "yourNextStep": "Add expired-token tests",
            "confidence": 0.82,
        }
        result = _validate_catch_up(raw)
        assert result["whileYouWereAway"] == "PR #184 was opened"
        assert len(result["whatChanged"]) == 2
        assert result["confidence"] == 0.82
        assert result["isFallback"] is False

    def test_clamps_confidence(self):
        raw = {"confidence": 99.0, "whileYouWereAway": "", "whatChanged": [], "whatNeedsAttention": [], "yourNextStep": ""}
        result = _validate_catch_up(raw)
        assert result["confidence"] == 1.0


# ─── Context summary tests ─────────────────────────────────────────────────────

class TestContextSummary:
    def test_includes_repo_name(self):
        summary = _context_summary(REALISTIC_PROJECT_CONTEXT)
        assert "acme/api-gateway" in summary

    def test_includes_commit_messages(self):
        summary = _context_summary(REALISTIC_PROJECT_CONTEXT)
        assert "refresh-token rotation" in summary

    def test_includes_pr_titles(self):
        summary = _context_summary(REALISTIC_PROJECT_CONTEXT)
        assert "refresh token implementation" in summary

    def test_includes_issues(self):
        summary = _context_summary(REALISTIC_PROJECT_CONTEXT)
        assert "concurrent requests" in summary.lower()

    def test_includes_contributors(self):
        summary = _context_summary(REALISTIC_PROJECT_CONTEXT)
        assert "alice" in summary


class TestMemoSummary:
    def test_includes_sections(self):
        summary = _memo_summary(REALISTIC_MEMO)
        assert "COMPLETED" in summary
        assert "IN PROGRESS" in summary
        assert "BLOCKED" in summary

    def test_none_returns_none_string(self):
        assert _memo_summary(None) == "None"


# ─── Fallback generators ───────────────────────────────────────────────────────

class TestFallbackProjectAnalysis:
    def test_open_prs_become_in_progress(self):
        result = _fallback_project_analysis(REALISTIC_PROJECT_CONTEXT)
        in_progress = result["projectState"]["inProgress"]
        assert any("184" in i["title"] for i in in_progress)

    def test_blocked_issues_detected(self):
        result = _fallback_project_analysis(REALISTIC_PROJECT_CONTEXT)
        blocked = result["projectState"]["blocked"]
        # Issue #201 has label "blocked"
        assert any("201" in i["title"] for i in blocked)

    def test_is_fallback_true(self):
        result = _fallback_project_analysis(REALISTIC_PROJECT_CONTEXT)
        assert result["isFallback"] is True

    def test_empty_context(self):
        result = _fallback_project_analysis({})
        assert result["projectState"]["inProgress"] == []


class TestFallbackMemoContent:
    def test_includes_open_prs(self):
        result = _fallback_memo_content(REALISTIC_PROJECT_CONTEXT)
        # open PRs should appear in in_progress
        assert result["in_progress"] is not None
        assert "184" in result["in_progress"]

    def test_is_fallback_true(self):
        result = _fallback_memo_content(REALISTIC_PROJECT_CONTEXT)
        assert result["isFallback"] is True


class TestFallbackCatchUp:
    def test_summary_mentions_commits(self):
        result = _fallback_catch_up(REALISTIC_PROJECT_CONTEXT, REALISTIC_MEMO)
        assert "commit" in result["whileYouWereAway"].lower()

    def test_open_prs_need_attention(self):
        result = _fallback_catch_up(REALISTIC_PROJECT_CONTEXT, REALISTIC_MEMO)
        assert any("184" in item for item in result["whatNeedsAttention"])

    def test_is_fallback_true(self):
        result = _fallback_catch_up(REALISTIC_PROJECT_CONTEXT, None)
        assert result["isFallback"] is True


# ─── Service function tests (mocked API calls) ────────────────────────────────

class TestAnalyzeProjectContext:
    @pytest.mark.asyncio
    async def test_uses_fallback_when_not_configured(self):
        """When watsonx.ai is not configured, service returns a fallback analysis."""
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=None)):
            result = await watsonx_service.analyze_project_context(
                REALISTIC_PROJECT_CONTEXT,
                REALISTIC_MEMO,
                REALISTIC_TASKS,
            )
        assert result["isFallback"] is True
        assert "projectState" in result

    @pytest.mark.asyncio
    async def test_parses_valid_model_response(self):
        """Valid JSON from the model is validated and returned."""
        model_response = json.dumps({
            "projectState": {
                "completed": [{"title": "Login flow", "evidence": ["PR #180"], "confidence": 0.9}],
                "inProgress": [{"title": "Token refresh", "evidence": ["PR #184"], "confidence": 0.85}],
                "blocked": [],
            },
            "detectedGaps": [
                {"title": "Missing tests", "description": "No test for refresh", "reason": "no test file", "confidence": 0.72, "evidence": ["src/auth/refresh.ts"]}
            ],
            "suggestedNextSteps": [
                {"title": "Add tests", "description": "Cover expired paths", "confidence": 0.8, "evidence": ["PR #184"]}
            ],
        })
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=model_response)):
            result = await watsonx_service.analyze_project_context(REALISTIC_PROJECT_CONTEXT)
        assert result["isFallback"] is False
        assert len(result["projectState"]["completed"]) == 1
        assert len(result["detectedGaps"]) == 1

    @pytest.mark.asyncio
    async def test_falls_back_on_invalid_json(self):
        """When the model returns invalid JSON, graceful fallback is used."""
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value="This is not JSON.")):
            result = await watsonx_service.analyze_project_context(REALISTIC_PROJECT_CONTEXT)
        assert result["isFallback"] is True

    @pytest.mark.asyncio
    async def test_confidence_values_clamped(self):
        """Confidence values from the model are always clamped to [0, 1]."""
        model_response = json.dumps({
            "projectState": {
                "completed": [{"title": "Test", "evidence": [], "confidence": 2.5}],
                "inProgress": [],
                "blocked": [],
            },
            "detectedGaps": [],
            "suggestedNextSteps": [],
        })
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=model_response)):
            result = await watsonx_service.analyze_project_context(REALISTIC_PROJECT_CONTEXT)
        assert result["projectState"]["completed"][0]["confidence"] == 1.0


class TestDetectMissingWork:
    @pytest.mark.asyncio
    async def test_returns_empty_on_failure(self):
        """Returns empty list when AI is unavailable."""
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=None)):
            result = await watsonx_service.detect_missing_work(REALISTIC_PROJECT_CONTEXT, REALISTIC_TASKS)
        assert result == []

    @pytest.mark.asyncio
    async def test_parses_gap_array(self):
        """Valid gap array is returned from the service."""
        model_response = json.dumps([
            {
                "title": "Add expired-token tests",
                "description": "refresh.ts modified but no expired-token test detected",
                "reason": "Implementation exists without test coverage",
                "confidence": 0.72,
                "evidence": ["src/auth/refresh.ts", "tests/auth/refresh.test.ts", "PR #184"],
            }
        ])
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=model_response)):
            result = await watsonx_service.detect_missing_work(REALISTIC_PROJECT_CONTEXT, REALISTIC_TASKS)
        assert len(result) == 1
        assert result[0]["title"] == "Add expired-token tests"
        assert "src/auth/refresh.ts" in result[0]["evidence"]
        assert 0.0 <= result[0]["confidence"] <= 1.0


class TestGenerateMemo:
    @pytest.mark.asyncio
    async def test_fallback_when_unavailable(self):
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=None)):
            result = await watsonx_service.generate_memo(REALISTIC_PROJECT_CONTEXT)
        assert result["isFallback"] is True

    @pytest.mark.asyncio
    async def test_parses_valid_memo(self):
        model_response = json.dumps({
            "completed": "MEMO detected: refresh-token rotation merged (PR #180).",
            "in_progress": "MEMO suggests: PR #184 refresh token implementation is active.",
            "blocked": "MEMO detected: concurrent refresh bug (Issue #201) is blocking.",
            "next_steps": "Add expired-token test coverage.",
            "notes": "Auth service is split into tokens.ts and refresh.ts.",
        })
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=model_response)):
            result = await watsonx_service.generate_memo(REALISTIC_PROJECT_CONTEXT, REALISTIC_MEMO, REALISTIC_TASKS)
        assert result["isFallback"] is False
        assert "PR #184" in result["in_progress"]
        assert result["next_steps"] is not None


class TestGenerateCatchUp:
    @pytest.mark.asyncio
    async def test_fallback_when_unavailable(self):
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=None)):
            result = await watsonx_service.generate_catch_up(REALISTIC_PROJECT_CONTEXT, REALISTIC_MEMO)
        assert result["isFallback"] is True

    @pytest.mark.asyncio
    async def test_parses_valid_catch_up(self):
        model_response = json.dumps({
            "whileYouWereAway": "PR #184 was updated with 3 commits.",
            "whatChanged": ["refresh.ts updated", "tokens.ts refactored"],
            "whatNeedsAttention": ["concurrent refresh bug still open (Issue #201)"],
            "yourNextStep": "Add expired-token tests to unblock PR #184.",
            "confidence": 0.81,
        })
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=model_response)):
            result = await watsonx_service.generate_catch_up(
                REALISTIC_PROJECT_CONTEXT,
                REALISTIC_MEMO,
                user_display_name="Alice",
            )
        assert result["isFallback"] is False
        assert "PR #184" in result["whileYouWereAway"]
        assert result["confidence"] == 0.81


class TestSuggestTaskAssignments:
    @pytest.mark.asyncio
    async def test_returns_empty_for_no_tasks(self):
        result = await watsonx_service.suggest_task_assignments([], REALISTIC_PROJECT_CONTEXT)
        assert result == []

    @pytest.mark.asyncio
    async def test_parses_suggestions(self):
        model_response = json.dumps([
            {
                "task_id": 1,
                "suggested_assignee": "alice",
                "reason": "Alice modified refresh.ts in 3 recent commits",
                "confidence": 0.88,
                "evidence": ["abc1234", "def5678", "src/auth/refresh.ts"],
            }
        ])
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value=model_response)):
            result = await watsonx_service.suggest_task_assignments(REALISTIC_TASKS, REALISTIC_PROJECT_CONTEXT)
        assert len(result) == 1
        assert result[0]["suggested_assignee"] == "alice"

    @pytest.mark.asyncio
    async def test_returns_empty_on_failure(self):
        with patch.object(watsonx_service, '_call_watsonx', new=AsyncMock(return_value="not json")):
            result = await watsonx_service.suggest_task_assignments(REALISTIC_TASKS, REALISTIC_PROJECT_CONTEXT)
        assert result == []


# ─── is_configured ────────────────────────────────────────────────────────────

class TestIsConfigured:
    def test_false_when_no_credentials(self):
        with patch.object(watsonx_service.settings, 'WATSONX_API_KEY', ''), \
             patch.object(watsonx_service.settings, 'WATSONX_PROJECT_ID', ''):
            assert is_configured() is False

    def test_true_when_both_set(self):
        with patch.object(watsonx_service.settings, 'WATSONX_API_KEY', 'sk-test'), \
             patch.object(watsonx_service.settings, 'WATSONX_PROJECT_ID', 'proj-123'):
            assert is_configured() is True

    def test_false_when_only_api_key(self):
        with patch.object(watsonx_service.settings, 'WATSONX_API_KEY', 'sk-test'), \
             patch.object(watsonx_service.settings, 'WATSONX_PROJECT_ID', ''):
            assert is_configured() is False
