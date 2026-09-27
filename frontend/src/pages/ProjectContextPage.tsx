/**
 * ProjectContextPage — MEMO's interpretation of GitHub repository intelligence.
 *
 * Shows the normalized ProjectContext as a MEMO-branded activity feed.
 * Does NOT look like GitHub — uses MEMO's visual language.
 */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getGitHubProvider, buildActivityFeed } from '../lib/github';
import { isDemoMode } from '../lib/demo';
import type {
  ProjectContext, ActivityItem,
  NormalizedCommit, NormalizedPullRequest, NormalizedIssue, NormalizedBranch,
} from '../types';
import {
  GitCommit, GitPullRequest, CircleDot, GitBranch,
  AlertCircle, RefreshCw, Loader2, ChevronDown, ChevronUp,
  ArrowUpRight, Lock, Globe, Clock, Users, Code2, CheckCircle2,
  XCircle, AlertTriangle, Minus,
} from 'lucide-react';
import { timeAgo, formatDate } from '../lib/utils';
import api from '../lib/api';

// ─── Diff stat chip ───────────────────────────────────────────────────────────

function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  if (additions === 0 && deletions === 0) return null;
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px]">
      {additions > 0 && <span className="text-diff-add">+{additions}</span>}
      {deletions > 0 && <span className="text-diff-del">-{deletions}</span>}
    </span>
  );
}

// ─── PR state badge ───────────────────────────────────────────────────────────

function PRStateBadge({ state }: { state: 'open' | 'closed' | 'merged' }) {
  const map = {
    open:   { cls: 'bg-sticky-green/20 text-green-700 border-green-200',   label: 'OPEN',   Icon: GitPullRequest },
    merged: { cls: 'bg-sticky-lavender/30 text-purple-700 border-purple-200', label: 'MERGED', Icon: GitPullRequest },
    closed: { cls: 'bg-paper-dark text-ink-muted border-border',            label: 'CLOSED', Icon: XCircle },
  };
  const { cls, label, Icon } = map[state];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

// ─── Issue state badge ────────────────────────────────────────────────────────

function IssueStateBadge({ state }: { state: 'open' | 'closed' }) {
  return state === 'open' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-sticky-green/20 text-green-700 border-green-200">
      <CircleDot className="w-2.5 h-2.5" />
      OPEN
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-paper-dark text-ink-muted border-border">
      <CheckCircle2 className="w-2.5 h-2.5" />
      CLOSED
    </span>
  );
}

// ─── Activity item row ────────────────────────────────────────────────────────

function ActivityRow({ item }: { item: ActivityItem }) {
  const iconMap = {
    commit:       { Icon: GitCommit,     color: 'text-ink-muted',    bg: 'bg-paper-dark' },
    pull_request: { Icon: GitPullRequest, color: 'text-sticky-green', bg: 'bg-sticky-green/10' },
    issue:        { Icon: CircleDot,     color: 'text-sticky-blue',  bg: 'bg-sticky-blue/10' },
    branch:       { Icon: GitBranch,     color: 'text-sticky-lavender', bg: 'bg-sticky-lavender/10' },
  };
  const { Icon, color, bg } = iconMap[item.kind];

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3.5 rounded-card hover:bg-paper-dark transition-colors group cursor-pointer"
    >
      {/* Kind icon */}
      <div className={`w-8 h-8 rounded-sticky ${bg} border border-border flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          {item.kind === 'commit' && item.meta && (
            <code className="font-mono text-[11px] bg-paper-dark border border-border px-1.5 py-0.5 rounded text-ink-muted flex-shrink-0">
              {String(item.meta.sha)}
            </code>
          )}
          {item.kind === 'pull_request' && item.meta && (
            <span className="font-mono text-[11px] text-ink-faint flex-shrink-0">
              PR #{String(item.meta.number)}
            </span>
          )}
          {item.kind === 'issue' && item.meta && (
            <span className="font-mono text-[11px] text-ink-faint flex-shrink-0">
              #{String(item.meta.number)}
            </span>
          )}
          <p className="text-sm font-semibold text-ink leading-snug group-hover:text-ink transition-colors line-clamp-1">
            {item.title}
          </p>
          <ArrowUpRight className="w-3 h-3 text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-auto" />
        </div>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs font-mono text-ink-muted">
            {item.actor}
          </span>
          {item.subtitle && (
            <span className="text-xs text-ink-faint">{item.subtitle}</span>
          )}
          <span className="text-[11px] text-ink-faint ml-auto">
            {timeAgo(item.timestamp)}
          </span>
        </div>
      </div>
    </a>
  );
}

// ─── Recent commits section ───────────────────────────────────────────────────

function CommitsSection({ commits }: { commits: NormalizedCommit[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? commits : commits.slice(0, 5);

  return (
    <div>
      <div className="divide-y divide-border/60">
        {visible.map((c) => (
          <a
            key={c.sha}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 py-3 first:pt-0 hover:bg-paper-dark -mx-4 px-4 rounded-card transition-colors group"
          >
            <GitCommit className="w-4 h-4 text-ink-faint flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <code className="font-mono text-[11px] text-ink-muted bg-paper-dark border border-border px-1 py-0.5 rounded flex-shrink-0">
                  {c.shortSha}
                </code>
                {c.branch && (
                  <span className="font-mono text-[10px] text-ink-faint px-1.5 py-0.5 rounded bg-sticky-lavender/15 border border-sticky-lavender/20">
                    {c.branch}
                  </span>
                )}
              </div>
              <p className="text-sm text-ink leading-snug line-clamp-1 group-hover:line-clamp-none transition-all">
                {c.message}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-mono text-ink-muted">{c.author}</span>
                <DiffStat additions={c.additions} deletions={c.deletions} />
                {c.changedFiles.length > 0 && (
                  <span className="text-[11px] text-ink-faint font-mono">
                    {c.changedFiles.length} file{c.changedFiles.length !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-[11px] text-ink-faint ml-auto">{timeAgo(c.timestamp)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
      {commits.length > 5 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-xs text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Show fewer' : `Show ${commits.length - 5} more commits`}
        </button>
      )}
    </div>
  );
}

// ─── Pull requests section ────────────────────────────────────────────────────

function PRsSection({ prs }: { prs: NormalizedPullRequest[] }) {
  if (prs.length === 0) {
    return <p className="text-sm text-ink-faint italic">No open pull requests.</p>;
  }
  return (
    <div className="divide-y divide-border/60">
      {prs.map((pr) => (
        <a
          key={pr.number}
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 py-3 first:pt-0 hover:bg-paper-dark -mx-4 px-4 rounded-card transition-colors group"
        >
          <GitPullRequest className="w-4 h-4 text-sticky-green flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <PRStateBadge state={pr.state} />
              <span className="font-mono text-[11px] text-ink-faint">#{pr.number}</span>
              {pr.isDraft && (
                <span className="text-[10px] font-semibold text-ink-faint px-1.5 py-0.5 rounded bg-paper-dark border border-border">
                  DRAFT
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-ink line-clamp-1 group-hover:line-clamp-none">
              {pr.title}
            </p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs font-mono text-ink-muted">{pr.author}</span>
              <DiffStat additions={pr.additions} deletions={pr.deletions} />
              {pr.reviewers.length > 0 && (
                <span className="text-[11px] text-ink-faint">
                  {pr.reviewers.join(', ')} reviewing
                </span>
              )}
              {pr.labels.length > 0 && (
                <span className="text-[11px] text-ink-faint">
                  {pr.labels.join(', ')}
                </span>
              )}
              <span className="text-[11px] text-ink-faint ml-auto">{timeAgo(pr.updatedAt)}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── Issues section ───────────────────────────────────────────────────────────

function IssuesSection({ issues }: { issues: NormalizedIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-ink-faint italic">No open issues.</p>;
  }
  return (
    <div className="divide-y divide-border/60">
      {issues.map((issue) => (
        <a
          key={issue.number}
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 py-3 first:pt-0 hover:bg-paper-dark -mx-4 px-4 rounded-card transition-colors group"
        >
          <CircleDot className="w-4 h-4 text-sticky-blue flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <IssueStateBadge state={issue.state} />
              <span className="font-mono text-[11px] text-ink-faint">#{issue.number}</span>
              {issue.labels.map((l) => (
                <span key={l} className="text-[10px] font-semibold text-ink-faint px-1.5 py-0.5 rounded bg-paper-dark border border-border">
                  {l}
                </span>
              ))}
            </div>
            <p className="text-sm font-semibold text-ink line-clamp-1 group-hover:line-clamp-none">
              {issue.title}
            </p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs font-mono text-ink-muted">{issue.author}</span>
              {issue.assignee && (
                <span className="text-[11px] text-ink-faint">assigned to {issue.assignee}</span>
              )}
              {issue.commentsCount > 0 && (
                <span className="text-[11px] text-ink-faint">
                  {issue.commentsCount} comment{issue.commentsCount !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-[11px] text-ink-faint ml-auto">{timeAgo(issue.updatedAt)}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── Branches section ─────────────────────────────────────────────────────────

function BranchesSection({ branches }: { branches: NormalizedBranch[] }) {
  return (
    <div className="divide-y divide-border/60">
      {branches.map((b) => (
        <div key={b.name} className="flex items-center gap-3 py-2.5 first:pt-0">
          <GitBranch className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono text-sm text-ink">{b.name}</code>
              {b.isDefault && (
                <span className="text-[10px] font-bold text-ink-muted px-1.5 py-0.5 rounded bg-sticky-blue/15 border border-sticky-blue/20">
                  DEFAULT
                </span>
              )}
              {b.isProtected && (
                <span className="text-[10px] font-bold text-ink-muted px-1.5 py-0.5 rounded bg-paper-dark border border-border">
                  PROTECTED
                </span>
              )}
            </div>
            <p className="text-xs text-ink-faint font-mono truncate mt-0.5">
              {b.latestCommitSha} · {b.latestCommitMessage}
            </p>
          </div>
          {b.updatedAt && (
            <span className="text-[11px] text-ink-faint flex-shrink-0 font-mono">
              {timeAgo(b.updatedAt)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({
  error,
  onRetry,
  repoFullName,
}: {
  error: string;
  onRetry: () => void;
  repoFullName?: string;
}) {
  const isNotFound = error.includes('not found') || error.includes('404');
  const isPermission = error.includes('403') || error.includes('forbidden') || error.includes('inactive');
  const isRateLimit = error.includes('rate limit') || error.includes('429');
  const isNetwork = error.includes('Network') || error.includes('502') || error.includes('network');

  let hint = '';
  if (isNotFound) hint = 'The repository may not have the MEMO GitHub App installed. Try reinstalling.';
  else if (isPermission) hint = 'The GitHub App installation is inactive. Reinstall to restore access.';
  else if (isRateLimit) hint = 'GitHub API rate limit reached. Wait a minute then try again.';
  else if (isNetwork) hint = 'Could not reach the GitHub API. Check your internet connection.';
  else hint = 'An unexpected error occurred fetching repository data.';

  return (
    <div className="max-w-md mx-auto py-16 text-center px-4">
      <div className="w-14 h-14 rounded-sticky bg-sticky-pink/10 border-2 border-red-200 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-500" />
      </div>
      <h3 className="font-bold text-ink text-lg mb-2">Could not load repository</h3>
      <p className="text-sm text-ink-muted mb-2">{hint}</p>
      <p className="text-xs font-mono text-ink-faint mb-6 bg-paper-dark rounded p-2 text-left">{error}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onRetry} className="btn-primary">
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
        {isNotFound && (
          <a
            href={`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG || 'memo-workspace'}/installations/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Reinstall GitHub App →
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="font-display text-display-md text-ink tracking-wider">{value}</p>
      <p className="text-xs font-semibold text-ink-muted mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-ink-faint mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = 'feed' | 'commits' | 'prs' | 'issues' | 'branches';

export default function ProjectContextPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('feed');
  const provider = getGitHubProvider();

  // Fetch the project first to get the repo full_name
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => {
      if (isDemoMode()) {
        return import('../lib/demo').then((m) => m.DEMO_PROJECT);
      }
      return api.get(`/projects/${projectId}`).then((r) => r.data);
    },
    enabled: !!projectId,
  });

  const repoFullName: string = project?.repository?.full_name ?? '';
  const [owner, repo] = repoFullName.split('/');

  const {
    data: context,
    isLoading,
    error,
    refetch,
  } = useQuery<ProjectContext>({
    queryKey: ['project-context', repoFullName],
    queryFn: () => provider.getProjectContext(owner, repo),
    enabled: !!owner && !!repo,
    staleTime: 2 * 60 * 1000, // 2-minute cache
    retry: 1,
  });

  const activityFeed = context ? buildActivityFeed(context) : [];

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'feed',     label: 'Activity Feed' },
    { id: 'commits',  label: 'Commits',  count: context?.recentCommits.length },
    { id: 'prs',      label: 'Pull Requests', count: context?.openPullRequests.length },
    { id: 'issues',   label: 'Issues',   count: context?.openIssues.length },
    { id: 'branches', label: 'Branches', count: context?.branches.length },
  ];

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading || !project) {
    return (
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10">
        <div className="mb-8 h-8 w-64 bg-paper-dark rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 h-20 bg-paper-dark animate-pulse" />
          ))}
        </div>
        <div className="card p-8 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-ink-faint" />
          <span className="text-sm text-ink-muted">Collecting repository context…</span>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || (!isLoading && !context)) {
    const msg = (error as any)?.response?.data?.detail
      ?? (error as any)?.message
      ?? 'Unknown error';
    return (
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10">
        <div className="mb-6">
          <h1 className="font-display text-display-lg text-ink tracking-wide mb-1">
            REPOSITORY CONTEXT
          </h1>
          <p className="font-mono text-sm text-ink-faint">{repoFullName}</p>
        </div>
        <ErrorState error={msg} onRetry={() => refetch()} repoFullName={repoFullName} />
      </div>
    );
  }

  const { repository: repoMeta, projectMetadata } = context!;

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="font-display text-display-lg text-ink tracking-wide">
              REPOSITORY CONTEXT
            </h1>
            {context?.isMock && (
              <span className="badge-demo text-[10px] px-2 py-0.5">DEMO DATA</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-sm text-ink-muted">{repoMeta.fullName}</code>
            {repoMeta.isPrivate
              ? <Lock className="w-3.5 h-3.5 text-ink-faint" />
              : <Globe className="w-3.5 h-3.5 text-ink-faint" />
            }
            {repoMeta.language && (
              <span className="text-[11px] text-ink-faint font-mono">· {repoMeta.language}</span>
            )}
          </div>
          {repoMeta.description && (
            <p className="text-sm text-ink-muted mt-1">{repoMeta.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={repoMeta.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            View on GitHub
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
          <button onClick={() => refetch()} className="btn-ghost text-xs" title="Refresh context">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatTile label="RECENT COMMITS" value={projectMetadata.totalCommits} />
        <StatTile label="OPEN PRS" value={projectMetadata.openPRCount} />
        <StatTile label="OPEN ISSUES" value={projectMetadata.openIssueCount} />
        <StatTile label="BRANCHES" value={projectMetadata.activeBranchCount} />
      </div>

      {/* ── Context meta strip ──────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6 text-[11px] text-ink-faint flex-wrap">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Collected {timeAgo(context!.collectedAt)}
        </span>
        <span className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          <span className="font-mono">{context!.activeBranch}</span>
        </span>
        {context!.contributors.length > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {context!.contributors.slice(0, 3).join(', ')}
            {context!.contributors.length > 3 && ` +${context!.contributors.length - 3}`}
          </span>
        )}
        <span>
          Updated {formatDate(repoMeta.updatedAt)}
        </span>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-border mb-6 overflow-x-auto scrollbar-none">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap
              border-b-2 transition-all duration-150 -mb-px
              ${activeTab === id
                ? 'text-ink border-ink'
                : 'text-ink-muted border-transparent hover:text-ink hover:border-ink/30'
              }
            `}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className={`
                text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${activeTab === id ? 'bg-ink text-paper' : 'bg-paper-dark text-ink-muted'}
              `}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className="card-editorial p-5 sm:p-6">

        {/* Activity feed */}
        {activeTab === 'feed' && (
          <div>
            <p className="text-xs font-bold text-ink-muted mb-4 uppercase tracking-widest">
              Recent Development
            </p>
            {activityFeed.length === 0 ? (
              <p className="text-sm text-ink-faint italic text-center py-8">No recent activity.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {activityFeed.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Commits */}
        {activeTab === 'commits' && (
          <div>
            <p className="text-xs font-bold text-ink-muted mb-4 uppercase tracking-widest">
              Recent Commits — {context!.activeBranch}
            </p>
            {context!.recentCommits.length === 0 ? (
              <p className="text-sm text-ink-faint italic">No commits found.</p>
            ) : (
              <CommitsSection commits={context!.recentCommits} />
            )}
          </div>
        )}

        {/* Pull Requests */}
        {activeTab === 'prs' && (
          <div>
            <p className="text-xs font-bold text-ink-muted mb-4 uppercase tracking-widest">
              Open Pull Requests
            </p>
            <PRsSection prs={context!.openPullRequests} />
          </div>
        )}

        {/* Issues */}
        {activeTab === 'issues' && (
          <div>
            <p className="text-xs font-bold text-ink-muted mb-4 uppercase tracking-widest">
              Open Issues
            </p>
            <IssuesSection issues={context!.openIssues} />
          </div>
        )}

        {/* Branches */}
        {activeTab === 'branches' && (
          <div>
            <p className="text-xs font-bold text-ink-muted mb-4 uppercase tracking-widest">
              Branches ({context!.branches.length})
            </p>
            {context!.branches.length === 0 ? (
              <p className="text-sm text-ink-faint italic">No branches found.</p>
            ) : (
              <BranchesSection branches={context!.branches} />
            )}
          </div>
        )}
      </div>

      {/* ── Changed files footer ─────────────────────────────────── */}
      {context!.recentFileChanges.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="w-4 h-4 text-ink-faint" />
            <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">
              Recently Changed Files
            </p>
          </div>
          <div className="card p-4">
            <div className="flex flex-wrap gap-2">
              {context!.recentFileChanges.map((f) => (
                <span
                  key={f.path}
                  className={`
                    font-mono text-[11px] px-2 py-1 rounded border flex items-center gap-1
                    ${f.status === 'added'    ? 'bg-sticky-green/10 border-green-200 text-green-700' :
                      f.status === 'removed'  ? 'bg-sticky-pink/8 border-red-200 text-red-600' :
                      f.status === 'renamed'  ? 'bg-sticky-yellow/15 border-yellow-200 text-yellow-700' :
                      'bg-paper-dark border-border text-ink-muted'}
                  `}
                >
                  <span>{f.path.split('/').pop()}</span>
                  <DiffStat additions={f.additions} deletions={f.deletions} />
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
