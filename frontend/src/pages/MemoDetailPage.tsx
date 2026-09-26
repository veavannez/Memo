import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Memo, Task } from '../types';
import {
  timeAgo, formatDateTime, statusBadgeClass, priorityBadgeClass,
  getStatusLabel, getPriorityLabel,
} from '../lib/utils';
import { GitCommit, GitPullRequest, ExternalLink, Edit, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { MemoForm } from '../features/memos/MemoForm';
import toast from 'react-hot-toast';

export default function MemoDetailPage() {
  const { projectId, memoId } = useParams<{ projectId: string; memoId: string }>();
  const [editing, setEditing] = useState(false);
  const [convertingTasks, setConvertingTasks] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: memo, isLoading } = useQuery<Memo>({
    queryKey: ['memo', projectId, memoId],
    queryFn: () => api.get(`/projects/${projectId}/memos/${memoId}`).then((r) => r.data),
    enabled: !!projectId && !!memoId,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', projectId, { source_memo: memoId }],
    queryFn: () =>
      api.get(`/projects/${projectId}/tasks`).then((r) =>
        r.data.filter((t: Task) => t.source_memo_id === Number(memoId))
      ),
    enabled: !!projectId && !!memoId,
  });

  const refreshActivity = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/memos/${memoId}/refresh-activity`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memo', projectId, memoId] });
      toast.success('GitHub activity refreshed');
    },
  });

  const createFromNextSteps = useMutation({
    mutationFn: (steps: string[]) =>
      api.post(`/projects/${projectId}/tasks/from-memo/${memoId}`, {
        next_steps: steps,
        priority: 'medium',
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Tasks created!');
      setConvertingTasks(false);
      setSelectedSteps([]);
    },
    onError: () => toast.error('Failed to create tasks'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!memo) return <div className="p-8 text-gray-500">Memo not found.</div>;

  const nextStepLines = memo.next_steps
    ? memo.next_steps.split('\n').map((l) => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean)
    : [];

  const commits = memo.github_activities.filter((a) => a.activity_type === 'commit');
  const prs = memo.github_activities.filter((a) => a.activity_type === 'pull_request');

  if (editing) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Memo</h1>
        <div className="card p-6">
          <MemoForm
            projectId={projectId!}
            initial={memo}
            onSuccess={() => {
              setEditing(false);
              queryClient.invalidateQueries({ queryKey: ['memo', projectId, memoId] });
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {memo.author?.avatar_url && (
              <img
                src={memo.author.avatar_url}
                alt={memo.author.display_name}
                className="w-7 h-7 rounded-full"
              />
            )}
            <span className="text-sm font-medium text-gray-700">{memo.author?.display_name}</span>
            {memo.is_draft && (
              <span className="badge bg-gray-100 text-gray-600">Draft</span>
            )}
          </div>
          <p className="text-xs text-gray-400">{formatDateTime(memo.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-xs"
            onClick={() => refreshActivity.mutate()}
            disabled={refreshActivity.isPending}
          >
            {refreshActivity.isPending ? 'Refreshing…' : 'Refresh Activity'}
          </button>
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Edit className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Sections */}
          {memo.completed && (
            <MemoSection label="Completed" icon={<CheckCircle className="w-4 h-4 text-green-500" />}>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{memo.completed}</pre>
            </MemoSection>
          )}

          {memo.in_progress && (
            <MemoSection label="In Progress">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{memo.in_progress}</pre>
            </MemoSection>
          )}

          {memo.blocked && (
            <MemoSection
              label="Blocked"
              icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
              className="border-yellow-200 bg-yellow-50"
            >
              <pre className="whitespace-pre-wrap text-sm text-yellow-800 font-sans">{memo.blocked}</pre>
            </MemoSection>
          )}

          {memo.next_steps && (
            <MemoSection label="Next Steps">
              <div className="space-y-1">
                {nextStepLines.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gray-300 mt-0.5">→</span>
                    <span className="text-sm text-gray-700">{step}</span>
                  </div>
                ))}
              </div>
              {nextStepLines.length > 0 && !convertingTasks && (
                <button
                  className="btn-secondary text-xs mt-3"
                  onClick={() => {
                    setConvertingTasks(true);
                    setSelectedSteps(nextStepLines);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Convert to Tasks
                </button>
              )}
              {convertingTasks && (
                <div className="mt-3 border-t pt-3 border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Select steps to convert:</p>
                  {nextStepLines.map((step, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm text-gray-700 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSteps.includes(step)}
                        onChange={(e) =>
                          setSelectedSteps((prev) =>
                            e.target.checked
                              ? [...prev, step]
                              : prev.filter((s) => s !== step)
                          )
                        }
                        className="rounded"
                      />
                      {step}
                    </label>
                  ))}
                  <div className="flex gap-2 mt-3">
                    <button
                      className="btn-primary text-xs"
                      onClick={() => createFromNextSteps.mutate(selectedSteps)}
                      disabled={selectedSteps.length === 0 || createFromNextSteps.isPending}
                    >
                      {createFromNextSteps.isPending ? 'Creating…' : `Create ${selectedSteps.length} Task${selectedSteps.length > 1 ? 's' : ''}`}
                    </button>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => setConvertingTasks(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </MemoSection>
          )}

          {memo.notes && (
            <MemoSection label="Notes">
              <pre className="whitespace-pre-wrap text-sm text-gray-600 font-sans">{memo.notes}</pre>
            </MemoSection>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* GitHub Activity */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              GitHub Activity
            </h3>
            {memo.github_activities.length === 0 ? (
              <p className="text-xs text-gray-400">No activity attached yet.</p>
            ) : (
              <div className="space-y-2">
                {commits.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <GitCommit className="w-3 h-3" /> {commits.length} commit{commits.length > 1 ? 's' : ''}
                    </p>
                    {commits.slice(0, 5).map((c) => (
                      <a
                        key={c.id}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-gray-600 hover:text-blue-600 truncate py-0.5 flex items-center gap-1"
                      >
                        <code className="text-gray-400 font-mono text-xs">{c.github_id}</code>
                        <span className="truncate">{c.title}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-300" />
                      </a>
                    ))}
                  </div>
                )}
                {prs.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <GitPullRequest className="w-3 h-3" /> {prs.length} pull request{prs.length > 1 ? 's' : ''}
                    </p>
                    {prs.map((pr) => (
                      <a
                        key={pr.id}
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-gray-600 hover:text-blue-600 truncate py-0.5 flex items-center gap-1"
                      >
                        <code className="text-gray-400 font-mono text-xs">#{pr.github_id}</code>
                        <span className="truncate">{pr.title}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-300" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tasks from this memo */}
          {tasks.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Tasks from this Memo
              </h3>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-gray-700 flex-1">{task.title}</span>
                    <span className={`${statusBadgeClass(task.status)} text-xs`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to={`/projects/${projectId}/kanban`}
                className="text-xs text-blue-600 hover:underline mt-2 inline-block"
              >
                View on Kanban →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MemoSection({
  label,
  icon,
  children,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card p-4 ${className ?? ''}`}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</h3>
      </div>
      {children}
    </div>
  );
}
