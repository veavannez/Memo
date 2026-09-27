import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_CATCH_ME_UP, isDemoMode } from '../lib/demo';
import type { CatchMeUp } from '../types';
import { timeAgo, statusBadgeClass, getStatusLabel } from '../lib/utils';
import {
  GitCommit, GitPullRequest, AlertTriangle, ArrowRight, Clock,
  FileText, CheckSquare, Zap, Plus, ChevronDown, ChevronUp,
} from 'lucide-react';

export default function CatchMeUpPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [showGitHub, setShowGitHub] = useState(false);
  const isDemo = isDemoMode();

  const { data, isLoading, error, refetch } = useQuery<CatchMeUp>({
    queryKey: ['catch-me-up', projectId],
    queryFn: () => {
      if (isDemo) return Promise.resolve(DEMO_CATCH_ME_UP);
      return api.get(`/projects/${projectId}/catch-me-up`).then((r) => r.data);
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full bg-sticky-orange border-2 border-ink flex items-center justify-center">
          <Zap className="w-6 h-6 text-ink animate-pulse" />
        </div>
        <p className="text-sm text-ink-muted">Catching you up…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8">
        <div className="card-editorial p-8 text-center">
          <p className="text-ink-muted text-sm mb-4">Failed to generate briefing.</p>
          <button className="btn-primary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  const commits = data.recent_github_activity.filter((a) => a.activity_type === 'commit');
  const prs     = data.recent_github_activity.filter((a) => a.activity_type === 'pull_request');

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

      {/* ── Hero header ────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-sticky-orange border-2 border-ink flex items-center justify-center shadow-editorial">
            <Zap className="w-6 h-6 text-ink" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink leading-tight">Catch Me Up</h1>
            <p className="text-sm text-ink-muted">Here's everything that happened since your last session.</p>
          </div>
        </div>

        {/* Workflow progress */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {[
            { label: 'End Session',  color: 'bg-sticky-yellow', done: true  },
            { label: 'Create Tasks', color: 'bg-sticky-green',  done: true  },
            { label: 'Kanban',       color: 'bg-sticky-blue',   done: false },
            { label: 'Catch Me Up',  color: 'bg-sticky-orange', active: true },
          ].map(({ label, color, done, active }) => (
            <div key={label} className={done ? 'workflow-step text-ink-faint line-through' : active ? 'workflow-step-active' : 'workflow-step'}>
              <span className={done ? 'workflow-step-dot bg-sticky-green' : active ? 'workflow-step-dot-active' : 'workflow-step-dot'} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary card — the most important element ─────── */}
      <div className="sticky-orange sticky mb-7">
        <p className="font-bold text-xs uppercase tracking-widest text-ink/60 mb-3">Summary</p>
        <ul className="space-y-1.5">
          {data.summary_lines.map((line, i) => (
            <li key={i} className={`text-sm text-ink leading-snug ${i === 0 ? 'font-semibold' : ''}`}>
              {i === 0 ? `📍 ${line}` : `• ${line}`}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Body grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">

        {/* Last session memo */}
        {data.last_session_memo && (
          <div className="card p-5">
            <p className="section-heading flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Your Last Memo
            </p>
            <p className="text-xs text-ink-faint mb-3 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(data.last_session_memo.created_at)}
            </p>
            {data.last_session_memo.in_progress && (
              <div className="mb-3">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-wide mb-1">Was working on</p>
                <p className="text-sm text-ink leading-snug">{data.last_session_memo.in_progress}</p>
              </div>
            )}
            {data.last_session_memo.blocked && (
              <div className="mb-3 bg-sticky-pink/10 px-3 py-2 rounded-editorial border border-sticky-pink/30">
                <p className="text-xs font-bold text-sticky-pink mb-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Was blocked on
                </p>
                <p className="text-sm text-ink leading-snug">{data.last_session_memo.blocked}</p>
              </div>
            )}
            <Link
              to={`/projects/${projectId}/memos/${data.last_session_memo.id}`}
              className="text-xs font-medium text-ink-muted hover:text-ink transition-colors flex items-center gap-1 mt-2"
            >
              View full memo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Your tasks */}
        <div className="card p-5">
          <p className="section-heading flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" /> Your Tasks
          </p>
          {data.my_open_tasks.length === 0 ? (
            <p className="text-sm text-ink-faint">No open tasks. 🎉</p>
          ) : (
            <div className="space-y-2">
              {data.my_open_tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink flex-1 truncate">{task.title}</span>
                  <span className={`${statusBadgeClass(task.status)} flex-shrink-0`}>
                    {getStatusLabel(task.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {data.my_blocked_tasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-bold text-sticky-pink mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {data.my_blocked_tasks.length} blocked
              </p>
              {data.my_blocked_tasks.map((task) => (
                <p key={task.id} className="text-sm text-ink-soft mb-1 leading-snug">{task.title}</p>
              ))}
            </div>
          )}
        </div>

        {/* Team memos since last session */}
        {data.team_memos_since_last.length > 0 && (
          <div className="card p-5">
            <p className="section-heading">Team activity since your last session</p>
            <div className="space-y-4">
              {data.team_memos_since_last.map((memo) => (
                <div key={memo.id} className="border-l-2 border-sticky-blue pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    {memo.author?.avatar_url ? (
                      <img src={memo.author.avatar_url} className="w-5 h-5 rounded-full" alt="" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-sticky-blue flex items-center justify-center text-[9px] font-bold text-ink">
                        {memo.author?.display_name[0]}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-ink">{memo.author?.display_name}</span>
                    <span className="text-xs text-ink-faint">{timeAgo(memo.created_at)}</span>
                  </div>
                  {memo.in_progress && (
                    <p className="text-sm text-ink-soft line-clamp-2 mb-1 leading-snug">{memo.in_progress}</p>
                  )}
                  {memo.blocked && (
                    <p className="text-xs text-sticky-pink flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3" /> {memo.blocked}
                    </p>
                  )}
                  <Link
                    to={`/projects/${projectId}/memos/${memo.id}`}
                    className="text-xs font-medium text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
                  >
                    Read memo <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested next steps */}
        {data.suggested_next_steps.length > 0 && (
          <div className="card p-5">
            <p className="section-heading">Suggested next steps</p>
            <ul className="space-y-2.5">
              {data.suggested_next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-soft leading-snug">
                  <span className="text-sticky-yellow flex-shrink-0 mt-0.5 font-bold">→</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* GitHub activity — collapsed by default */}
      {data.recent_github_activity.length > 0 && (
        <div className="card mb-8">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-ink-muted hover:text-ink transition-colors"
            onClick={() => setShowGitHub((v) => !v)}
          >
            <span className="flex items-center gap-2 font-semibold">
              <GitCommit className="w-4 h-4" />
              Recent GitHub Activity
              <span className="text-xs font-mono text-ink-faint">({data.recent_github_activity.length})</span>
            </span>
            {showGitHub ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showGitHub && (
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-1.5">
              {commits.slice(0, 8).map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink transition-colors"
                >
                  <GitCommit className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" />
                  <code className="font-mono text-ink-faint">{c.github_id?.slice(0, 7)}</code>
                  <span className="truncate">{c.title}</span>
                </a>
              ))}
              {prs.slice(0, 4).map((pr) => (
                <a
                  key={pr.id}
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink transition-colors"
                >
                  <GitPullRequest className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" />
                  <code className="font-mono text-ink-faint">#{pr.github_id}</code>
                  <span className="truncate">{pr.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom CTAs ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Link to={`/projects/${projectId}/memos/new`} className="btn-end-session">
          <Plus className="w-5 h-5" />
          End Session
        </Link>
        <Link to={`/projects/${projectId}/kanban`} className="btn-secondary">
          View Kanban
        </Link>
        <Link to={`/projects/${projectId}`} className="btn-ghost">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
