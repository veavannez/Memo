import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_MEMOS, DEMO_TASKS, isDemoMode } from '../lib/demo';
import type { Memo, Task } from '../types';
import { timeAgo, formatDateTime, statusBadgeClass, getStatusLabel } from '../lib/utils';
import {
  GitCommit, GitPullRequest, ExternalLink, Edit, Plus,
  AlertTriangle, CheckCircle, ArrowLeft, ArrowRight, CheckSquare,
} from 'lucide-react';
import { MemoForm } from '../features/memos/MemoForm';
import toast from 'react-hot-toast';

// ─── Memo section block ───────────────────────────────────────────────────────
function MemoSection({
  label, icon, children, accent = 'border-ink',
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`border-l-4 ${accent} pl-4 py-1 mb-5`}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="section-heading mb-0">{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function MemoDetailPage() {
  const { projectId, memoId } = useParams<{ projectId: string; memoId: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [convertingTasks, setConvertingTasks] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const isDemo = isDemoMode();

  const { data: memo, isLoading } = useQuery<Memo>({
    queryKey: ['memo', projectId, memoId],
    queryFn: () => {
      if (isDemo) {
        const m = DEMO_MEMOS.find((m) => m.id === Number(memoId));
        return Promise.resolve(m ?? DEMO_MEMOS[0]);
      }
      return api.get(`/projects/${projectId}/memos/${memoId}`).then((r) => r.data);
    },
    enabled: !!projectId && !!memoId,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', projectId, { source_memo: memoId }],
    queryFn: () => {
      if (isDemo) return Promise.resolve(DEMO_TASKS.filter((t) => t.source_memo_id === Number(memoId)));
      return api.get(`/projects/${projectId}/tasks`).then((r) =>
        r.data.filter((t: Task) => t.source_memo_id === Number(memoId))
      );
    },
    enabled: !!projectId && !!memoId,
  });

  const createFromNextSteps = useMutation({
    mutationFn: (steps: string[]) => {
      if (isDemo) {
        return Promise.resolve({ created: steps.length });
      }
      return api.post(`/projects/${projectId}/tasks/from-memo/${memoId}`, {
        next_steps: steps,
        priority: 'medium',
      }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Tasks created! Head to Kanban to track them.');
      setConvertingTasks(false);
      setSelectedSteps([]);
    },
    onError: () => toast.error('Failed to create tasks'),
  });

  if (isLoading || !memo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  const nextStepLines = memo.next_steps
    ? memo.next_steps.split('\n').map((l) => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean)
    : [];

  const commits = memo.github_activities.filter((a) => a.activity_type === 'commit');
  const prs     = memo.github_activities.filter((a) => a.activity_type === 'pull_request');

  // Workflow progress
  const hasTasks = tasks.length > 0;

  if (editing) {
    return (
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8">
        <h1 className="text-2xl font-bold text-ink mb-6">Edit Memo</h1>
        <div className="card-editorial p-6">
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
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Memos
      </button>

      {/* Workflow progress bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {[
          { label: 'End Session',  color: 'bg-sticky-yellow', done: true   },
          { label: 'Create Tasks', color: 'bg-sticky-green',  done: hasTasks, active: !hasTasks },
          { label: 'Kanban',       color: 'bg-sticky-blue',   done: false  },
          { label: 'Catch Me Up',  color: 'bg-sticky-orange', done: false  },
        ].map(({ label, color, done, active }) => (
          <div key={label} className={done ? 'workflow-step text-ink-faint line-through' : active ? 'workflow-step-active' : 'workflow-step'}>
            <span className={done ? 'workflow-step-dot bg-sticky-green' : active ? 'workflow-step-dot-active' : 'workflow-step-dot'} />
            {label}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {memo.author?.avatar_url ? (
              <img src={memo.author.avatar_url} alt={memo.author.display_name} className="avatar-sm rounded-full" />
            ) : (
              <div className="avatar-sm bg-sticky-blue flex items-center justify-center text-ink font-bold">
                {memo.author?.display_name[0]}
              </div>
            )}
            <span className="font-semibold text-ink">{memo.author?.display_name}</span>
            {memo.is_draft && <span className="badge-todo">Draft</span>}
          </div>
          <p className="text-xs text-ink-faint">{formatDateTime(memo.created_at)}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!isDemo && (
            <button className="btn-secondary text-sm" onClick={() => setEditing(true)}>
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* ── CREATE TASKS primary CTA — appears before body when next steps exist ── */}
      {nextStepLines.length > 0 && !hasTasks && (
        <div className="sticky-green sticky mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-bold text-sm text-ink mb-0.5">
                {nextStepLines.length} next step{nextStepLines.length > 1 ? 's' : ''} ready to convert
              </p>
              <p className="text-xs text-ink-soft">
                Turn your next steps into tracked tasks on the Kanban board.
              </p>
            </div>
            <button
              className="btn-create-tasks flex-shrink-0"
              onClick={() => {
                setConvertingTasks(true);
                setSelectedSteps(nextStepLines);
              }}
            >
              <CheckSquare className="w-5 h-5" />
              Create Tasks
            </button>
          </div>
          {/* Task conversion form (inline) */}
          {convertingTasks && (
            <div className="mt-4 pt-4 border-t border-ink/20">
              <p className="text-xs font-bold text-ink mb-3 uppercase tracking-widest">Select steps to convert:</p>
              <div className="space-y-1.5 mb-4">
                {nextStepLines.map((step, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-ink cursor-pointer hover:text-ink-soft transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedSteps.includes(step)}
                      onChange={(e) =>
                        setSelectedSteps((prev) =>
                          e.target.checked ? [...prev, step] : prev.filter((s) => s !== step)
                        )
                      }
                      className="rounded border-ink/30 accent-ink"
                    />
                    {step}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary text-sm"
                  onClick={() => createFromNextSteps.mutate(selectedSteps)}
                  disabled={selectedSteps.length === 0 || createFromNextSteps.isPending}
                >
                  {createFromNextSteps.isPending
                    ? 'Creating…'
                    : `Create ${selectedSteps.length} Task${selectedSteps.length > 1 ? 's' : ''}`}
                </button>
                <button className="btn-ghost text-sm" onClick={() => setConvertingTasks(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tasks already created — show nav to Kanban */}
      {hasTasks && (
        <div className="card border-sticky-green/40 bg-sticky-green/10 px-4 py-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ink flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-sticky-green" />
            {tasks.length} task{tasks.length > 1 ? 's' : ''} created from this memo
          </p>
          <Link to={`/projects/${projectId}/kanban`} className="btn-primary text-sm px-4 py-2">
            <ArrowRight className="w-4 h-4" />
            View Kanban
          </Link>
        </div>
      )}

      {/* ── Main content grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-0">

          {memo.completed && (
            <MemoSection label="Completed" accent="border-sticky-green" icon={<CheckCircle className="w-4 h-4 text-sticky-green" />}>
              <pre className="whitespace-pre-wrap text-sm text-ink-soft font-sans leading-relaxed">{memo.completed}</pre>
            </MemoSection>
          )}

          {memo.in_progress && (
            <MemoSection label="In Progress" accent="border-sticky-blue">
              <pre className="whitespace-pre-wrap text-sm text-ink-soft font-sans leading-relaxed">{memo.in_progress}</pre>
            </MemoSection>
          )}

          {memo.blocked && (
            <MemoSection label="Blocked" accent="border-sticky-pink" icon={<AlertTriangle className="w-4 h-4 text-sticky-pink" />}>
              <pre className="whitespace-pre-wrap text-sm text-ink-soft font-sans leading-relaxed">{memo.blocked}</pre>
            </MemoSection>
          )}

          {memo.next_steps && (
            <MemoSection label="Next Steps" accent="border-sticky-yellow">
              <div className="space-y-1.5">
                {nextStepLines.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                    <span className="text-sticky-yellow mt-0.5 flex-shrink-0">→</span>
                    {step}
                  </div>
                ))}
              </div>
            </MemoSection>
          )}

          {memo.notes && (
            <MemoSection label="Notes" accent="border-border">
              <pre className="whitespace-pre-wrap text-sm text-ink-muted font-sans leading-relaxed">{memo.notes}</pre>
            </MemoSection>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* GitHub Activity */}
          <div className="card p-4">
            <p className="section-heading">GitHub Activity</p>
            {memo.github_activities.length === 0 ? (
              <p className="text-xs text-ink-faint">No activity attached yet.</p>
            ) : (
              <div className="space-y-3">
                {commits.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-faint mb-1.5 flex items-center gap-1">
                      <GitCommit className="w-3 h-3" /> {commits.length} commit{commits.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                      {commits.slice(0, 5).map((c) => (
                        <a
                          key={c.id}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors group"
                        >
                          <code className="font-mono text-ink-faint">{c.github_id?.slice(0, 7)}</code>
                          <span className="truncate">{c.title}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {prs.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-faint mb-1.5 flex items-center gap-1">
                      <GitPullRequest className="w-3 h-3" /> {prs.length} PR{prs.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                      {prs.map((pr) => (
                        <a
                          key={pr.id}
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors group"
                        >
                          <code className="font-mono text-ink-faint">#{pr.github_id}</code>
                          <span className="truncate">{pr.title}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tasks from this memo */}
          {tasks.length > 0 && (
            <div className="card p-4">
              <p className="section-heading">Tasks from this Memo</p>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-ink-soft flex-1 leading-snug">{task.title}</span>
                    <span className={`${statusBadgeClass(task.status)} flex-shrink-0`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to={`/projects/${projectId}/kanban`}
                className="text-xs text-ink-muted hover:text-ink transition-colors mt-3 inline-flex items-center gap-1 font-medium"
              >
                View on Kanban <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Next: Catch Me Up */}
          <div className="card p-4 border-dashed">
            <p className="section-heading">What's next?</p>
            <div className="space-y-2">
              {!hasTasks && nextStepLines.length > 0 && (
                <button
                  className="btn-create-tasks w-full text-sm"
                  onClick={() => { setConvertingTasks(true); setSelectedSteps(nextStepLines); }}
                >
                  <CheckSquare className="w-4 h-4" />
                  Create Tasks
                </button>
              )}
              <Link to={`/projects/${projectId}/kanban`} className="btn-secondary w-full text-sm">
                View Kanban
              </Link>
              <Link to={`/projects/${projectId}/catch-me-up`} className="btn-catch-me-up w-full text-sm">
                Catch Me Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
