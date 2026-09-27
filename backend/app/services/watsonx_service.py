"""
IBM watsonx.ai intelligence service for MEMO.

Architecture
------------
GitHub  → provides development evidence.
MEMO backend → collects and normalises evidence (github_normalizer.py).
WatsonxService → interprets the evidence (THIS MODULE).
MEMO API → validates AI output and exposes it to the frontend.

The AI model NEVER directly modifies application state.
All conclusions are labelled with a confidence level and grounded in
specific evidence items drawn from the ProjectContext.

Operations
----------
analyzeProjectContext()  — full project-state analysis (completed / in-progress / blocked / gaps / next steps)
detectMissingWork()      — gap detection with evidence and confidence
generateMemo()           — structured developer handoff memo
generateCatchUp()        — "while you were away" narrative
suggestTaskAssignments() — contributor → task matching

Fallback behaviour
------------------
If watsonx.ai is unavailable the service returns a graceful FallbackResult
so MEMO continues working with GitHub data and user-entered context.
"""
from __future__ import annotations

import json
import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Confidence helpers ────────────────────────────────────────────────────────

CONFIDENCE_HIGH   = "HIGH"
CONFIDENCE_MEDIUM = "MEDIUM"
CONFIDENCE_LOW    = "LOW"

def _confidence_label(score: float) -> str:
    if score >= 0.75:
        return CONFIDENCE_HIGH
    if score >= 0.45:
        return CONFIDENCE_MEDIUM
    return CONFIDENCE_LOW


# ─── watsonx.ai HTTP client ────────────────────────────────────────────────────

_IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"
_GENERATE_URL  = "{base}/ml/v1/text/generation?version=2023-05-29"

# Simple in-process IAM token cache (expires in ~1 hour)
_iam_token_cache: Dict[str, Any] = {"token": None, "expires_at": 0}
_generation_cache: Dict[str, Dict[str, Any]] = {}
_GENERATION_CACHE_TTL_SECONDS = 300
_GENERATION_CACHE_MAX_ITEMS = 100


async def _get_iam_token() -> Optional[str]:
    """Obtain a short-lived IBM Cloud IAM bearer token from the API key."""
    if not settings.WATSONX_API_KEY:
        return None
    now = time.time()
    if _iam_token_cache["token"] and _iam_token_cache["expires_at"] > now + 60:
        return _iam_token_cache["token"]
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                _IAM_TOKEN_URL,
                data={
                    "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                    "apikey": settings.WATSONX_API_KEY,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if resp.status_code == 200:
                data = resp.json()
                _iam_token_cache["token"] = data["access_token"]
                _iam_token_cache["expires_at"] = now + data.get("expires_in", 3600)
                return _iam_token_cache["token"]
    except Exception as exc:
        logger.warning("IAM token fetch failed: %s", exc)
    return None


async def _call_watsonx(prompt: str, max_new_tokens: int = 1500) -> Optional[str]:
    """
    Send a prompt to watsonx.ai and return the generated text.
    Returns None if the service is unavailable or not configured.
    """
    cache_key = hashlib.sha256(f"{settings.WATSONX_MODEL_ID}:{max_new_tokens}:{prompt}".encode("utf-8")).hexdigest()
    cached = _generation_cache.get(cache_key)
    if cached and cached["expires_at"] > time.time():
        return cached["text"]
    if not settings.WATSONX_API_KEY or not settings.WATSONX_PROJECT_ID:
        logger.debug("watsonx.ai not configured — running in fallback mode.")
        return None

    token = await _get_iam_token()
    if not token:
        return None

    url = _GENERATE_URL.format(base=settings.WATSONX_URL.rstrip("/"))
    payload = {
        "model_id": settings.WATSONX_MODEL_ID,
        "input": prompt,
        "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": max_new_tokens,
            "repetition_penalty": 1.1,
        },
        "project_id": settings.WATSONX_PROJECT_ID,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    generated = results[0].get("generated_text", "")
                    if len(_generation_cache) >= _GENERATION_CACHE_MAX_ITEMS:
                        oldest = min(_generation_cache, key=lambda key: _generation_cache[key]["expires_at"])
                        _generation_cache.pop(oldest, None)
                    _generation_cache[cache_key] = {"text": generated, "expires_at": time.time() + _GENERATION_CACHE_TTL_SECONDS}
                    return generated
            else:
                logger.warning(
                    "watsonx.ai returned HTTP %d: %s",
                    resp.status_code,
                    resp.text[:300],
                )
    except Exception as exc:
        logger.warning("watsonx.ai call failed: %s", exc)
    return None


# ─── JSON extraction helper ────────────────────────────────────────────────────

def _extract_json(text: str) -> Optional[Any]:
    """
    Extract the first valid JSON object or array from a model response.
    The model may wrap its JSON in markdown fences; handle both cases.
    Finds whichever container character ({ or [) appears first in the text.
    """
    # Strip markdown code fences
    text = re.sub(r"```(?:json)?", "", text).strip()

    # Determine which top-level container starts first
    pairs = []
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        pos = text.find(start_char)
        if pos != -1:
            pairs.append((pos, start_char, end_char))

    if not pairs:
        return None

    # Sort by position so we try the earliest container first
    pairs.sort(key=lambda x: x[0])

    for start_pos, start_char, end_char in pairs:
        depth = 0
        for i, ch in enumerate(text[start_pos:], start_pos):
            if ch == start_char:
                depth += 1
            elif ch == end_char:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start_pos:i + 1])
                    except json.JSONDecodeError:
                        break

    return None


# ─── Prompt builders ───────────────────────────────────────────────────────────

def _context_summary(ctx: Dict[str, Any]) -> str:
    """Produce a compact text representation of the ProjectContext for the prompt."""
    repo = ctx.get("repository", {})
    lines = [
        f"Repository: {repo.get('fullName', 'unknown')} ({repo.get('language', 'unknown language')})",
        f"Description: {repo.get('description') or 'none'}",
        f"Default branch: {repo.get('defaultBranch', 'main')}",
        f"Active branch: {ctx.get('activeBranch', 'main')}",
        f"Open issues: {ctx.get('projectMetadata', {}).get('openIssueCount', 0)}",
        f"Open PRs: {ctx.get('projectMetadata', {}).get('openPRCount', 0)}",
        "",
        "Recent commits (latest first):",
    ]
    for c in ctx.get("recentCommits", [])[:10]:
        lines.append(f"  [{c.get('shortSha', '?')}] {c.get('author', '?')}: {c.get('message', '')}")
        if c.get("changedFiles"):
            lines.append(f"    Files: {', '.join(c['changedFiles'][:5])}")

    lines.append("")
    lines.append("Pull requests:")
    for pr in ctx.get("openPullRequests", [])[:8]:
        state = pr.get("state", "?")
        draft = " [DRAFT]" if pr.get("isDraft") else ""
        lines.append(f"  PR #{pr.get('number', '?')} ({state}{draft}): {pr.get('title', '')}")
        if pr.get("changedFiles"):
            lines.append(f"    Files: {', '.join(pr['changedFiles'][:5])}")

    lines.append("")
    lines.append("Open issues:")
    for issue in ctx.get("openIssues", [])[:8]:
        assignee = f" [assigned: {issue['assignee']}]" if issue.get("assignee") else ""
        lines.append(f"  #{issue.get('number', '?')}{assignee}: {issue.get('title', '')}")

    lines.append("")
    lines.append(f"Contributors: {', '.join(ctx.get('contributors', [])[:10]) or 'none'}")

    return "\n".join(lines)


def _memo_summary(memo: Optional[Dict[str, Any]]) -> str:
    if not memo:
        return "None"
    parts = []
    for field in ("completed", "in_progress", "blocked", "next_steps", "notes"):
        val = memo.get(field)
        if val:
            parts.append(f"{field.upper().replace('_', ' ')}: {val[:200]}")
    return "\n".join(parts) or "Empty memo"


def _tasks_summary(tasks: List[Dict[str, Any]]) -> str:
    if not tasks:
        return "None"
    lines = []
    for t in tasks[:10]:
        assignee = t.get("assignee", {})
        assignee_name = (assignee or {}).get("display_name", "unassigned") if isinstance(assignee, dict) else "unassigned"
        lines.append(f"  [{t.get('status', '?')}] {t.get('title', '')} (assigned to: {assignee_name})")
    return "\n".join(lines)


# ─── Public service operations ─────────────────────────────────────────────────

async def analyze_project_context(
    project_context: Dict[str, Any],
    existing_memo: Optional[Dict[str, Any]] = None,
    existing_tasks: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Send the normalised ProjectContext to watsonx.ai and receive a structured
    project-state analysis.

    Returns a validated dict matching the ProjectAnalysis schema.
    Falls back to a graceful empty analysis if the AI is unavailable.
    """
    prompt = f"""You are a senior developer analyst reviewing the current state of a software project.
Analyse the following project evidence and produce a structured JSON report.

IMPORTANT RULES:
- Base every conclusion ONLY on the evidence provided below.
- Never fabricate file names, PR numbers, commit SHAs, or contributor names.
- Use confidence scores between 0.0 and 1.0; never claim certainty you don't have.
- Language: use hedged phrasing such as "MEMO detected…", "appears to be", "possibly missing".

PROJECT EVIDENCE:
{_context_summary(project_context)}

EXISTING MEMO STATE:
{_memo_summary(existing_memo)}

EXISTING TASKS:
{_tasks_summary(existing_tasks or [])}

Produce ONLY a JSON object with this exact shape (no markdown, no extra commentary):
{{
  "projectState": {{
    "completed": [
      {{"title": "string", "evidence": ["file or PR or commit ref"], "confidence": 0.0}}
    ],
    "inProgress": [
      {{"title": "string", "evidence": ["..."], "confidence": 0.0}}
    ],
    "blocked": [
      {{"title": "string", "reason": "string", "evidence": ["..."], "confidence": 0.0}}
    ]
  }},
  "detectedGaps": [
    {{
      "title": "string",
      "description": "string",
      "reason": "string",
      "confidence": 0.0,
      "evidence": ["..."]
    }}
  ],
  "suggestedNextSteps": [
    {{
      "title": "string",
      "description": "string",
      "confidence": 0.0,
      "evidence": ["..."]
    }}
  ]
}}"""

    raw = await _call_watsonx(prompt, max_new_tokens=1800)
    if raw:
        parsed = _extract_json(raw)
        if parsed and isinstance(parsed, dict):
            return _validate_project_analysis(parsed)
        logger.warning("analyze_project_context: could not parse JSON from model response")

    return _fallback_project_analysis(project_context)


async def detect_missing_work(
    project_context: Dict[str, Any],
    existing_tasks: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Ask watsonx.ai to detect potentially missing work items based on the
    project context.  Returns a list of gap objects with evidence.
    """
    prompt = f"""You are a senior developer analysing a software project for missing or incomplete work.
Based ONLY on the evidence below, identify work that may be missing.

Do NOT claim something is missing if you have no supporting evidence.
Do NOT fabricate file paths or PR numbers.
Attach real evidence from the context to each gap.

PROJECT EVIDENCE:
{_context_summary(project_context)}

EXISTING TASKS:
{_tasks_summary(existing_tasks or [])}

Produce ONLY a JSON array (no markdown):
[
  {{
    "title": "string",
    "description": "string",
    "reason": "string",
    "confidence": 0.0,
    "evidence": ["list of specific files/PRs/commits that informed this gap"]
  }}
]"""

    raw = await _call_watsonx(prompt, max_new_tokens=1000)
    if raw:
        parsed = _extract_json(raw)
        if parsed and isinstance(parsed, list):
            return [_validate_gap(g) for g in parsed]
        logger.warning("detect_missing_work: could not parse JSON array")
    return []


async def generate_memo(
    project_context: Dict[str, Any],
    existing_memo: Optional[Dict[str, Any]] = None,
    existing_tasks: Optional[List[Dict[str, Any]]] = None,
    manual_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate a structured developer handoff memo from the project context.
    """
    prompt = f"""You are helping a developer write a concise handoff memo.
Based on the project evidence below, generate a structured memo.

Use hedged language — say "appears to be", "MEMO detected", "possibly".
Be concise. Each section should be a short paragraph or bullet list.

PROJECT EVIDENCE:
{_context_summary(project_context)}

PREVIOUS MEMO:
{_memo_summary(existing_memo)}

CURRENT TASKS:
{_tasks_summary(existing_tasks or [])}

DEVELOPER-ENTERED CONTEXT (authoritative; preserve it and only enrich unsupported gaps):
{_memo_summary(manual_context)}

Produce ONLY a JSON object (no markdown, no extra commentary):
{{
  "completed": "What has been completed (based on merged PRs, closed issues, commit patterns)",
  "in_progress": "What appears to be actively in progress (open PRs, recent commits)",
  "blocked": "What appears blocked or stalled (open issues with no recent activity, blocked tasks)",
  "next_steps": "Recommended next steps with brief rationale",
  "notes": "Any important context a developer should know"
}}"""

    raw = await _call_watsonx(prompt, max_new_tokens=800)
    if raw:
        parsed = _extract_json(raw)
        if parsed and isinstance(parsed, dict):
            return _validate_memo_content(parsed)
        logger.warning("generate_memo: could not parse JSON")
    return _fallback_memo_content(project_context)


async def generate_catch_up(
    project_context: Dict[str, Any],
    previous_memo: Optional[Dict[str, Any]] = None,
    recent_github_activity: Optional[List[Dict[str, Any]]] = None,
    user_display_name: str = "developer",
) -> Dict[str, Any]:
    """
    Generate an AI-powered "Catch Me Up" narrative: what changed, what needs
    attention, and the recommended next step.
    """
    activity_lines = []
    for a in (recent_github_activity or [])[:15]:
        activity_lines.append(
            f"  [{a.get('activity_type', '?')}] {a.get('title', '')} "
            f"by {a.get('author_login', '?')} at {a.get('occurred_at', '?')}"
        )
    activity_text = "\n".join(activity_lines) or "No recent activity"

    prompt = f"""You are helping {user_display_name} quickly get up to speed after being away from the project.

Compare the previous memo state, the new GitHub activity, and the current project state.
Be concise, helpful, and honest. If nothing significant changed, say so.

PREVIOUS MEMO:
{_memo_summary(previous_memo)}

NEW GITHUB ACTIVITY:
{activity_text}

CURRENT PROJECT STATE:
{_context_summary(project_context)}

Produce ONLY a JSON object (no markdown):
{{
  "whileYouWereAway": "1-2 sentence summary of what happened",
  "whatChanged": ["list of specific notable changes"],
  "whatNeedsAttention": ["list of things that need attention"],
  "yourNextStep": "The single most important thing to do next",
  "confidence": 0.0
}}"""

    raw = await _call_watsonx(prompt, max_new_tokens=700)
    if raw:
        parsed = _extract_json(raw)
        if parsed and isinstance(parsed, dict):
            return _validate_catch_up(parsed)
        logger.warning("generate_catch_up: could not parse JSON")
    return _fallback_catch_up(project_context, previous_memo)


async def suggest_task_assignments(
    tasks: List[Dict[str, Any]],
    project_context: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Suggest which contributor is best suited to own each unassigned task,
    based on file-level activity patterns in the ProjectContext.
    """
    if not tasks:
        return []

    task_lines = "\n".join(
        f"  Task {t.get('id', i)}: {t.get('title', '')} | description: {(t.get('description') or '')[:100]}"
        for i, t in enumerate(tasks[:10])
    )

    prompt = f"""You are helping assign tasks to contributors based on their recent activity.

CONTRIBUTORS AND RECENT ACTIVITY:
{_context_summary(project_context)}

UNASSIGNED TASKS:
{task_lines}

For each task, suggest the best contributor based on file-change overlap and commit patterns.
Provide a confidence score and evidence for each suggestion.

Produce ONLY a JSON array (no markdown):
[
  {{
    "task_id": "same as above",
    "suggested_assignee": "github login or null",
    "reason": "string",
    "confidence": 0.0,
    "evidence": ["relevant commits or files"]
  }}
]"""

    raw = await _call_watsonx(prompt, max_new_tokens=600)
    if raw:
        parsed = _extract_json(raw)
        if parsed and isinstance(parsed, list):
            return parsed
        logger.warning("suggest_task_assignments: could not parse JSON")
    return []


# ─── Validation helpers ────────────────────────────────────────────────────────

def _validate_state_item(item: Any) -> Dict[str, Any]:
    if not isinstance(item, dict):
        return {}
    return {
        "title":      str(item.get("title", ""))[:300],
        "evidence":   [str(e)[:200] for e in (item.get("evidence") or [])[:5]],
        "confidence": max(0.0, min(1.0, float(item.get("confidence", 0.5)))),
        "reason":     str(item.get("reason", ""))[:500] if item.get("reason") else None,
    }


def _validate_gap(item: Any) -> Dict[str, Any]:
    if not isinstance(item, dict):
        return {}
    return {
        "category":    _normalise_gap_category(item.get("category")),
        "title":       str(item.get("title", ""))[:300],
        "description": str(item.get("description", ""))[:500],
        "reason":      str(item.get("reason", ""))[:500],
        "confidence":  max(0.0, min(1.0, float(item.get("confidence", 0.5)))),
        "evidence":    [str(e)[:200] for e in (item.get("evidence") or [])[:5]],
    }


def _validate_next_step(item: Any) -> Dict[str, Any]:
    if not isinstance(item, dict):
        return {}
    return {
        "title":       str(item.get("title", ""))[:300],
        "description": str(item.get("description", ""))[:500],
        "confidence":  max(0.0, min(1.0, float(item.get("confidence", 0.5)))),
        "evidence":    [str(e)[:200] for e in (item.get("evidence") or [])[:5]],
    }


def _validate_project_analysis(raw: Dict[str, Any]) -> Dict[str, Any]:
    ps = raw.get("projectState", {})
    return {
        "projectState": {
            "completed":  [_validate_state_item(i) for i in (ps.get("completed") or [])],
            "inProgress": [_validate_state_item(i) for i in (ps.get("inProgress") or [])],
            "blocked":    [_validate_state_item(i) for i in (ps.get("blocked") or [])],
        },
        "detectedGaps":       [_validate_gap(g)       for g in (raw.get("detectedGaps") or [])],
        "suggestedNextSteps": [_validate_next_step(s) for s in (raw.get("suggestedNextSteps") or [])],
        "generatedAt":        datetime.now(timezone.utc).isoformat(),
        "modelId":            settings.WATSONX_MODEL_ID,
        "isFallback":         False,
    }


def _validate_memo_content(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "completed":   str(raw.get("completed") or "")[:2000] or None,
        "in_progress": str(raw.get("in_progress") or "")[:2000] or None,
        "blocked":     str(raw.get("blocked") or "")[:2000] or None,
        "next_steps":  str(raw.get("next_steps") or "")[:2000] or None,
        "notes":       str(raw.get("notes") or "")[:2000] or None,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "isFallback":  False,
    }


def _validate_catch_up(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "whileYouWereAway":    str(raw.get("whileYouWereAway", ""))[:500],
        "whatChanged":         [str(c)[:300] for c in (raw.get("whatChanged") or [])[:10]],
        "whatNeedsAttention":  [str(a)[:300] for a in (raw.get("whatNeedsAttention") or [])[:10]],
        "yourNextStep":        str(raw.get("yourNextStep", ""))[:500],
        "confidence":          max(0.0, min(1.0, float(raw.get("confidence", 0.7)))),
        "generatedAt":         datetime.now(timezone.utc).isoformat(),
        "isFallback":          False,
    }



GAP_CATEGORIES = {
    "TESTING", "IMPLEMENTATION", "INTEGRATION", "DOCUMENTATION",
    "ERROR HANDLING", "SECURITY", "UI", "BACKEND", "FRONTEND", "DEPLOYMENT",
}


def _normalise_gap_category(value: Any) -> str:
    category = str(value or "IMPLEMENTATION").strip().upper().replace("_", " ")
    return category if category in GAP_CATEGORIES else "IMPLEMENTATION"


def _detect_evidence_gaps(ctx: Dict[str, Any], tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Conservative fallback rules over observed activity, never repository absence."""
    gaps: List[Dict[str, Any]] = []
    task_text = " ".join(str(t.get("title", "")).lower() for t in tasks)
    prs = ctx.get("openPullRequests", []) or []
    issues = ctx.get("openIssues", []) or []

    for pr in prs[:15]:
        files = [str(f) for f in (pr.get("changedFiles") or []) if f]
        refs = ([pr.get("url")] if pr.get("url") else []) + files[:3]
        if not refs:
            continue
        feature_files = [f for f in files if not any(x in f.lower() for x in ("test", "spec", "docs", "readme"))]
        test_files = [f for f in files if any(x in f.lower() for x in ("test", "spec"))]
        if feature_files and not test_files and "test" not in task_text:
            gaps.append(_validate_gap({
                "category": "TESTING",
                "title": f"Add coverage for {pr.get('title') or 'recent implementation'}",
                "description": "Implementation files changed, but no test-file change was observed in the same pull request. Tests may exist elsewhere; review before acting.",
                "reason": "The analyzed PR contains implementation evidence without corresponding test activity.",
                "confidence": 0.68,
                "evidence": refs,
            }))

        backend = [f for f in files if any(x in f.lower() for x in ("backend/", "api/", "routes/", "server/", "src/auth"))]
        frontend = [f for f in files if any(x in f.lower() for x in ("frontend/", "client/", "ui/", "components/", "pages/"))]
        title = str(pr.get("title", "")).lower()
        if backend and not frontend and any(x in title for x in ("endpoint", "api", "auth", "token", "login")) and "frontend" not in task_text:
            gaps.append(_validate_gap({
                "category": "INTEGRATION",
                "title": f"Connect the client to {pr.get('title') or 'the backend change'}",
                "description": "Backend-facing files changed, while no frontend integration change was observed in this activity window.",
                "reason": "This is a cross-layer feature signal, not proof that integration is absent.",
                "confidence": 0.62,
                "evidence": refs,
            }))

        if pr.get("state") == "merged":
            linked = set(pr.get("linkedIssues") or [])
            for issue in issues:
                if issue.get("number") in linked and issue.get("state", "open") == "open":
                    gaps.append(_validate_gap({
                        "category": "IMPLEMENTATION",
                        "title": f"Review open issue #{issue.get('number')} after merged PR #{pr.get('number')}",
                        "description": "A merged pull request references an issue that remains open; follow-up work or issue closure may still be needed.",
                        "reason": "The linked implementation merged, but the related issue is still open.",
                        "confidence": 0.82,
                        "evidence": [e for e in (pr.get("url"), issue.get("url")) if e],
                    }))
    unique = {}
    for gap in gaps:
        if gap.get("evidence"):
            unique[(gap.get("category"), gap.get("title"))] = gap
    return list(unique.values())[:8]
# ─── Fallback generators (no AI available) ────────────────────────────────────

def _fallback_project_analysis(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build a deterministic fallback analysis from raw project context
    when the AI is unavailable or not configured.
    """
    in_progress = []
    completed   = []

    for pr in ctx.get("openPullRequests", []):
        if pr.get("state") == "open" and not pr.get("isDraft"):
            in_progress.append({
                "title":      f"PR #{pr.get('number')}: {pr.get('title')}",
                "evidence":   [pr.get("url", "")],
                "confidence": 0.8,
                "reason":     None,
            })
        elif pr.get("state") == "merged":
            completed.append({
                "title":      f"Merged: {pr.get('title')}",
                "evidence":   [pr.get("url", "")],
                "confidence": 0.95,
                "reason":     None,
            })

    blocked = []
    for issue in ctx.get("openIssues", []):
        labels = [l.lower() for l in (issue.get("labels") or [])]
        if any(l in labels for l in ("blocked", "stuck", "help wanted")):
            blocked.append({
                "title":      f"Issue #{issue.get('number')}: {issue.get('title')}",
                "evidence":   [issue.get("url", "")],
                "confidence": 0.7,
                "reason":     "Issue has blocking label",
            })

    return {
        "projectState": {
            "completed":  completed[:5],
            "inProgress": in_progress[:5],
            "blocked":    blocked[:5],
        },
        "detectedGaps":       _detect_evidence_gaps(ctx, []),
        "suggestedNextSteps": [],
        "generatedAt":        datetime.now(timezone.utc).isoformat(),
        "modelId":            "fallback",
        "isFallback":         True,
    }


def _fallback_memo_content(ctx: Dict[str, Any]) -> Dict[str, Any]:
    prs_open   = [p for p in ctx.get("openPullRequests", []) if p.get("state") == "open"]
    prs_merged = [p for p in ctx.get("openPullRequests", []) if p.get("state") == "merged"]

    completed   = ", ".join(f"PR #{p['number']}: {p['title']}" for p in prs_merged[:3]) or None
    in_progress = ", ".join(f"PR #{p['number']}: {p['title']}" for p in prs_open[:3]) or None
    recent      = ctx.get("recentCommits", [])
    notes       = f"Based on {len(recent)} recent commit(s) from GitHub." if recent else None

    return {
        "completed":   completed,
        "in_progress": in_progress,
        "blocked":     None,
        "next_steps":  None,
        "notes":       notes,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "isFallback":  True,
    }


def _fallback_catch_up(
    ctx: Dict[str, Any],
    previous_memo: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    commits = ctx.get("recentCommits", [])
    prs     = ctx.get("openPullRequests", [])

    what_changed = [f"Commit: {c['message']}" for c in commits[:3]]
    attention    = [
        f"Open PR #{p['number']}: {p['title']}"
        for p in prs if p.get("state") == "open"
    ][:3]

    return {
        "whileYouWereAway":   f"There were {len(commits)} recent commit(s) and {len(prs)} open PR(s).",
        "whatChanged":        what_changed,
        "whatNeedsAttention": attention,
        "yourNextStep":       "Review the latest commits and open pull requests.",
        "confidence":         0.5,
        "generatedAt":        datetime.now(timezone.utc).isoformat(),
        "isFallback":         True,
    }


# ─── Service availability check ───────────────────────────────────────────────

def is_configured() -> bool:
    """Return True if the watsonx.ai credentials are present."""
    return bool(settings.WATSONX_API_KEY and settings.WATSONX_PROJECT_ID)
