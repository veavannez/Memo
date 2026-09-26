import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { Dashboard, TeamMemberStatus, Memo, Task } from '../types';
import { timeAgo, statusBadgeClass, getStatusLabel } from '../lib/utils';
import { AlertTriangle, Clock, ChevronRight, GitCommit, GitPullRequest, Zap, Plus } from 'lucide-react';

function Avatar({ user }: { user: { display_name: string; avatar_url?: string } }) {
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.display_name} className="w-9 h-9 rounded-full" />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
      {user.display_name[0].toUpperCase()}
    </div>
  );
}

function TeamCard({ member }: { member: TeamMemberStatus }) {
  const { user, role, latest_memo, current_task, open_tasks_count, blocked_tasks_count } = member;

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <Avatar user={user} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm">{user.display_name}</span>
            {role === 'owner' && (
              <span className="badge bg-purple-100 text-purple-700 text-xs">Owner</span>
            )}
          </div>
          {user.github_login && (
            <p className="text-xs text-gray-400 font-mono">@{user.github_login}</p>
          )}
        </div>
        {blocked_tasks_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {blocked_tasks_count} blocked
          </span>
        )}
      </div>

      {current_task && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-1">Currently working on</p>
          <p className="text-sm text-gray-700 font-medium truncate">{current_task.title}</p>
        </div>
      )}

      {latest_memo && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400">Last Memo</p>
            <p className="text-xs text-gray-400">{timeAgo(latest_memo.created_at)}</p>
          </div>
          {latest_memo.in_progress && (
            <p className="text-sm text-gray-600 line-clamp-2">{latest_memo.in_progress}</p>
          )}
          {latest_memo.blocked && (
            <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {latest_memo.blocked}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>{open_tasks_count} open tasks</span>
        {latest_memo && (
          <Link
            to={`memos/${latest_memo.id}`}
            className="text-blue-600 hover:underline flex items-center gap-0.5"
          >
            View memo <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function MemoCard({ memo }: { memo: Memo }) {
  const { projectId } = useParams<{ projectId: string }>();
  const commitCount = memo.github_activities.filter((a) => a.activity_type === 'commit').length;
  const prCount = memo.github_activities.filter((a) => a.activity_type === 'pull_request').length;

  return (
    <Link
      to={`/projects/${projectId}/memos/${memo.id}`}
      className="card p-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        {memo.author && <Avatar user={memo.author} />}
        <div>
          <p className="text-sm font-medium text-gray-900">{memo.author?.display_name}</p>
          <p className="text-xs text-gray-400">{timeAgo(memo.created_at)}</p>
        </div>
      </div>
      {memo.in_progress && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{memo.in_progress}</p>
      )}
      {(commitCount > 0 || prCount > 0) && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {commitCount > 0 && (
            <span className="flex items-center gap-1">
              <GitCommit className="w-3 h-3" /> {commitCount} commits
            </span>
          )}
          {prCount > 0 && (
            <span className="flex items-center gap-1">
              <GitPullRequest className="w-3 h-3" /> {prCount} PRs
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ['dashboard', projectId],
    queryFn: () => api.get(`/projects/${projectId}/dashboard`).then((r) => r.data),
    enabled: !!projectId,
    refetchInterval: 30000,
  });

  if (isLoading || !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { project, team, recent_memos, recent_tasks } = dashboard;
  const blockedTasks = recent_tasks.filter((t) => t.status === 'blocked');
  const openTasks = recent_tasks.filter((t) => t.status !== 'done');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.repository && (
            <a
              href={project.repository.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-gray-600 font-mono"
            >
              {project.repository.full_name}
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={`/projects/${projectId}/catch-me-up`} className="btn-secondary">
            <Zap className="w-4 h-4" />
            Catch Me Up
          </Link>
          <Link to={`/projects/${projectId}/memos/new`} className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Memo
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {blockedTasks.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-5 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              {blockedTasks.length} blocked task{blockedTasks.length > 1 ? 's' : ''}
            </p>
            <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
              {blockedTasks.slice(0, 3).map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Team</h2>
          {team.length === 0 ? (
            <div className="card p-8 text-center text-gray-400 text-sm">
              No team members yet.{' '}
              <Link to={`/projects/${projectId}/settings`} className="text-blue-600 hover:underline">
                Invite someone
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {team.map((member) => (
                <TeamCard key={member.user.id} member={member} />
              ))}
            </div>
          )}
        </div>

        {/* Recent memos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Recent Memos
            </h2>
            <Link
              to={`/projects/${projectId}/memos`}
              className="text-xs text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {recent_memos.length === 0 ? (
            <div className="card p-6 text-center text-gray-400 text-sm">
              No memos yet.
              <div className="mt-2">
                <Link to={`/projects/${projectId}/memos/new`} className="text-blue-600 hover:underline text-xs">
                  Create the first one
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {recent_memos.slice(0, 5).map((memo) => (
                <MemoCard key={memo.id} memo={memo} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
