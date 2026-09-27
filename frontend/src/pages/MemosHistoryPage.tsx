import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_MEMOS, isDemoMode } from '../lib/demo';
import type { Memo } from '../types';
import { timeAgo, formatDate } from '../lib/utils';
import { GitCommit, GitPullRequest, AlertTriangle, Plus, ArrowRight } from 'lucide-react';

export default function MemosHistoryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const isDemo = isDemoMode();

  const { data: memos = [], isLoading } = useQuery<Memo[]>({
    queryKey: ['memos', projectId],
    queryFn: () => {
      if (isDemo) return Promise.resolve(DEMO_MEMOS);
      return api.get(`/projects/${projectId}/memos`).then((r) => r.data);
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">Memos</h1>
          <p className="text-sm text-ink-muted">Session handoff history for this project</p>
        </div>
        <Link to={`/projects/${projectId}/memos/new`} className="btn-end-session text-sm px-4 py-2">
          <Plus className="w-4 h-4" />
          End Session
        </Link>
      </div>

      {memos.length === 0 ? (
        <div className="card-editorial p-16 text-center">
          <p className="text-ink-muted text-sm mb-6">
            No memos yet. End a session to create the first one.
          </p>
          <Link to={`/projects/${projectId}/memos/new`} className="btn-end-session">
            End your first session
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {memos.map((memo) => {
            const commitCount = memo.github_activities.filter((a) => a.activity_type === 'commit').length;
            const prCount     = memo.github_activities.filter((a) => a.activity_type === 'pull_request').length;
            return (
              <Link
                key={memo.id}
                to={`/projects/${projectId}/memos/${memo.id}`}
                className="card-collage p-5 flex items-start gap-4 group"
              >
                {/* Avatar */}
                {memo.author?.avatar_url ? (
                  <img
                    src={memo.author.avatar_url}
                    className="avatar-md rounded-full flex-shrink-0 object-cover"
                    alt={memo.author.display_name}
                  />
                ) : (
                  <div className="avatar-md bg-sticky-blue flex items-center justify-center text-ink font-bold flex-shrink-0">
                    {memo.author?.display_name[0].toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink text-sm">{memo.author?.display_name}</span>
                      {memo.is_draft && <span className="badge-todo">Draft</span>}
                    </div>
                    <span className="text-xs text-ink-faint flex-shrink-0">{timeAgo(memo.created_at)}</span>
                  </div>

                  {memo.in_progress && (
                    <p className="text-sm text-ink-soft mt-1 line-clamp-2 leading-snug">{memo.in_progress}</p>
                  )}

                  {memo.blocked && (
                    <p className="text-xs text-sticky-pink flex items-center gap-1 mt-1.5">
                      <AlertTriangle className="w-3 h-3" />
                      {memo.blocked}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-xs font-mono text-ink-faint">
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
                    <span>{formatDate(memo.created_at)}</span>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-ink-faint opacity-0 group-hover:opacity-100 flex-shrink-0 mt-1 transition-opacity" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
