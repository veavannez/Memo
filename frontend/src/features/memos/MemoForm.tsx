import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { DEMO_SESSION_CONTEXT, isDemoMode } from '../../lib/demo';
import type { Memo, SessionContext } from '../../types';
import {
  GitCommit, GitPullRequest, GitBranch, FileCode, AlertCircle,
  ExternalLink, ChevronDown, ChevronUp, CheckCircle2, Circle,
  ArrowRight, Clock, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { generateMemoDraft } from '../../lib/watsonx';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MemoFormValues {
  completed: string;
  in_progress: string;
  blocked: string;
  next_steps: string;
  notes: string;
  is_draft: boolean;
}

interface MemoFormProps {
  projectId: string;
  initial?: Memo;
  onSuccess?: (memo: Memo) => void;
  onCancel?: () => void;
  sessionContext?: SessionContext;
}

const empty: MemoFormValues = {
  completed: '',
  in_progress: '',
  blocked: '',
  next_steps: '',
  notes: '',
  is_draft: false,
};

// ─── GitHub context panel ─────────────────────────────────────────────────────
function SessionContextPanel({ ctx }: { ctx: SessionContext }) {
  const [showFiles, setShowFiles] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const totalAdditions = ctx.commits.reduce((s, c) => s + (c.additions ?? 0), 0);
  const totalDeletions = ctx.commits.reduce((s, c) => s + (c.deletions ?? 0), 0);

  return (
    <div className="space-y-3">
      {/* Branch */}
      <div className="flex items-center gap-2 px-3 py-2 bg-paper-dark rounded-editorial border border-border">
        <GitBranch className="w-3.5 h-3.5 text-ink-muted flex-shrink-0" />
        <code className="text-xs font-mono text-ink font-medium">{ctx.branch}</code>
        <span className="text-xs text-ink-faint ml-auto">current branch</span>
      </div>

      {/* Commits */}
      {ctx.commits.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1.5 flex items-center gap-1.5">
            <GitCommit className="w-3 h-3" />
            {ctx.commits.length} commit{ctx.commits.length > 1 ? 's' : ''}
            <span className="ml-auto font-mono text-sticky-green normal-case tracking-normal font-normal">
              +{totalAdditions}
            </span>
            <span className="font-mono text-sticky-pink normal-case tracking-normal font-normal">
              −{totalDeletions}
            </span>
          </p>
          <div className="space-y-1">
            {ctx.commits.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 group py-1 px-2 rounded hover:bg-paper-dark transition-colors"
              >
                <code className="font-mono text-[11px] text-ink-faint flex-shrink-0 mt-0.5 w-14 truncate">
                  {c.github_id?.slice(0, 7)}
                </code>
                <span className="text-xs text-ink-soft leading-snug flex-1 group-hover:text-ink transition-colors">
                  {c.title}
                </span>
                <ExternalLink className="w-3 h-3 text-ink-faint flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* PRs */}
      {ctx.pull_requests.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1.5 flex items-center gap-1.5">
            <GitPullRequest className="w-3 h-3" />
            {ctx.pull_requests.length} pull request{ctx.pull_requests.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {ctx.pull_requests.map((pr) => (
              <a
                key={pr.id}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 group py-1 px-2 rounded hover:bg-paper-dark transition-colors"
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
                    : pr.pr_state === 'open'   ? 'text-sticky-green'
                    : 'text-ink-faint'
                  }`}>
                    {pr.pr_state}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Changed files — collapsed by default */}
      {ctx.changed_files.length > 0 && (
        <div>
          <button
            type="button"
            className="w-full flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-ink transition-colors py-1"
            onClick={() => setShowFiles((v) => !v)}
          >
            <FileCode className="w-3 h-3" />
            {ctx.changed_files.length} changed file{ctx.changed_files.length > 1 ? 's' : ''}
            <span className="ml-auto">
              {showFiles ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </button>
          {showFiles && (
            <div className="mt-1 space-y-0.5">
              {ctx.changed_files.map((f) => (
                <div key={f} className="flex items-center gap-1.5 py-0.5 px-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sticky-orange flex-shrink-0" />
                  <code className="text-[11px] font-mono text-ink-muted">{f}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Open issues */}
      {ctx.open_issues.length > 0 && (
        <div>
          <button
            type="button"
            className="w-full flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-muted hover:text-ink transition-colors py-1"
            onClick={() => setShowIssues((v) => !v)}
          >
            <Circle className="w-3 h-3" />
            {ctx.open_issues.length} open issue{ctx.open_issues.length > 1 ? 's' : ''}
            <span className="ml-auto">
              {showIssues ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </span>
          </button>
          {showIssues && (
            <div className="mt-1 space-y-1">
              {ctx.open_issues.map((issue) => (
                <a
                  key={issue.id}
                  href={issue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 group py-1 px-2 rounded hover:bg-paper-dark transition-colors"
                >
                  <code className="font-mono text-[11px] text-ink-faint flex-shrink-0 mt-0.5">#{issue.number}</code>
                  <span className="text-xs text-ink-soft leading-snug flex-1 group-hover:text-ink transition-colors">
                    {issue.title}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Individual field ──────────────────────────────────────────────────────────
interface FieldProps {
  id: string;
  label: string;
  sublabel: string;
  accent: string;         // Tailwind border-color class
  accentBg: string;       // subtle bg on focus
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  required?: boolean;
  icon: React.ReactNode;
  hint?: string;
}

function MemoField({ id, label, sublabel, accent, accentBg, placeholder, value, onChange, rows = 3, required, icon, hint }: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.max(ref.current.scrollHeight, rows * 24 + 24) + 'px';
    }
  }, [value, rows]);

  return (
    <div className={`border-l-4 ${accent} pl-4 transition-all duration-150`}>
      <div className="flex items-start gap-2 mb-1">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div className="flex-1">
          <label htmlFor={id} className="label mb-0 cursor-pointer">
            {label}
            {required && <span className="text-sticky-pink ml-1 normal-case tracking-normal font-normal text-xs">required</span>}
          </label>
          <p className="text-xs text-ink-faint mt-0.5">{sublabel}</p>
        </div>
      </div>
      <textarea
        ref={ref}
        id={id}
        className={`textarea mt-2 transition-colors duration-150 focus:${accentBg}`}
        style={{ minHeight: rows * 24 + 24, resize: 'none', overflow: 'hidden' }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && value === '' && (
        <p className="text-[11px] text-ink-faint mt-1 italic">{hint}</p>
      )}
    </div>
  );
}

// ─── Main form ─────────────────────────────────────────────────────────────────
export function MemoForm({ projectId, initial, onSuccess, onCancel, sessionContext }: MemoFormProps) {
  const queryClient = useQueryClient();
  const isDemo = isDemoMode();
  const isEdit = !!initial;

  const [values, setValues] = useState<MemoFormValues>(
    initial
      ? {
          completed:   initial.completed   ?? '',
          in_progress: initial.in_progress ?? '',
          blocked:     initial.blocked     ?? '',
          next_steps:  initial.next_steps  ?? '',
          notes:       initial.notes       ?? '',
          is_draft:    initial.is_draft,
        }
      : empty
  );

  const [createTasks, setCreateTasks] = useState(true);

  // Use provided context, or demo context in demo mode, or null
  const ctx: SessionContext | null = sessionContext ?? (isDemo && !isEdit ? DEMO_SESSION_CONTEXT : null);

  const mutation = useMutation({
    mutationFn: (data: MemoFormValues) =>
      isEdit
        ? api.patch(`/projects/${projectId}/memos/${initial!.id}`, data).then((r) => r.data)
        : api.post(`/projects/${projectId}/memos`, data).then((r) => r.data),
    onSuccess: async (memo: Memo, submitted: MemoFormValues) => {
      queryClient.invalidateQueries({ queryKey: ['memos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      if (!isEdit && !submitted.is_draft && createTasks && submitted.next_steps.trim()) {
        const steps = submitted.next_steps.split('\n').map((line) => line.trim().replace(/^[-*\u2022]\s*/, '')).filter(Boolean);
        if (steps.length) await api.post(`/projects/${projectId}/tasks/from-memo/${memo.id}`, { next_steps: steps, priority: 'medium' });
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      }
      toast.success(isEdit ? 'Memo updated' : createTasks && submitted.next_steps.trim() ? 'Handoff saved and next steps added to Todo.' : 'Handoff saved.');
      onSuccess?.(memo);
    },
    onError: () => toast.error('Failed to save memo'),
  });

  const synthesis = useMutation({
    mutationFn: () => generateMemoDraft(projectId, values),
    onSuccess: (draft) => {
      setValues((current) => ({ ...current, completed: current.completed || draft.completed || '', in_progress: current.in_progress || draft.in_progress || '', blocked: current.blocked || draft.blocked || '', next_steps: current.next_steps || draft.next_steps || '', notes: current.notes || draft.notes || '' }));
      toast.success(draft.isFallback ? 'Draft assembled from GitHub evidence.' : 'watsonx.ai draft ready for review.');
    },
    onError: () => toast.error('Could not synthesize the handoff.'),
  });
  const set = (key: keyof MemoFormValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const submit = (draft: boolean) => mutation.mutate({ ...values, is_draft: draft });

  const FIELDS: FieldProps[] = [
    {
      id: 'completed',
      label: 'What did you finish?',
      sublabel: 'Shipped, merged, or marked done this session',
      accent: 'border-sticky-green',
      accentBg: 'bg-sticky-green/5',
      placeholder: '- Fixed token expiry edge case in src/auth/refresh.ts\n- Merged PR #46: race condition in session invalidation\n- Added rate limiting to /auth/login (10 req/min via Redis)',
      value: values.completed,
      onChange: set('completed'),
      rows: 4,
      icon: <CheckCircle2 className="w-4 h-4 text-sticky-green" />,
      hint: 'Be specific — list what actually shipped, not what you started.',
    },
    {
      id: 'in_progress',
      label: 'What are you working on?',
      sublabel: 'What is actively in progress right now',
      accent: 'border-sticky-blue',
      accentBg: 'bg-sticky-blue/5',
      placeholder: 'Connecting the frontend to the new /auth/refresh endpoint. The token format changed in PR #46 — consumers now receive { accessToken, refreshToken, expiresAt } instead of a bare JWT. Auth interceptor at src/lib/api.ts needs updating.',
      value: values.in_progress,
      onChange: set('in_progress'),
      rows: 3,
      icon: <ArrowRight className="w-4 h-4 text-sticky-blue" />,
      hint: 'Include the specific file or function you were editing.',
    },
    {
      id: 'blocked',
      label: 'What is blocking you?',
      sublabel: 'Blockers, unknowns, or things you need from someone else',
      accent: 'border-sticky-pink',
      accentBg: 'bg-sticky-pink/5',
      placeholder: '- Waiting on DevOps to provision Redis instance in staging (no ETA)\n- Integration tests failing — need to update test fixtures for new token format before CI unblocks',
      value: values.blocked,
      onChange: set('blocked'),
      rows: 3,
      icon: <AlertCircle className="w-4 h-4 text-sticky-pink" />,
      hint: 'Leave blank if nothing is blocking you.',
    },
    {
      id: 'next_steps',
      label: 'What should happen next?',
      sublabel: 'One action per line — each becomes a task',
      accent: 'border-sticky-yellow',
      accentBg: 'bg-sticky-yellow/10',
      placeholder: 'Connect frontend to new /auth/refresh endpoint\nFix integration test fixtures for new token format\nNotify mobile team about token format deprecation (deadline: April 1)\nDeploy Google OAuth2 to staging once Redis is provisioned',
      value: values.next_steps,
      onChange: set('next_steps'),
      rows: 5,
      icon: <Clock className="w-4 h-4 text-sticky-yellow" style={{ filter: 'drop-shadow(0 0 0 #0F0F0F)' }} />,
      hint: 'These will convert directly into Kanban tasks.',
    },
    {
      id: 'notes',
      label: 'Important context',
      sublabel: 'Things another developer must know to continue safely',
      accent: 'border-border',
      accentBg: 'bg-paper-dark/40',
      placeholder: 'The old token format (bare JWT) still works via X-Legacy-Auth header until April 1 — the compatibility shim is in src/auth/compat.ts. After that date it is removed. Notify any teams still on the old format.',
      value: values.notes,
      onChange: set('notes'),
      rows: 3,
      icon: <FileCode className="w-4 h-4 text-ink-muted" />,
      hint: 'Assume the reader has context. Write what they would miss without this.',
    },
  ];

  return (
    <div>
      {/* ── Two-column layout on large screens ──────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-0 xl:gap-8">

        {/* Left: GitHub context panel */}
        {ctx && (
          <div className="hidden xl:block">
            <div className="sticky top-20">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-3">
                This session
              </p>
              <SessionContextPanel ctx={ctx} />
            </div>
          </div>
        )}

        {/* Right: form fields */}
        <div className="space-y-6">
          {/* Mobile: collapsible GitHub context */}
          {ctx && (
            <details className="xl:hidden">
              <summary className="flex items-center gap-2 text-sm font-semibold text-ink cursor-pointer list-none select-none py-2 border-b border-border">
                <GitCommit className="w-4 h-4 text-ink-muted" />
                <span>
                  {ctx.commits.length} commit{ctx.commits.length > 1 ? 's' : ''} · {ctx.pull_requests.length} PR{ctx.pull_requests.length > 1 ? 's' : ''} · <code className="font-mono text-xs">{ctx.branch}</code>
                </span>
                <ChevronDown className="w-4 h-4 text-ink-faint ml-auto" />
              </summary>
              <div className="pt-3 pb-1">
                <SessionContextPanel ctx={ctx} />
              </div>
            </details>
          )}

          {/* Five writing fields */}
          {FIELDS.map((field) => (
            <MemoField key={field.id} {...field} />
          ))}

          {!isEdit && <div className="rounded-card border border-sticky-lavender bg-sticky-lavender/10 p-4 flex items-center justify-between gap-4 flex-wrap">
            <div><p className="text-sm font-bold">Synthesize handoff with watsonx.ai</p><p className="text-xs text-ink-muted mt-0.5">Uses GitHub evidence and current tasks. Anything you typed stays unchanged.</p></div>
            <button type="button" className="btn-secondary text-sm" onClick={() => synthesis.mutate()} disabled={synthesis.isPending}><Sparkles className="w-4 h-4" />{synthesis.isPending ? 'Assembling…' : 'Generate summary'}</button>
          </div>}

          {!isEdit && <label className="flex items-start gap-3 rounded-card border border-border p-3 cursor-pointer"><input type="checkbox" className="mt-1" checked={createTasks} onChange={(e) => setCreateTasks(e.target.checked)} /><span><span className="text-sm font-semibold block">Create Todo tasks from next steps</span><span className="text-xs text-ink-muted">Each non-empty line becomes a task linked back to this handoff.</span></span></label>}
          {/* ── Submit ────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-2 border-t-2 border-ink/10 flex-wrap">
            <button
              type="button"
              className="btn-end-session"
              onClick={() => submit(false)}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Saving...' : isEdit ? 'Update Memo' : "I'm Done for Today"}
            </button>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => submit(true)}
              disabled={mutation.isPending}
            >
              Save draft
            </button>
            {onCancel && (
              <button type="button" className="btn-ghost text-sm ml-auto" onClick={onCancel}>
                Discard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
