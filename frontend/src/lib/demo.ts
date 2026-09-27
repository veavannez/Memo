/**
 * DEMO MODE — realistic sample data for demonstrations without a real GitHub account.
 * Architecture note: all API-calling hooks check useDemoMode() and short-circuit
 * to return this data instead of hitting the network.
 */

import type {
  User, Project, Repository, Memo, Task, TeamMemberStatus,
  Dashboard, CatchMeUp, GitHubActivity, ProjectMember,
} from '../types';

// ─── Users ───────────────────────────────────────────────────────────────────

export const DEMO_USER: User = {
  id: 1,
  display_name: 'Alex Rivera',
  email: 'alex@demo.dev',
  avatar_url: 'https://api.dicebear.com/7.x/notionists/svg?seed=alex',
  github_login: 'alexrivera',
  created_at: '2024-01-10T09:00:00Z',
};

export const DEMO_USERS: User[] = [
  DEMO_USER,
  { id: 2, display_name: 'Priya Sharma', email: 'priya@demo.dev', avatar_url: 'https://api.dicebear.com/7.x/notionists/svg?seed=priya', github_login: 'priyasharma', created_at: '2024-01-11T10:00:00Z' },
  { id: 3, display_name: 'Jordan Lee', email: 'jordan@demo.dev', avatar_url: 'https://api.dicebear.com/7.x/notionists/svg?seed=jordan', github_login: 'jordanlee', created_at: '2024-01-12T11:00:00Z' },
];

// ─── Repository / Project ─────────────────────────────────────────────────────

export const DEMO_REPO: Repository = {
  id: 1,
  github_repo_id: 999001,
  full_name: 'alexrivera/auth-service',
  name: 'auth-service',
  owner_login: 'alexrivera',
  is_private: false,
  default_branch: 'main',
  html_url: 'https://github.com/alexrivera/auth-service',
  installation_id: 1,
};

export const DEMO_PROJECT: Project = {
  id: 1,
  name: 'Auth Service',
  description: 'OAuth2 + JWT authentication microservice',
  repository_id: 1,
  repository: DEMO_REPO,
  is_active: true,
  created_at: '2024-01-15T08:00:00Z',
};

// ─── GitHub Activity ──────────────────────────────────────────────────────────

export const DEMO_GH_ACTIVITY: GitHubActivity[] = [
  { id: 1, activity_type: 'commit', github_id: 'a1b2c3d', title: 'fix: resolve token expiry edge case on refresh', url: 'https://github.com/alexrivera/auth-service/commit/a1b2c3d', author_login: 'alexrivera', occurred_at: '2024-03-14T16:22:00Z' },
  { id: 2, activity_type: 'commit', github_id: 'e4f5a6b', title: 'feat: add rate limiting to /auth/login endpoint', url: 'https://github.com/alexrivera/auth-service/commit/e4f5a6b', author_login: 'alexrivera', occurred_at: '2024-03-14T14:10:00Z' },
  { id: 3, activity_type: 'commit', github_id: 'c7d8e9f', title: 'test: add unit tests for JWT validation middleware', url: 'https://github.com/alexrivera/auth-service/commit/c7d8e9f', author_login: 'alexrivera', occurred_at: '2024-03-14T11:45:00Z' },
  { id: 4, activity_type: 'pull_request', github_id: '47', title: 'feat: Google OAuth2 provider integration', url: 'https://github.com/alexrivera/auth-service/pull/47', author_login: 'priyasharma', occurred_at: '2024-03-13T15:00:00Z' },
  { id: 5, activity_type: 'pull_request', github_id: '46', title: 'fix: race condition in session invalidation', url: 'https://github.com/alexrivera/auth-service/pull/46', author_login: 'alexrivera', occurred_at: '2024-03-12T10:30:00Z' },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const DEMO_TASKS: Task[] = [
  { id: 1, project_id: 1, source_memo_id: 1, assignee_id: 1, assignee: DEMO_USERS[0], title: 'Connect frontend to new /auth/refresh endpoint', description: 'Update axios interceptor to call the new refresh endpoint on 401', status: 'in_progress', priority: 'high', position: 1, created_at: '2024-03-14T17:00:00Z', updated_at: '2024-03-14T17:00:00Z' },
  { id: 2, project_id: 1, source_memo_id: 1, assignee_id: 2, assignee: DEMO_USERS[1], title: 'Add expired-token handling UI', description: 'Show a session expired dialog instead of a blank white screen', status: 'todo', priority: 'high', position: 2, created_at: '2024-03-14T17:00:00Z', updated_at: '2024-03-14T17:00:00Z' },
  { id: 3, project_id: 1, source_memo_id: 1, assignee_id: 1, assignee: DEMO_USERS[0], title: 'Update auth integration tests', description: 'Tests are failing after token format change in PR #46', status: 'blocked', priority: 'medium', position: 3, created_at: '2024-03-14T17:00:00Z', updated_at: '2024-03-14T17:00:00Z' },
  { id: 4, project_id: 1, assignee_id: 3, assignee: DEMO_USERS[2], title: 'Write migration guide for token format change', description: 'Summarise what changed and how consumers should update', status: 'todo', priority: 'medium', position: 4, created_at: '2024-03-13T10:00:00Z', updated_at: '2024-03-13T10:00:00Z' },
  { id: 5, project_id: 1, assignee_id: 2, assignee: DEMO_USERS[1], title: 'Deploy Google OAuth2 provider to staging', description: 'PR #47 is merged — needs environment variables set', status: 'todo', priority: 'high', position: 5, created_at: '2024-03-13T16:00:00Z', updated_at: '2024-03-13T16:00:00Z' },
  { id: 6, project_id: 1, assignee_id: 1, assignee: DEMO_USERS[0], title: 'Performance test /auth/login under load', description: 'Verify rate limiting does not affect legitimate traffic', status: 'todo', priority: 'low', position: 6, created_at: '2024-03-12T09:00:00Z', updated_at: '2024-03-12T09:00:00Z' },
  { id: 7, project_id: 1, assignee_id: 3, assignee: DEMO_USERS[2], title: 'Update API docs for refresh endpoint', status: 'done', priority: 'low', position: 7, created_at: '2024-03-11T14:00:00Z', updated_at: '2024-03-14T11:00:00Z' },
  { id: 8, project_id: 1, assignee_id: 2, assignee: DEMO_USERS[1], title: 'Set up Sentry error tracking', status: 'done', priority: 'medium', position: 8, created_at: '2024-03-10T10:00:00Z', updated_at: '2024-03-13T15:00:00Z' },
];

// ─── Memos ────────────────────────────────────────────────────────────────────

export const DEMO_MEMOS: Memo[] = [
  {
    id: 1,
    project_id: 1,
    author_id: 1,
    author: DEMO_USERS[0],
    completed: `- Fixed token expiry edge case where refresh was called on an already-expired refresh token
- Added rate limiting (10 req/min) to /auth/login using Redis sliding window
- Merged PR #46: race condition in session invalidation
- Added 3 unit tests for JWT validation middleware`,
    in_progress: `Connecting the frontend to the new /auth/refresh endpoint. The token format changed in PR #46 — consumers now receive { accessToken, refreshToken, expiresAt } instead of just a bare JWT string. The new format is documented in the PR but team members integrating with the auth service will need to update their parsing code.`,
    blocked: `Integration tests are failing because they were written against the old token format. Need to update the test fixtures before CI will pass. Also waiting on DevOps to provision the Redis instance for rate limiting in staging — without it the rate limiting middleware is disabled.`,
    next_steps: `- Connect frontend to new /auth/refresh endpoint
- Add expired-token handling UI (show dialog instead of blank screen)
- Update auth integration tests to new token format
- Write migration guide for downstream consumers
- Deploy Google OAuth2 to staging (env vars needed)`,
    notes: `The old token format (bare JWT) is deprecated but still supported until 2024-04-01 via the X-Legacy-Auth header. After that date the compatibility shim will be removed. Notify any teams still on the old format ASAP.`,
    is_draft: false,
    github_activities: DEMO_GH_ACTIVITY,
    created_at: '2024-03-14T17:30:00Z',
    updated_at: '2024-03-14T17:30:00Z',
  },
  {
    id: 2,
    project_id: 1,
    author_id: 2,
    author: DEMO_USERS[1],
    completed: `- Implemented Google OAuth2 provider (PR #47)
- Set up Sentry error tracking for auth service
- Wrote E2E test for full OAuth2 flow`,
    in_progress: `Working on the session management refactor. The current implementation stores session state in-memory which breaks horizontal scaling. Moving to Redis-backed sessions.`,
    blocked: null,
    next_steps: `- Deploy Google OAuth2 to staging
- Add expired-token UI
- Review Alex's rate limiting implementation`,
    notes: `Google OAuth2 requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment. These are already in 1Password — ask @alexrivera for access.`,
    is_draft: false,
    github_activities: [DEMO_GH_ACTIVITY[3]],
    created_at: '2024-03-13T18:00:00Z',
    updated_at: '2024-03-13T18:00:00Z',
  },
  {
    id: 3,
    project_id: 1,
    author_id: 3,
    author: DEMO_USERS[2],
    completed: `- Updated API docs for /auth/refresh endpoint
- Reviewed and approved PR #46
- Triaged 3 open GitHub issues`,
    in_progress: `Writing the migration guide for the token format change.`,
    blocked: `Need confirmation from Alex on the exact deprecation timeline before publishing the migration guide.`,
    next_steps: `- Finish migration guide
- Performance test /auth/login under load`,
    notes: null,
    is_draft: false,
    github_activities: [],
    created_at: '2024-03-12T16:45:00Z',
    updated_at: '2024-03-12T16:45:00Z',
  },
];

// ─── Team status ──────────────────────────────────────────────────────────────

export const DEMO_TEAM: TeamMemberStatus[] = [
  {
    user: DEMO_USERS[0],
    role: 'owner',
    latest_memo: DEMO_MEMOS[0],
    current_task: DEMO_TASKS[0],
    open_tasks_count: 3,
    blocked_tasks_count: 1,
  },
  {
    user: DEMO_USERS[1],
    role: 'member',
    latest_memo: DEMO_MEMOS[1],
    current_task: DEMO_TASKS[4],
    open_tasks_count: 2,
    blocked_tasks_count: 0,
  },
  {
    user: DEMO_USERS[2],
    role: 'member',
    latest_memo: DEMO_MEMOS[2],
    current_task: DEMO_TASKS[3],
    open_tasks_count: 2,
    blocked_tasks_count: 0,
  },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const DEMO_DASHBOARD: Dashboard = {
  project: DEMO_PROJECT,
  team: DEMO_TEAM,
  recent_memos: DEMO_MEMOS,
  recent_tasks: DEMO_TASKS,
};

// ─── Members ──────────────────────────────────────────────────────────────────

export const DEMO_MEMBERS: ProjectMember[] = DEMO_USERS.map((u, i) => ({
  id: i + 1,
  project_id: 1,
  user_id: u.id,
  role: i === 0 ? 'owner' : 'member',
  joined_at: '2024-01-15T08:00:00Z',
  user: u,
}));

// ─── CatchMeUp ────────────────────────────────────────────────────────────────

export const DEMO_CATCH_ME_UP: CatchMeUp = {
  user: DEMO_USER,
  last_session_memo: DEMO_MEMOS[0],
  my_open_tasks: DEMO_TASKS.filter((t) => t.assignee_id === 1 && t.status !== 'done'),
  my_blocked_tasks: DEMO_TASKS.filter((t) => t.assignee_id === 1 && t.status === 'blocked'),
  team_memos_since_last: DEMO_MEMOS.slice(1),
  recent_github_activity: DEMO_GH_ACTIVITY,
  suggested_next_steps: [
    'Connect the frontend to the new /auth/refresh endpoint — this is blocking Priya\'s UI work',
    'Fix integration tests before merging any more auth changes',
    'Reach out to DevOps today about the Redis instance for staging',
    'Notify the mobile team about the token format deprecation deadline (April 1)',
  ],
  summary_lines: [
    'You were last active 2 hours ago.',
    'You have 3 open tasks — 1 is blocked.',
    'Priya and Jordan both left memos since your last session.',
    'PR #47 (Google OAuth2) has been merged and needs staging deployment.',
    'Integration tests are still failing — fix before end of day.',
  ],
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Returns true when the app is running in demo mode. */
export function isDemoMode(): boolean {
  return localStorage.getItem('demo_mode') === 'true';
}

/** Activate demo mode and inject a fake user token. */
export function activateDemoMode(): void {
  localStorage.setItem('demo_mode', 'true');
  localStorage.setItem('access_token', 'demo-token');
}

/** Deactivate demo mode. */
export function deactivateDemoMode(): void {
  localStorage.removeItem('demo_mode');
  localStorage.removeItem('access_token');
}
