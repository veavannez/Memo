import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { CatchMeUp } from '../types';
import { timeAgo, statusBadgeClass, getStatusLabel } from '../lib/utils';
import { GitCommit, GitPullRequest, AlertTriangle, ArrowRight, Clock, FileText, CheckSquare } from 'lucide-react';

export default function CatchMeUpPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading, error } = useQuery<CatchMeUp>({
    queryKey: ['catch-me-up', projectId],
    queryFn: () => api.get(`/projects/${projectId}/catch-me-up`).then((r) => r.data),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="card p-6 text-center text-gray-400">
          Failed to load Catch Me Up. Try again.
        </div>
      </div>
    );
  }

  const commits = data.recent_github_activity.filter((a) => a.activity_type === 'commit');
  const prs = data.recent_github_activity.filter((a) => a.activity_type === 'pull_request');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          ⚡ Catch Me Up
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's been happening</p>
      </div>

      {/* Summary */}
      <div className="card p-5 mb-6 bg-gray-50 border-gray-200">
        <ul className="space-y-1.5">
          {data.summary_lines.map((line, i) => (
            <li key={i} className="text-sm text-gray-700">
              {i === 0 ? (
                <span className="font-semibold text-gray-900">{line}</span>
              ) : (
                line
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Last memo */}
        {data.last_session_memo && (
          <div className="card p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Your Last Memo
            </h2>
            <p className="text-xs text-gray-400 mb-2">{timeAgo(data.last_session_memo.created_at)}</p>
            {data.last_session_memo.in_progress && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Was working on</p>
                <p className="text-sm text-gray-700">{data.last_session_memo.in_progress}</p>
              </div>
            )}
            {data.last_session_memo.blocked && (
              <div className="mb-2">
                <p className="text-xs font-medium text-yellow-600 mb-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Blocked
                </p>
                <p className="text-sm text-yellow-700">{data.last_session_memo.blocked}</p>
              </div>
            )}
            <Link
              to={`/projects/${projectId}/memos/${data.last_session_memo.id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              View full memo →
            </Link>
          </div>
        )}

        {/* My tasks */}
        <div className="card p-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" /> Your Tasks
          </h2>
          {data.my_open_tasks.length === 0 ? (
            <p className="text-sm text-gray-400">No open tasks.</p>
          ) : (
            <div className="space-y-2">
              {data.my_open_tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 flex-1 truncate">{task.title}</span>
                  <span className={`${statusBadgeClass(task.status)} flex-shrink-0`}>
                    {getStatusLabel(task.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {data.my_blocked_tasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-yellow-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Blocked
              </p>
              {data.my_blocked_tasks.map((task) => (
                <p key={task.id} className="text-sm text-yellow-700 mb-1">{task.title}</p>
              ))}
            </div>
          )}
        </div>

        {/* Team memos */}
        {data.team_memos_since_last.length > 0 && (
          <div className="card p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Team Activity Since Your Last Session
            </h2>
            <div className="space-y-3">
              {data.team_memos_since_last.map((memo) => (
                <div key={memo.id} className="border-l-2 border-gray-100 pl-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    {memo.author?.avatar_url && (
                      <img
                        src={memo.author.avatar_url}
                        className="w-5 h-5 rounded-full"
                        alt=""
                      />
                    )}
                    <span className="text-xs font-medium text-gray-700">{memo.author?.display_name}</span>
                    <span className="text-xs text-gray-400">{timeAgo(memo.created_at)}</span>
                  </div>
                  {memo.in_progress && (
                    <p className="text-sm text-gray-600 line-clamp-2">{memo.in_progress}</p>
                  )}
                  <Link
                    to={`/projects/${projectId}/memos/${memo.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Read memo →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested next steps */}
        {data.suggested_next_steps.length > 0 && (
          <div className="card p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Suggested Next Steps
            </h2>
            <ul className="space-y-2">
              {data.suggested_next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* GitHub activity */}
        {data.recent_github_activity.length > 0 && (
          <div className="card p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Recent GitHub Activity
            </h2>
            <div className="space-y-1.5">
              {commits.slice(0, 5).map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600"
                >
                  <GitCommit className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <code className="text-gray-400 font-mono">{c.github_id}</code>
                  <span className="truncate">{c.title}</span>
                </a>
              ))}
              {prs.slice(0, 3).map((pr) => (
                <a
                  key={pr.id}
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-blue-600"
                >
                  <GitPullRequest className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{pr.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-8 flex gap-3">
        <Link to={`/projects/${projectId}/memos/new`} className="btn-primary">
          Create Memo / Start Session
        </Link>
        <Link to={`/projects/${projectId}/kanban`} className="btn-secondary">
          View Kanban
        </Link>
      </div>
    </div>
  );
}
