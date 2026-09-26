import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type { Memo } from '../types';
import { timeAgo, formatDate } from '../lib/utils';
import { GitCommit, GitPullRequest, AlertTriangle, Plus } from 'lucide-react';

export default function MemosHistoryPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: memos = [], isLoading } = useQuery<Memo[]>({
    queryKey: ['memos', projectId],
    queryFn: () => api.get(`/projects/${projectId}/memos`).then((r) => r.data),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Memos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Developer handoff history</p>
        </div>
        <Link to={`/projects/${projectId}/memos/new`} className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Memo
        </Link>
      </div>

      {memos.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-gray-400 text-sm mb-4">No memos yet. End a session to create one.</p>
          <Link to={`/projects/${projectId}/memos/new`} className="btn-primary">
            Create your first Memo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {memos.map((memo) => {
            const commitCount = memo.github_activities.filter((a) => a.activity_type === 'commit').length;
            const prCount = memo.github_activities.filter((a) => a.activity_type === 'pull_request').length;
            return (
              <Link
                key={memo.id}
                to={`/projects/${projectId}/memos/${memo.id}`}
                className="card p-5 hover:border-gray-300 transition-colors flex items-start gap-4"
              >
                {memo.author?.avatar_url ? (
                  <img
                    src={memo.author.avatar_url}
                    className="w-9 h-9 rounded-full flex-shrink-0"
                    alt={memo.author.display_name}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                    {memo.author?.display_name[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-medium text-gray-900 text-sm">{memo.author?.display_name}</span>
                      {memo.is_draft && (
                        <span className="ml-2 badge bg-gray-100 text-gray-500">Draft</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(memo.created_at)}</span>
                  </div>

                  {memo.in_progress && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{memo.in_progress}</p>
                  )}

                  {memo.blocked && (
                    <p className="text-xs text-yellow-600 flex items-center gap-1 mt-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      {memo.blocked}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {commitCount > 0 && (
                      <span className="flex items-center gap-1">
                        <GitCommit className="w-3 h-3" /> {commitCount}
                      </span>
                    )}
                    {prCount > 0 && (
                      <span className="flex items-center gap-1">
                        <GitPullRequest className="w-3 h-3" /> {prCount}
                      </span>
                    )}
                    <span className="text-gray-300">{formatDate(memo.created_at)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
