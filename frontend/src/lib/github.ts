/**
 * lib/github.ts — GitHub data provider
 *
 * Two clearly-separated providers:
 *
 *   GitHubAPIProvider   — Calls the MEMO backend, which calls the GitHub API
 *                         using an installation token. Tokens never touch the frontend.
 *
 *   MockGitHubProvider  — Returns realistic static data. Used in demo mode or
 *                         when GitHub credentials are unavailable.
 *
 * Consumers call `getGitHubProvider()` which returns the correct provider
 * based on the current mode.
 */

import api from './api';
import { isDemoMode } from './demo';
import type {
  ProjectContext,
  NormalizedCommit,
  NormalizedPullRequest,
  NormalizedIssue,
  NormalizedBranch,
  NormalizedFileChange,
  RepositoryMetadata,
  ActivityItem,
} from '../types';

// ─── Provider interface ───────────────────────────────────────────────────────

export interface GitHubProvider {
  /** Full normalized project context for a repository. */
  getProjectContext(owner: string, repo: string, branch?: string): Promise<ProjectContext>;
  /** Enriched repository metadata. */
  getRepositoryMetadata(owner: string, repo: string): Promise<RepositoryMetadata>;
}

// ─── Real API provider ────────────────────────────────────────────────────────

class GitHubAPIProvider implements GitHubProvider {
  async getProjectContext(owner: string, repo: string, branch?: string): Promise<ProjectContext> {
    const params = branch ? `?branch=${encodeURIComponent(branch)}` : '';
    const resp = await api.get(`/github/repos/${owner}/${repo}/context${params}`);
    return resp.data as ProjectContext;
  }

  async getRepositoryMetadata(owner: string, repo: string): Promise<RepositoryMetadata> {
    const resp = await api.get(`/github/repos/${owner}/${repo}/metadata`);
    const raw = resp.data;
    return {
      fullName: raw.full_name ?? `${owner}/${repo}`,
      name: raw.name ?? repo,
      owner: raw.owner?.login ?? owner,
      description: raw.description ?? undefined,
      language: raw.language ?? undefined,
      isPrivate: raw.private ?? false,
      defaultBranch: raw.default_branch ?? 'main',
      updatedAt: raw.updated_at ?? new Date().toISOString(),
      starCount: raw.stargazers_count ?? 0,
      openIssuesCount: raw.open_issues_count ?? 0,
      url: raw.html_url ?? `https://github.com/${owner}/${repo}`,
    };
  }
}

// ─── Mock provider (demo / offline) ──────────────────────────────────────────

const MOCK_REPO: RepositoryMetadata = {
  fullName: 'alexrivera/auth-service',
  name: 'auth-service',
  owner: 'alexrivera',
  description: 'OAuth2 + JWT authentication microservice',
  language: 'TypeScript',
  isPrivate: false,
  defaultBranch: 'main',
  updatedAt: '2024-03-14T17:30:00Z',
  starCount: 42,
  openIssuesCount: 2,
  url: 'https://github.com/alexrivera/auth-service',
};

const MOCK_COMMITS: NormalizedCommit[] = [
  {
    sha: 'a1b2c3d4e5f6789012345678901234567890abcd',
    shortSha: 'a1b2c3d',
    message: 'fix: resolve token expiry edge case on refresh',
    author: 'alexrivera',
    authorAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=alex',
    timestamp: '2024-03-14T16:22:00Z',
    branch: 'feat/token-refresh',
    additions: 34,
    deletions: 12,
    changedFiles: ['src/auth/token.ts', 'src/auth/refresh.ts', 'tests/auth/token.test.ts'],
    url: 'https://github.com/alexrivera/auth-service/commit/a1b2c3d',
  },
  {
    sha: 'e4f5a6b7c8d9012345678901234567890abcdef',
    shortSha: 'e4f5a6b',
    message: 'feat: add rate limiting to /auth/login endpoint',
    author: 'alexrivera',
    authorAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=alex',
    timestamp: '2024-03-14T14:10:00Z',
    branch: 'feat/token-refresh',
    additions: 89,
    deletions: 5,
    changedFiles: ['src/middleware/rateLimit.ts', 'src/routes/auth.ts', 'config/redis.ts'],
    url: 'https://github.com/alexrivera/auth-service/commit/e4f5a6b',
  },
  {
    sha: 'c7d8e9f0a1b2345678901234567890abcdef123',
    shortSha: 'c7d8e9f',
    message: 'test: add unit tests for JWT validation middleware',
    author: 'alexrivera',
    authorAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=alex',
    timestamp: '2024-03-14T11:45:00Z',
    branch: 'feat/token-refresh',
    additions: 142,
    deletions: 0,
    changedFiles: ['tests/middleware/jwt.test.ts', 'tests/fixtures/tokens.ts'],
    url: 'https://github.com/alexrivera/auth-service/commit/c7d8e9f',
  },
  {
    sha: 'b2c3d4e5f6a7890123456789012345678abcdef',
    shortSha: 'b2c3d4e',
    message: 'refactor: extract token validation into shared util',
    author: 'priyasharma',
    authorAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=priya',
    timestamp: '2024-03-13T15:30:00Z',
    branch: 'main',
    additions: 56,
    deletions: 73,
    changedFiles: ['src/utils/token.ts', 'src/auth/validate.ts', 'src/middleware/jwt.ts'],
    url: 'https://github.com/alexrivera/auth-service/commit/b2c3d4e',
  },
];

const MOCK_PRS: NormalizedPullRequest[] = [
  {
    number: 48,
    title: 'feat: token refresh endpoint v2',
    description: 'Implements the new refresh flow. Closes #35. Closes #36.',
    author: 'alexrivera',
    authorAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=alex',
    state: 'open',
    reviewers: ['priyasharma', 'jordanlee'],
    labels: ['feature', 'auth'],
    createdAt: '2024-03-14T10:00:00Z',
    updatedAt: '2024-03-14T16:30:00Z',
    changedFiles: [
      'src/auth/token.ts', 'src/auth/refresh.ts',
      'src/middleware/rateLimit.ts', 'tests/auth/token.test.ts',
    ],
    additions: 265,
    deletions: 17,
    linkedIssues: [35, 36],
    url: 'https://github.com/alexrivera/auth-service/pull/48',
    isDraft: false,
  },
  {
    number: 49,
    title: 'chore: update Redis client to v5',
    description: 'Dependency update required for rate limiting middleware.',
    author: 'jordanlee',
    authorAvatar: 'https://api.dicebear.com/7.x/notionists/svg?seed=jordan',
    state: 'open',
    reviewers: ['alexrivera'],
    labels: ['dependencies'],
    createdAt: '2024-03-13T12:00:00Z',
    updatedAt: '2024-03-14T09:15:00Z',
    changedFiles: ['package.json', 'package-lock.json', 'config/redis.ts'],
    additions: 12,
    deletions: 8,
    linkedIssues: [],
    url: 'https://github.com/alexrivera/auth-service/pull/49',
    isDraft: false,
  },
];

const MOCK_ISSUES: NormalizedIssue[] = [
  {
    number: 38,
    title: 'Rate limiting breaks multi-region deployments',
    description: 'When the service is deployed across regions, the Redis sliding window does not sync correctly causing legitimate requests to be rejected.',
    state: 'open',
    labels: ['bug', 'infrastructure'],
    assignee: 'alexrivera',
    author: 'jordanlee',
    createdAt: '2024-03-12T09:00:00Z',
    updatedAt: '2024-03-14T14:20:00Z',
    commentsCount: 5,
    url: 'https://github.com/alexrivera/auth-service/issues/38',
  },
  {
    number: 41,
    title: 'JWT refresh loop on slow connections',
    description: 'On connections with >500ms latency, multiple refresh calls can fire simultaneously before the first completes.',
    state: 'open',
    labels: ['bug', 'performance'],
    assignee: 'alexrivera',
    author: 'priyasharma',
    createdAt: '2024-03-13T11:30:00Z',
    updatedAt: '2024-03-14T16:00:00Z',
    commentsCount: 3,
    url: 'https://github.com/alexrivera/auth-service/issues/41',
  },
];

const MOCK_BRANCHES: NormalizedBranch[] = [
  {
    name: 'main',
    latestCommitSha: 'b2c3d4e',
    latestCommitMessage: 'refactor: extract token validation into shared util',
    isProtected: true,
    isDefault: true,
    updatedAt: '2024-03-13T15:30:00Z',
  },
  {
    name: 'feat/token-refresh',
    latestCommitSha: 'a1b2c3d',
    latestCommitMessage: 'fix: resolve token expiry edge case on refresh',
    isProtected: false,
    isDefault: false,
    updatedAt: '2024-03-14T16:22:00Z',
  },
  {
    name: 'feat/google-oauth',
    latestCommitSha: 'f1e2d3c',
    latestCommitMessage: 'feat: Google OAuth2 provider implementation',
    isProtected: false,
    isDefault: false,
    updatedAt: '2024-03-13T14:00:00Z',
  },
  {
    name: 'chore/redis-v5',
    latestCommitSha: 'd4e5f6a',
    latestCommitMessage: 'chore: update Redis client to v5',
    isProtected: false,
    isDefault: false,
    updatedAt: '2024-03-13T12:00:00Z',
  },
];

const MOCK_FILE_CHANGES: NormalizedFileChange[] = [
  { path: 'src/auth/token.ts',           status: 'modified', additions: 34, deletions: 12 },
  { path: 'src/auth/refresh.ts',         status: 'modified', additions: 28, deletions: 8  },
  { path: 'src/middleware/rateLimit.ts', status: 'added',    additions: 89, deletions: 0  },
  { path: 'src/routes/auth.ts',          status: 'modified', additions: 15, deletions: 3  },
  { path: 'config/redis.ts',             status: 'added',    additions: 32, deletions: 0  },
  { path: 'tests/auth/token.test.ts',    status: 'modified', additions: 67, deletions: 4  },
  { path: 'tests/middleware/jwt.test.ts', status: 'added',   additions: 142, deletions: 0 },
  { path: 'tests/fixtures/tokens.ts',   status: 'added',    additions: 45, deletions: 0  },
];

export const MOCK_PROJECT_CONTEXT: ProjectContext = {
  repository: MOCK_REPO,
  activeBranch: 'feat/token-refresh',
  recentCommits: MOCK_COMMITS,
  openPullRequests: MOCK_PRS,
  openIssues: MOCK_ISSUES,
  recentFileChanges: MOCK_FILE_CHANGES,
  branches: MOCK_BRANCHES,
  contributors: ['alexrivera', 'priyasharma', 'jordanlee'],
  projectMetadata: {
    totalCommits: 4,
    openPRCount: 2,
    openIssueCount: 2,
    activeBranchCount: 4,
  },
  collectedAt: '2024-03-14T17:00:00Z',
  isMock: true,
};

class MockGitHubProvider implements GitHubProvider {
  async getProjectContext(_owner: string, _repo: string, _branch?: string): Promise<ProjectContext> {
    // Simulate slight network delay for realism
    await new Promise((r) => setTimeout(r, 400));
    return MOCK_PROJECT_CONTEXT;
  }

  async getRepositoryMetadata(_owner: string, _repo: string): Promise<RepositoryMetadata> {
    await new Promise((r) => setTimeout(r, 200));
    return MOCK_REPO;
  }
}

// ─── Provider factory ─────────────────────────────────────────────────────────

const _realProvider = new GitHubAPIProvider();
const _mockProvider = new MockGitHubProvider();

/**
 * Returns the correct GitHub provider based on current mode.
 * Use this in all hooks and page components.
 */
export function getGitHubProvider(): GitHubProvider {
  return isDemoMode() ? _mockProvider : _realProvider;
}

// ─── Activity feed builder ─────────────────────────────────────────────────────

/**
 * Converts a ProjectContext into a flat, time-sorted activity feed.
 * Each item is a unified ActivityItem usable by the feed UI.
 */
export function buildActivityFeed(ctx: ProjectContext): ActivityItem[] {
  const items: ActivityItem[] = [];

  // Commits
  for (const c of ctx.recentCommits) {
    items.push({
      id: `commit-${c.sha}`,
      kind: 'commit',
      title: c.message,
      subtitle: `${c.additions > 0 ? `+${c.additions}` : ''}${c.deletions > 0 ? ` -${c.deletions}` : ''} · ${c.changedFiles.length} file${c.changedFiles.length !== 1 ? 's' : ''}`,
      actor: c.author,
      actorAvatar: c.authorAvatar,
      timestamp: c.timestamp,
      url: c.url,
      meta: { sha: c.shortSha, branch: c.branch ?? '', additions: c.additions, deletions: c.deletions },
    });
  }

  // Pull requests
  for (const pr of ctx.openPullRequests) {
    items.push({
      id: `pr-${pr.number}`,
      kind: 'pull_request',
      title: pr.title,
      subtitle: pr.state.toUpperCase() + (pr.reviewers.length ? ` · ${pr.reviewers.join(', ')} reviewing` : ''),
      actor: pr.author,
      actorAvatar: pr.authorAvatar,
      timestamp: pr.updatedAt,
      url: pr.url,
      meta: { number: pr.number, state: pr.state, isDraft: pr.isDraft },
    });
  }

  // Issues
  for (const issue of ctx.openIssues) {
    items.push({
      id: `issue-${issue.number}`,
      kind: 'issue',
      title: issue.title,
      subtitle: `${issue.state.toUpperCase()} · ${issue.assignee ? `assigned to ${issue.assignee}` : 'unassigned'} · ${issue.commentsCount} comment${issue.commentsCount !== 1 ? 's' : ''}`,
      actor: issue.author,
      timestamp: issue.updatedAt,
      url: issue.url,
      meta: { number: issue.number, state: issue.state },
    });
  }

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items;
}
