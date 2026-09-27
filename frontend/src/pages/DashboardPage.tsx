import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_DASHBOARD, isDemoMode } from '../lib/demo';
import type { Dashboard, TeamMemberStatus, Memo } from '../types';
import { timeAgo } from '../lib/utils';
import {
  AlertTriangle, ChevronRight, GitCommit, GitPullRequest,
  Zap, Plus, ArrowRight, Clock,
} from 'lucide-react';

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, src, size = 'md' }: { name: string; src?: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'avatar-sm' : 'avatar-md';
  if (src) return <img src={src} alt={name} className={`${cls} rounded-full object-cover`} />;
  const colors = ['bg-sticky-yellow','bg-sticky-blue','bg-sticky-green','bg-sticky-lavender','bg-sticky-orange','bg-sticky-pink'];
  const color  = colors[name.charCodeAt(0) % colors.length];
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return <div className={`${cls} ${color} flex items-center justify-center text-ink font-bold`}>{initials}</div>;
}

// ─── Team card ────────────────────────────────────────────────────────────────
function TeamCard({ member }: { member: TeamMemberStatus }) {
  const { user, role, latest_memo, current_task, open_tasks_count, blocked_tasks_count } = member;
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="card p-4 hover:border-ink/30 transition-colors">
      <div className="flex items-start gap-3">
        <Avatar name={user.display_name} src={user.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink text-sm">{user.display_name}</span>
            {role === 'owner' && <span className="badge-owner">Owner</span>}
          </div>
          {user.github_login && (
            <p className="text-xs font-mono text-ink-faint">@{user.github_login}</p>
          )}
        </div>
        {blocked_tasks_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-sticky-pink font-semibold flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            {blocked_tasks_count} blocked
          </span>
        )}
      </div>

      {current_task && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-ink-faint mb-1">Working on</p>
          <p className="text-sm text-ink font-medium truncate">{current_task.title}</p>
        </div>
      )}

      {latest_memo && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-ink-faint">Last memo</p>
            <p className="text-xs text-ink-faint flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(latest_memo.created_at)}
            </p>
          </div>
          {latest_memo.in_progress && (
            <p className="text-sm text-ink-soft line-clamp-2 leading-snug">{latest_memo.in_progress}</p>
          )}
          {latest_memo.blocked && (
            <p className="text-xs text-sticky-pink mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {latest_memo.blocked}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
        <span>{open_tasks_count} open tasks</span>
        {latest_memo && (
          <Link
            to={`/projects/${projectId}/memos/${latest_memo.id}`}
            className="flex items-center gap-1 text-ink-muted hover:text-ink transition-colors font-medium"
          >
            View memo <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Memo card ────────────────────────────────────────────────────────────────
function MemoCard({ memo }: { memo: Memo }) {
  const { projectId } = useParams<{ projectId: string }>();
  const commits = memo.github_activities.filter((a) => a.activity_type === 'commit').length;
  const prs     = memo.github_activities.filter((a) => a.activity_type === 'pull_request').length;

  return (
    <Link
      to={`/projects/${projectId}/memos/${memo.id}`}
      className="card-collage p-4 flex items-start gap-3 group"
    >
      <Avatar name={memo.author?.display_name ?? '?'} src={memo.author?.avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-semibold text-ink">{memo.author?.display_name}</span>
          <span className="text-xs text-ink-faint flex-shrink-0">{timeAgo(memo.created_at)}</span>
        </div>
        {memo.in_progress && (
          <p className="text-sm text-ink-soft line-clamp-2 leading-snug mb-1.5">{memo.in_progress}</p>
        )}
        {memo.blocked && (
          <p className="text-xs text-sticky-pink flex items-center gap-1 mb-1.5">
            <AlertTriangle className="w-3 h-3" /> {memo.blocked}
          </p>
        )}
        {(commits > 0 || prs > 0) && (
          <div className="flex items-center gap-3 text-xs font-mono text-ink-faint">
            {commits > 0 && <span className="flex items-center gap-1"><GitCommit className="w-3 h-3" /> {commits}</span>}
            {prs     > 0 && <span className="flex items-center gap-1"><GitPullRequest className="w-3 h-3" /> {prs}</span>}
          </div>
        )}
      </div>
      <ArrowRight className="w-4 h-4 text-ink-faint opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1 transition-opacity" />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ['dashboard', projectId],
    queryFn: () => {
      if (isDemoMode()) return Promise.resolve(DEMO_DASHBOARD);
      return api.get(`/projects/${projectId}/dashboard`).then((r) => r.data);
    },
    enabled: !!projectId,
    refetchInterval: isDemoMode() ? false : 30000,
  });

  if (isLoading || !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  const { project, team, recent_memos, recent_tasks } = dashboard;
  const blockedTasks = recent_tasks.filter((t) => t.status === 'blocked');

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">

      {/* ── Project header ─────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">{project.name}</h1>
          {project.repository && (
            <a
              href={project.repository.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-ink-faint hover:text-ink transition-colors"
            >
              ⬡ {project.repository.full_name}
            </a>
          )}
        </div>

        {/* Primary workflow CTAs */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            to={`/projects/${projectId}/catch-me-up`}
            className="btn-catch-me-up"
          >
            <Zap className="w-5 h-5" />
            Catch Me Up
          </Link>
          <Link
            to={`/projects/${projectId}/memos/new`}
            className="btn-end-session"
          >
            <Plus className="w-5 h-5" />
            End Session
          </Link>
        </div>
      </div>

      {/* ── Blocked alert ──────────────────────────────────── */}
      {blockedTasks.length > 0 && (
        <div className="card border-sticky-pink/50 bg-sticky-pink/10 px-4 py-3 mb-6 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-ink mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-ink">
              {blockedTasks.length} blocked task{blockedTasks.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 text-sm text-ink-soft list-disc list-inside">
              {blockedTasks.slice(0, 3).map((t) => <li key={t.id}>{t.title}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* ── Main content ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Team — spans 2 cols */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="section-heading mb-0">Team</p>
            <span className="text-xs font-mono text-ink-faint">{team.length} members</span>
          </div>
          {team.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-ink-muted text-sm">No team members yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {team.map((member) => (
                <TeamCard key={member.user.id} member={member} />
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Recent memos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="section-heading mb-0">Recent Memos</p>
              <Link
                to={`/projects/${projectId}/memos`}
                className="text-xs font-medium text-ink-muted hover:text-ink transition-colors"
              >
                View all →
              </Link>
            </div>
            {recent_memos.length === 0 ? (
              <div className="card p-5 text-center">
                <p className="text-ink-faint text-sm">No memos yet.</p>
                <Link
                  to={`/projects/${projectId}/memos/new`}
                  className="btn-end-session mt-3 text-sm px-4 py-2"
                >
                  End your first session
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recent_memos.slice(0, 5).map((memo) => (
                  <MemoCard key={memo.id} memo={memo} />
                ))}
              </div>
            )}
          </div>

          {/* Workflow reminder */}
          <div className="card p-4 border-dashed">
            <p className="text-xs font-bold text-ink mb-3 uppercase tracking-widest">Workflow</p>
            <div className="space-y-2">
              {[
                { label: 'End Session',  color: 'bg-sticky-yellow',   to: `/projects/${projectId}/memos/new` },
                { label: 'Create Tasks', color: 'bg-sticky-green',    to: `/projects/${projectId}/tasks` },
                { label: 'Kanban',       color: 'bg-sticky-blue',     to: `/projects/${projectId}/kanban` },
                { label: 'Catch Me Up',  color: 'bg-sticky-orange',   to: `/projects/${projectId}/catch-me-up` },
              ].map(({ label, color, to }) => (
                <Link key={label} to={to} className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors group">
                  <span className={`w-2.5 h-2.5 rounded-full ${color} border border-ink/20 flex-shrink-0`} />
                  {label}
                  <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
