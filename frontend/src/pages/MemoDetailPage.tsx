import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_MEMOS, DEMO_TASKS, isDemoMode } from '../lib/demo';
import type { Memo, Task, GitHubActivity } from '../types';
import { formatDateTime, statusBadgeClass, getStatusLabel, timeAgo } from '../lib/utils';
import {
  GitCommit, GitPullRequest, ExternalLink, Edit,
  AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight,
  CheckSquare, GitBranch, FileCode,
} from 'lucide-react';
import { MemoForm } from '../features/memos/MemoForm';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a newline-delimited string into trimmed, non-empty lines, stripping list markers. */
function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean);
}

/** Stat pill: green additions, red deletions. */
function DiffStat({ additions, deletions }: { additions?: number; deletions?: number }) {
  if (!additions && !deletions) return null;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
      {additions != null && additions > 0 && (
        <span className="text-sticky-green">+{additions}</span>
      )}
      {deletions != null && deletions > 0 && (
        <span className="text-sticky-pink">−{deletions}</span>
      )}
    </span>
  );
}

// ─── GitHub activity receipt ──────────────────────────────────────────────────
function ActivityReceipt({ activities }: { activities: GitHubActivity[] }) {
  const commits = activities.filter((a) => a.activity_type === 'commit');
  const prs     = activities.filter((a) => a.activity_type === 'pull_request');

  if (activities.length === 0) return null;

  // Collect unique branches
  const branches = [...new Set(activities.map((a) => a.branch).filter(Boolean))] as string[];

  // All changed files (de-duped)
  const allFiles = [
    ...new Set(activities.flatMap((a) => a.changed_files ?? [])),
  ];

  const totalAdd = commits.reduce((s, c) => s + (c.additions ?? 0), 0);
  const totalDel = commits.reduce((s, c) => s + (c.deletions ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Branch row */}
      {branches.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <GitBranch className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {branches.map((b) => (
              <code key={b} className="font-mono text-ink-soft bg-paper-dark px-2 py-0.5 rounded-editorial border border-border">
                {b}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Commits */}
      {commits.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2 flex items-center gap-1.5">
            <GitCommit className="w-3 h-3" />
            {commits.length} commit{commits.length > 1 ? 's' : ''}
            <DiffStat additions={totalAdd} deletions={totalDel} />
          </p>
          <div className="space-y-1.5">
            {commits.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 group py-1 px-2 -mx-2 rounded hover:bg-paper-dark transition-colors"
              >
                <code className="font-mono text-[11px] text-ink-faint w-14 flex-shrink-0 mt-0.5 truncate">
                  {c.github_id?.slice(0, 7)}
                </code>
                <span className="text-xs text-ink-soft leading-snug flex-1 group-hover:text-ink transition-colors">
                  {c.title}
                </span>
                {(c.additions != null || c.deletions != null) && (
                  <DiffStat additions={c.additions} deletions={c.deletions} />
                )}
                <ExternalLink className="w-3 h-3 text-ink-faint flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* PRs */}
      {prs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2 flex items-center gap-1.5">
            <GitPullRequest className="w-3 h-3" />
            {prs.length} pull request{prs.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1.5">
            {prs.map((pr) => (
              <a
                key={pr.id}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 group py-1 px-2 -mx-2 rounded hover:bg-paper-dark transition-colors"
              >
                <code className="font-mono text-[11px] text-ink-faint flex-shrink-0 mt-0.5">
                  #{pr.pr_number ?? pr.github_id}
                </code>
                <span className="text-xs text-ink-soft leading-snug flex-1 group-hover:text-ink transition-colors">
                  {pr.title}
                </span>
                {pr.pr_state && (
                  <span className={`text-[10px] font-bold uppercase flex-shrink-0 mt-0.5 ${
                    pr.pr_state === 'merged' ? 'text-sticky-lavender'
                    : pr.pr_state === 'open' ? 'text-sticky-green'
                    : 'text-ink-faint'
                  }`}>
                    {pr.pr_state}
                  </span>
                )}
                <ExternalLink className="w-3 h-3 text-ink-faint flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Changed files */}
      {allFiles.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2 flex items-center gap-1.5">
            <FileCode className="w-3 h-3" />
            {allFiles.length} file{allFiles.length > 1 ? 's' : ''} changed
          </p>
          <div className="flex flex-wrap gap-1">
            {allFiles.map((f) => (
              <code key={f} className="text-[11px] font-mono text-ink-muted bg-paper-dark px-1.5 py-0.5 rounded border border-border">
                {f}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Editorial section block ──────────────────────────────────────────────────
function Section({
  number, label, children, accent, isEmpty,
}: {
  number: string;
  label: string;
  children: React.ReactNode;
  accent: string;
  isEmpty?: boolean;
}) {
  if (isEmpty) return null;
  return (
    <div className="grid grid-cols-[2rem_1fr] gap-4 mb-8 group">
      {/* Number column */}
      <div className="pt-0.5 flex flex-col items-end">
        <span className="font-display text-display-md text-ink-faint leading-none select-none">
          {number}
        </span>
        {/* Vertical rule */}
        <div className={`flex-1 w-px mt-2 ${accent} opacity-30 min-h-4`} />
      </div>
      {/* Content column */}
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted mb-3">{label}</h2>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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
      if (isDemo) return Promise.resolve({ created: steps.length });
      return api.post(`/projects/${projectId}/tasks/from-memo/${memoId}`, {
        next_steps: steps, priority: 'medium',
      }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Tasks created.');
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

  const completedLines  = memo.completed   ? toLines(memo.completed)   : [];
  const inProgressLines = memo.in_progress ? toLines(memo.in_progress) : [];
  const blockedLines    = memo.blocked     ? toLines(memo.blocked)     : [];
  const nextStepLines   = memo.next_steps  ? toLines(memo.next_steps)  : [];
  const hasTasks        = tasks.length > 0;

  if (editing) {
    return (
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">
        <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Memo
        </button>
        <h1 className="text-2xl font-bold text-ink mb-6">Edit Memo</h1>
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
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

      {/* ── Back + nav ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Memos
        </button>
        <div className="flex items-center gap-2">
          {/* Workflow progress */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'End Session',  done: true },
              { label: 'Create Tasks', done: hasTasks, active: !hasTasks },
              { label: 'Kanban',       done: false },
              { label: 'Catch Me Up',  done: false },
            ].map(({ label, done, active }) => (
              <div key={label} className={
                done   ? 'workflow-step text-ink-faint line-through'
                : active ? 'workflow-step-active'
                : 'workflow-step'
              }>
                <span className={done ? 'workflow-step-dot bg-sticky-green' : active ? 'workflow-step-dot-active' : 'workflow-step-dot'} />
                {label}
              </div>
            ))}
          </div>
          {!isDemo && (
            <button className="btn-ghost text-xs" onClick={() => setEditing(true)}>
              <Edit className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* ── Memo document ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8">

        {/* Left: editorial document */}
        <div>
          {/* ── Document header ─────────────────────────────── */}
          <div className="mb-10 pb-6 border-b-2 border-ink">
            {/* Byline */}
            <div className="flex items-center gap-3 mb-4">
              {memo.author?.avatar_url ? (
                <img src={memo.author.avatar_url} alt={memo.author.display_name}
                  className="w-10 h-10 rounded-full border-2 border-ink flex-shrink-0 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-sticky-blue border-2 border-ink flex items-center justify-center text-ink font-bold text-base flex-shrink-0">
                  {memo.author?.display_name[0]}
                </div>
              )}
              <div>
                <p className="font-bold text-ink text-base leading-tight">{memo.author?.display_name}</p>
                {memo.author?.github_login && (
                  <p className="text-xs font-mono text-ink-faint">@{memo.author.github_login}</p>
                )}
              </div>
              {memo.is_draft && (
                <span className="badge-todo ml-2">Draft</span>
              )}
            </div>

            {/* Date + repo context */}
            <div className="flex items-center gap-3 flex-wrap">
              <time className="text-sm font-mono text-ink-muted">
                {formatDateTime(memo.created_at)}
              </time>
              {memo.github_activities.length > 0 && (() => {
                const branch = memo.github_activities.find((a) => a.branch)?.branch;
                return branch ? (
                  <span className="flex items-center gap-1.5 activity-pill">
                    <GitBranch className="w-3 h-3" />
                    <code className="font-mono text-[11px]">{branch}</code>
                  </span>
                ) : null;
              })()}
              <span className="text-xs text-ink-faint">
                {memo.github_activities.filter((a) => a.activity_type === 'commit').length} commit{memo.github_activities.filter((a) => a.activity_type === 'commit').length !== 1 ? 's' : ''} ·{' '}
                {memo.github_activities.filter((a) => a.activity_type === 'pull_request').length} PR{memo.github_activities.filter((a) => a.activity_type === 'pull_request').length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* ── Five editorial sections ──────────────────────── */}

          <Section
            number="01"
            label="What I finished"
            accent="bg-sticky-green"
            isEmpty={completedLines.length === 0}
          >
            <ul className="space-y-2">
              {completedLines.map((line, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-ink leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-sticky-green flex-shrink-0 mt-0.5" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            number="02"
            label="Where I left off"
            accent="bg-sticky-blue"
            isEmpty={inProgressLines.length === 0 && !memo.in_progress}
          >
            {inProgressLines.length > 1 ? (
              <ul className="space-y-2">
                {inProgressLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-ink leading-relaxed">
                    <ArrowRight className="w-4 h-4 text-sticky-blue flex-shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink leading-relaxed">{memo.in_progress}</p>
            )}
          </Section>

          {memo.blocked && (
            <Section
              number="03"
              label="What's blocking me"
              accent="bg-sticky-pink"
            >
              <div className="bg-sticky-pink/8 border border-sticky-pink/30 rounded-editorial px-4 py-3">
                {blockedLines.length > 1 ? (
                  <ul className="space-y-2">
                    {blockedLines.map((line, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-ink leading-relaxed">
                        <AlertTriangle className="w-4 h-4 text-sticky-pink flex-shrink-0 mt-0.5" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink leading-relaxed flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-sticky-pink flex-shrink-0 mt-0.5" />
                    {memo.blocked}
                  </p>
                )}
              </div>
            </Section>
          )}

          <Section
            number={memo.blocked ? '04' : '03'}
            label="What happens next"
            accent="bg-sticky-yellow"
            isEmpty={nextStepLines.length === 0}
          >
            <ul className="space-y-2 mb-4">
              {nextStepLines.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-ink leading-relaxed">
                  <span className="font-mono text-[11px] text-sticky-yellow font-bold flex-shrink-0 mt-1 w-5 text-right">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </Section>

          {memo.notes && (
            <Section
              number={memo.blocked ? '05' : '04'}
              label="Important context"
              accent="bg-border"
            >
              <div className="bg-paper-dark border border-border rounded-editorial px-4 py-3">
                <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{memo.notes}</p>
              </div>
            </Section>
          )}

          {/* ── GitHub activity receipt ───────────────────────── */}
          {memo.github_activities.length > 0 && (
            <div className="mt-2 pt-6 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-4">
                GitHub activity attached to this session
              </p>
              <ActivityReceipt activities={memo.github_activities} />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* ── CREATE TASKS CTA ─────────────────────────────── */}
          {nextStepLines.length > 0 && !hasTasks && (
            <div className="sticky-green sticky">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink/60 mb-2">
                {nextStepLines.length} next step{nextStepLines.length > 1 ? 's' : ''}
              </p>
              {!convertingTasks ? (
                <button
                  className="btn-create-tasks w-full"
                  onClick={() => { setConvertingTasks(true); setSelectedSteps(nextStepLines); }}
                >
                  <CheckSquare className="w-5 h-5" />
                  Create Tasks
                </button>
              ) : (
                <div>
                  <p className="text-xs text-ink mb-2 font-medium">Select steps to convert:</p>
                  <div className="space-y-1.5 mb-3">
                    {nextStepLines.map((step, i) => (
                      <label key={i} className="flex items-start gap-2 text-xs text-ink cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selectedSteps.includes(step)}
                          onChange={(e) =>
                            setSelectedSteps((prev) =>
                              e.target.checked ? [...prev, step] : prev.filter((s) => s !== step)
                            )
                          }
                          className="mt-0.5 accent-ink flex-shrink-0"
                        />
                        <span className="leading-snug group-hover:text-ink-soft transition-colors">{step}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary text-xs flex-1"
                      onClick={() => createFromNextSteps.mutate(selectedSteps)}
                      disabled={selectedSteps.length === 0 || createFromNextSteps.isPending}
                    >
                      {createFromNextSteps.isPending
                        ? 'Creating…'
                        : `Create ${selectedSteps.length} task${selectedSteps.length > 1 ? 's' : ''}`}
                    </button>
                    <button className="btn-ghost text-xs" onClick={() => setConvertingTasks(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks already created */}
          {hasTasks && (
            <div className="card p-4 border-sticky-green/40 bg-sticky-green/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sticky-green" />
                {tasks.length} task{tasks.length > 1 ? 's' : ''} created
              </p>
              <div className="space-y-2 mb-3">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2">
                    <span className={`${statusBadgeClass(task.status)} flex-shrink-0 mt-0.5`}>
                      {getStatusLabel(task.status)}
                    </span>
                    <span className="text-xs text-ink-soft leading-snug">{task.title}</span>
                  </div>
                ))}
              </div>
              <Link
                to={`/projects/${projectId}/kanban`}
                className="btn-primary w-full text-sm"
              >
                <ArrowRight className="w-4 h-4" />
                View Kanban
              </Link>
            </div>
          )}

          {/* Next actions */}
          <div className="card p-4 border-dashed space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1">Next</p>
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
              Kanban Board
            </Link>
            <Link to={`/projects/${projectId}/catch-me-up`} className="btn-catch-me-up w-full text-sm">
              Catch Me Up
            </Link>
          </div>

          {/* Memo metadata */}
          <div className="card p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">About this memo</p>
            <div className="text-xs text-ink-muted space-y-1">
              <p>Saved {timeAgo(memo.created_at)}</p>
              {memo.updated_at !== memo.created_at && (
                <p>Updated {timeAgo(memo.updated_at)}</p>
              )}
              <p>{memo.github_activities.length} GitHub event{memo.github_activities.length !== 1 ? 's' : ''} attached</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
