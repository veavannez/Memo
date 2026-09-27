"""
GitHub data normaliser.

Converts raw GitHub API responses into clean, deterministic dicts
that map directly to the ProjectContext shape consumed by the frontend
and (later) watsonx.ai.

All functions are pure — they take raw GitHub JSON and return plain dicts.
No network calls; no side effects.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _ts(iso: Optional[str]) -> str:
    """Return ISO string unchanged, or empty string if None."""
    return iso or ""


def normalize_commit(raw: Dict[str, Any], branch: Optional[str] = None) -> Dict[str, Any]:
    sha = raw.get("sha", "")
    commit_obj = raw.get("commit", {})
    author_obj = commit_obj.get("author", {}) or {}
    author_login = (raw.get("author") or {}).get("login") or author_obj.get("name", "unknown")
    author_avatar = (raw.get("author") or {}).get("avatar_url")
    stats = raw.get("stats", {}) or {}
    files = raw.get("files") or []

    return {
        "sha": sha,
        "shortSha": sha[:7],
        "message": commit_obj.get("message", "").split("\n")[0],  # first line only
        "author": author_login,
        "authorAvatar": author_avatar,
        "timestamp": _ts(author_obj.get("date")),
        "branch": branch,
        "additions": stats.get("additions", 0),
        "deletions": stats.get("deletions", 0),
        "changedFiles": [f["filename"] for f in files],
        "url": raw.get("html_url", ""),
    }


def normalize_pull_request(raw: Dict[str, Any]) -> Dict[str, Any]:
    user = raw.get("user") or {}
    head = raw.get("head") or {}
    labels = [l.get("name", "") for l in (raw.get("labels") or [])]
    reviewers = [r.get("login", "") for r in (raw.get("requested_reviewers") or [])]
    files = raw.get("_files") or []  # enriched by get_pull_requests_with_files

    # Determine true state — GitHub sets state="closed" even for merged PRs
    state = "open"
    if raw.get("merged_at"):
        state = "merged"
    elif raw.get("state") == "closed":
        state = "closed"

    # Extract linked issue numbers from body (e.g. "Closes #42")
    body = raw.get("body") or ""
    import re
    linked = [int(m) for m in re.findall(r"(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*#(\d+)", body, re.I)]

    return {
        "number": raw.get("number", 0),
        "title": raw.get("title", ""),
        "description": body[:500] if body else None,
        "author": user.get("login", "unknown"),
        "authorAvatar": user.get("avatar_url"),
        "state": state,
        "reviewers": reviewers,
        "labels": labels,
        "createdAt": _ts(raw.get("created_at")),
        "updatedAt": _ts(raw.get("updated_at")),
        "mergedAt": _ts(raw.get("merged_at")) if raw.get("merged_at") else None,
        "changedFiles": [f["filename"] for f in files],
        "additions": sum(f.get("additions", 0) for f in files),
        "deletions": sum(f.get("deletions", 0) for f in files),
        "linkedIssues": linked,
        "url": raw.get("html_url", ""),
        "isDraft": raw.get("draft", False),
    }


def normalize_issue(raw: Dict[str, Any]) -> Dict[str, Any]:
    labels = [l.get("name", "") for l in (raw.get("labels") or [])]
    assignee = (raw.get("assignee") or {}).get("login")
    user = raw.get("user") or {}
    return {
        "number": raw.get("number", 0),
        "title": raw.get("title", ""),
        "description": (raw.get("body") or "")[:500] or None,
        "state": raw.get("state", "open"),
        "labels": labels,
        "assignee": assignee,
        "author": user.get("login", "unknown"),
        "createdAt": _ts(raw.get("created_at")),
        "updatedAt": _ts(raw.get("updated_at")),
        "closedAt": _ts(raw.get("closed_at")) if raw.get("closed_at") else None,
        "commentsCount": raw.get("comments", 0),
        "url": raw.get("html_url", ""),
    }


def normalize_branch(raw: Dict[str, Any], default_branch: str = "main") -> Dict[str, Any]:
    commit = raw.get("commit") or {}
    commit_obj = (commit.get("commit") or {})
    author_obj = commit_obj.get("author") or {}
    return {
        "name": raw.get("name", ""),
        "latestCommitSha": commit.get("sha", "")[:7],
        "latestCommitMessage": commit_obj.get("message", "").split("\n")[0],
        "isProtected": raw.get("protected", False),
        "isDefault": raw.get("name") == default_branch,
        "updatedAt": _ts(author_obj.get("date")),
    }


def normalize_file_change(raw: Dict[str, Any]) -> Dict[str, Any]:
    status = raw.get("status", "modified")
    # Map GitHub statuses to our enum
    status_map = {
        "added": "added",
        "removed": "removed",
        "renamed": "renamed",
        "modified": "modified",
        "changed": "modified",
        "copied": "added",
    }
    return {
        "path": raw.get("filename", ""),
        "status": status_map.get(status, "modified"),
        "additions": raw.get("additions", 0),
        "deletions": raw.get("deletions", 0),
    }


def normalize_repository_metadata(raw: Dict[str, Any]) -> Dict[str, Any]:
    owner = raw.get("owner") or {}
    return {
        "fullName": raw.get("full_name", ""),
        "name": raw.get("name", ""),
        "owner": owner.get("login", ""),
        "description": raw.get("description"),
        "language": raw.get("language"),
        "isPrivate": raw.get("private", False),
        "defaultBranch": raw.get("default_branch", "main"),
        "updatedAt": _ts(raw.get("updated_at")),
        "starCount": raw.get("stargazers_count", 0),
        "openIssuesCount": raw.get("open_issues_count", 0),
        "url": raw.get("html_url", ""),
    }


def build_project_context(
    repo_meta: Dict[str, Any],
    commits: List[Dict[str, Any]],
    pull_requests: List[Dict[str, Any]],
    issues: List[Dict[str, Any]],
    branches: List[Dict[str, Any]],
    contributors: List[Dict[str, Any]],
    active_branch: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Assemble the full normalised ProjectContext from raw GitHub API responses.
    This is the canonical shape sent to the frontend and (later) watsonx.ai.
    """
    default_branch = repo_meta.get("default_branch", "main")
    norm_repo = normalize_repository_metadata(repo_meta)
    norm_commits = [normalize_commit(c, branch=active_branch or default_branch) for c in commits]
    norm_prs = [normalize_pull_request(p) for p in pull_requests]
    norm_issues = [normalize_issue(i) for i in issues]
    norm_branches = [normalize_branch(b, default_branch) for b in branches]

    # Collect unique changed files from recent commits
    seen_files: set = set()
    norm_files = []
    for commit in commits[:10]:
        for f in (commit.get("files") or []):
            path = f.get("filename", "")
            if path and path not in seen_files:
                seen_files.add(path)
                norm_files.append(normalize_file_change(f))

    contributor_logins = [c.get("login", "") for c in contributors if c.get("login")]

    return {
        "repository": norm_repo,
        "activeBranch": active_branch or default_branch,
        "recentCommits": norm_commits,
        "openPullRequests": norm_prs,
        "openIssues": norm_issues,
        "recentFileChanges": norm_files[:30],
        "branches": norm_branches,
        "contributors": contributor_logins,
        "projectMetadata": {
            "totalCommits": len(norm_commits),
            "openPRCount": len([p for p in norm_prs if p["state"] == "open"]),
            "openIssueCount": len([i for i in norm_issues if i["state"] == "open"]),
            "activeBranchCount": len(norm_branches),
        },
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "isMock": False,
    }
