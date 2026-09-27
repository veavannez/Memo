/**
 * Project Intelligence Page — watsonx.ai-powered project state analysis.
 *
 * Displays:
 *  - Project state: completed / in-progress / blocked (with evidence)
 *  - Detected gaps (possible missing work)
 *  - Suggested next steps
 *
 * Every AI conclusion shows:
 *  - A confidence badge (HIGH / MEDIUM / LOW)
 *  - Supporting evidence the user can inspect
 *  - Hedged language ("MEMO detected…", "MEMO suggests…")
 *
 * Falls back gracefully when watsonx.ai is unavailable.
 */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Brain, CheckCircle, Circle, AlertTriangle, ChevronDown, ChevronUp,
  Sparkles, Search, ArrowRight, Info, Zap, RefreshCw, AlertCircle, Pencil, X, Plus,
} from 'lucide-react';
import type { EvidencedItem, DetectedGap, SuggestedNextStep, GapTaskSuggestion, ProjectMember, Task, ProjectRefreshResponse, AutomationMode } from '../types';
import {
  getIntelligenceStatus,
  confidenceBadge,
  formatModelId,
  editDetectedGap,
  dismissDetectedGap,
  createTaskFromGap,
  getGapTaskSuggestion,
  refreshProjectIntelligence, setAutomationMode, approveTaskUpdate, dismissTaskUpdate,
} from '../lib/watsonx';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { DEMO_PROJECT_ANALYSIS, isDemoMode } from '../lib/demo';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidencePill({ score }: { score: number }) {
  const { label, color } = confidenceBadge(score);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${color}`}>
      {label}
    </span>
  );
}

function EvidenceList({ evidence }: { evidence: string[] }) {
  const [open, setOpen] = useState(false);
  if (!evidence.length) return null;
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition-colors"
      >
        <Info className="w-3 h-3" />
        {open ? 'Hide evidence' : `View evidence (${evidence.length})`}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <ul className="mt-1 pl-3 border-l border-border space-y-0.5">
          {evidence.map((e, i) => (
            <li key={i} className="text-[11px] font-mono text-ink-muted leading-snug">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StateItem({ item, icon }: { item: EvidencedItem; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-border last:border-0">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-sm text-ink flex-1">{item.title}</p>
          <ConfidencePill score={item.confidence} />
        </div>
        {item.reason && (
          <p className="text-xs text-ink-muted mt-0.5 leading-snug">{item.reason}</p>
        )}
        <EvidenceList evidence={item.evidence} />
      </div>
    </div>
  );
}

function GapCard({
  gap, projectId, demo, onRemove, onUpdate,
}: {
  gap: DetectedGap;
  projectId: string;
  demo: boolean;
  onRemove: (id?: number) => void;
  onUpdate: (gap: DetectedGap) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [suggestion, setSuggestion] = useState<GapTaskSuggestion | null>(null);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [title, setTitle] = useState(gap.title);
  const [description, setDescription] = useState(gap.description);
  const [category, setCategory] = useState(gap.category);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'blocked' | 'done'>('todo');
  const [selectedOwner, setSelectedOwner] = useState('');
  const canAct = demo || gap.id !== undefined;

  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ['project-members', projectId],
    queryFn: () => demo ? Promise.resolve([]) : api.get(`/projects/${projectId}/members`).then((r) => r.data),
    enabled: reviewing && !demo,
  });

  const save = async () => {
    try {
      const updated = demo ? { ...gap, title, description, category }
        : await editDetectedGap(projectId, gap.id!, { title, description, category });
      onUpdate(updated); setEditing(false); toast.success('Gap updated');
    } catch { toast.error('Could not update gap'); }
  };

  const dismiss = async () => {
    try {
      if (!demo) await dismissDetectedGap(projectId, gap.id!);
      onRemove(gap.id); toast.success('Gap dismissed');
    } catch { toast.error('Could not dismiss gap'); }
  };

  const openReview = async () => {
    setReviewing(true);
    try {
      const draft = demo ? {
        title, description, priority: 'medium', status: 'todo', repository: 'Demo repository',
        evidence: gap.evidence, assignment_reason: 'Demo suggestion based on related repository activity.',
        assignment_confidence: gap.confidence,
      } as GapTaskSuggestion : await getGapTaskSuggestion(projectId, gap.id!);
      setSuggestion(draft); setTitle(draft.title); setDescription(draft.description);
      setPriority(draft.priority); setStatus(draft.status);
      setSelectedOwner(draft.suggested_owner_id ? String(draft.suggested_owner_id) : '');
    } catch { setReviewing(false); toast.error('Could not prepare task suggestion'); }
  };

  const createTask = async () => {
    try {
      const task = demo ? ({ id: 0 } as Task) : await createTaskFromGap(projectId, gap.id!, {
        title, description, priority, status,
        assignment_reason: suggestion?.assignment_reason,
        assignment_confidence: suggestion?.assignment_confidence,
      });
      setCreatedTask(task);
      toast.success('Task created in Kanban');
    } catch { toast.error('Could not create task'); }
  };

  const assignTask = async () => {
    if (!createdTask || !selectedOwner) return;
    try {
      if (!demo) await api.patch(`/projects/${projectId}/tasks/${createdTask.id}`, { assignee_id: Number(selectedOwner) });
      toast.success('Task assigned'); setReviewing(false); onRemove(gap.id);
    } catch { toast.error('Could not assign task'); }
  };

  return (
    <>
      <article className="rounded-card border-2 border-sticky-orange/70 bg-paper-cream shadow-editorial-sm overflow-hidden">
        <div className="bg-sticky-orange/20 border-b border-sticky-orange/40 px-4 py-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-black tracking-[0.16em] text-ink">DETECTED GAP</span>
          <span className="text-[10px] font-bold rounded-pill border border-ink/20 bg-paper-cream px-2 py-0.5">{category}</span>
        </div>
        <div className="p-4">
          {editing ? <div className="space-y-3">
            <input className="input text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="textarea text-sm min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
            <select className="select text-sm" value={category} onChange={(e) => setCategory(e.target.value as DetectedGap['category'])}>{['TESTING','IMPLEMENTATION','INTEGRATION','DOCUMENTATION','ERROR HANDLING','SECURITY','UI','BACKEND','FRONTEND','DEPLOYMENT'].map((item) => <option key={item}>{item}</option>)}</select>
            <div className="flex gap-2"><button className="btn-primary text-xs" onClick={save}>Save</button><button className="btn-ghost text-xs" onClick={() => setEditing(false)}>Cancel</button></div>
          </div> : <>
            <div className="flex items-start gap-2 mb-3"><AlertCircle className="w-5 h-5 text-sticky-orange flex-shrink-0 mt-0.5" /><div><h3 className="text-base font-bold text-ink">{gap.title}</h3><p className="text-[10px] font-bold text-ink-faint mt-2">MEMO NOTICED</p><p className="text-xs text-ink-muted mt-0.5">{gap.description}</p><p className="text-xs text-ink-faint mt-2 italic">{gap.reason}</p></div></div>
            <div className="flex items-center gap-2 py-2 border-y border-border mb-2"><span className="text-[10px] font-bold text-ink-faint">CONFIDENCE</span><ConfidencePill score={gap.confidence} /><span className="text-[10px] text-ink-faint ml-auto">Suggestion, not fact</span></div>
            <EvidenceList evidence={gap.evidence} />
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2"><button disabled={!canAct} className="btn-primary text-xs" onClick={openReview}><Plus className="w-3 h-3" />Review task</button><button className="btn-secondary text-xs" onClick={() => setEditing(true)}><Pencil className="w-3 h-3" />Edit</button><button className="btn-ghost text-xs" onClick={dismiss}><X className="w-3 h-3" />Dismiss</button></div>
          </>}
        </div>
      </article>

      {reviewing && (
        <div className="fixed inset-0 z-[100] bg-ink/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && setReviewing(false)}>
          <div className="bg-paper border-2 border-ink rounded-card shadow-memo-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-5"><div><p className="text-[10px] font-black tracking-[0.16em] text-sticky-orange">SUGGESTED TASK · REVIEW BEFORE CREATING</p><h2 className="text-xl font-bold mt-1">Turn this gap into work</h2></div><button className="btn-ghost" onClick={() => setReviewing(false)}><X className="w-4 h-4" /></button></div>
            {!suggestion ? <div className="py-12 text-center"><div className="spinner mx-auto" /></div> : <div className="space-y-4">
              <div><label className="label">Task</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!!createdTask} /></div>
              <div><label className="label">Description</label><textarea className="textarea min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!!createdTask} /></div>
              <div className="grid sm:grid-cols-2 gap-4"><div><p className="label">Repository</p><p className="text-sm font-mono">{suggestion.repository}</p></div><div><p className="label">Related PR</p><p className="text-sm">{suggestion.related_pr || 'No related PR identified'}</p></div></div>
              <div><p className="label">Evidence</p><ul className="space-y-1">{suggestion.evidence.map((item) => <li key={item} className="text-xs font-mono text-ink-muted">• {item}</li>)}</ul></div>
              <div className="grid sm:grid-cols-2 gap-4"><div><label className="label">Priority</label><select className="select" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} disabled={!!createdTask}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div><label className="label">Status</label><select className="select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} disabled={!!createdTask}><option value="todo">Todo</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select></div></div>
              <div className="rounded-card bg-sticky-lavender/20 border border-sticky-lavender p-4"><div className="flex items-center gap-2"><p className="font-bold text-sm">Suggested owner: {suggestion.suggested_owner_name || 'No supported suggestion'}</p><ConfidencePill score={suggestion.assignment_confidence} /></div><p className="text-xs text-ink-muted mt-2">{suggestion.assignment_reason}</p></div>
              {createdTask && <div><label className="label">Choose owner</label><select className="select" value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)}><option value="">Unassigned</option>{members.map((member) => { const user = member.user; return user ? <option key={member.user_id} value={member.user_id}>{user.display_name}{user.github_login ? ` (@${user.github_login})` : ''}</option> : null; })}</select></div>}
              <div className="flex justify-end gap-2 pt-3 border-t border-border">{!createdTask ? <><button className="btn-ghost" onClick={() => setReviewing(false)}>Cancel</button><button className="btn-primary" onClick={createTask}>Create task</button></> : <><button className="btn-secondary" onClick={() => { setReviewing(false); onRemove(gap.id); }}>Leave unassigned</button><button className="btn-primary" disabled={!selectedOwner} onClick={assignTask}>Assign</button></>}</div>
            </div>}
          </div>
        </div>
      )}
    </>
  );
}
function NextStepCard({ step }: { step: SuggestedNextStep }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-card bg-paper-dark border border-border">
      <ArrowRight className="w-4 h-4 text-sticky-blue flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-ink">{step.title}</p>
          <ConfidencePill score={step.confidence} />
        </div>
        <p className="text-xs text-ink-muted mt-0.5 leading-snug">{step.description}</p>
        <EvidenceList evidence={step.evidence} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectIntelligencePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const demo = isDemoMode();
  const [hiddenGapIds, setHiddenGapIds] = useState<Set<number>>(new Set());
  const [editedGaps, setEditedGaps] = useState<Map<number, DetectedGap>>(new Map());
  const [mode, setMode] = useState<AutomationMode>('suggest');

  const { data: status } = useQuery({
    queryKey: ['intelligence-status', projectId],
    queryFn: () => demo
      ? Promise.resolve({ available: true, model_id: DEMO_PROJECT_ANALYSIS.modelId, project_id_set: true, api_key_set: true })
      : getIntelligenceStatus(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const {
    data: analysis,
    isPending,
    error,
    mutate: runAnalysis,
  } = useMutation<ProjectRefreshResponse, Error>({
    mutationFn: () => demo ? Promise.resolve({ analysis: DEMO_PROJECT_ANALYSIS, changes: [], taskProposals: [], automationMode: mode, refreshedAt: new Date().toISOString(), baselineCreated: true }) : refreshProjectIntelligence(projectId!),
    onSuccess: (result) => setMode(result.automationMode),
  });

  const refresh = analysis;
  const report = refresh?.analysis;
  const hasResults = !!report;
  const ps = report?.projectState;
  const activeGaps = (report?.detectedGaps ?? [])
    .filter((gap) => gap.id === undefined || !hiddenGapIds.has(gap.id))
    .map((gap) => gap.id !== undefined ? (editedGaps.get(gap.id) ?? gap) : gap);

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-sticky-lavender border-2 border-ink flex items-center justify-center shadow-editorial">
            <Brain className="w-6 h-6 text-ink" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink leading-tight">Project Intelligence</h1>
            <p className="text-sm text-ink-muted">
              AI-powered analysis of your project state, gaps, and next steps.
            </p>
          </div>
        </div>

        {/* Status pill */}
        {status && (
          <div className="flex items-center gap-2 mt-3">
            {status.available ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                watsonx.ai connected · {formatModelId(status.model_id)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                AI unavailable — showing GitHub evidence only
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Disclaimer banner ───────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div><p className="text-xs font-bold text-ink">Automation mode</p><p className="text-xs text-ink-muted">Suggest is the safe default. Task status changes always require approval.</p></div>
        <select className="select w-auto" value={mode} onChange={async (e) => { const next = e.target.value as AutomationMode; const previous = mode; setMode(next); if (!demo) { try { await setAutomationMode(projectId!, next); toast.success(`Automation mode: ${next}`); } catch { setMode(previous); toast.error('Could not update automation mode. Please try again.'); } } }}>
          <option value="observe">Observe</option><option value="suggest">Suggest</option><option value="autopilot">Autopilot</option>
        </select>
      </div>
      <div className="mb-6 flex items-start gap-2.5 bg-sticky-yellow/20 border border-sticky-yellow/40 rounded-card px-4 py-3">
        <Sparkles className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" />
        <p className="text-xs text-ink-soft leading-snug">
          MEMO Intelligence interprets GitHub evidence to surface project state and potential gaps.
          Conclusions are suggestions — not facts. Every item shows its confidence level and
          supporting evidence. Review carefully before acting.
        </p>
      </div>

      {/* ── CTA ─────────────────────────────────────────────── */}
      {!hasResults && !isPending && (
        <div className="card-editorial p-8 text-center mb-8">
          <Brain className="w-10 h-10 text-ink-faint mx-auto mb-4" />
          <h2 className="text-lg font-bold text-ink mb-2">Update This Project</h2>
          <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">
            MEMO will collect GitHub evidence — commits, PRs, issues, branches — and use
            {status?.available ? ' watsonx.ai' : ' built-in heuristics'} to understand
            the current state of development.
          </p>
          <button
            className="btn-primary"
            onClick={() => runAnalysis()}
          >
            <Search className="w-4 h-4" />
            Update Project
          </button>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────── */}
      {isPending && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-12 h-12 rounded-full bg-sticky-lavender border-2 border-ink flex items-center justify-center">
            <Brain className="w-6 h-6 text-ink animate-pulse" />
          </div>
          <p className="text-sm text-ink-muted">
            Fetching new GitHub activity and updating intelligence…
          </p>
          <p className="text-xs text-ink-faint">This may take up to 30 seconds.</p>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────── */}
      {error && !isPending && (
        <div className="card p-6 text-center mb-6">
          <AlertTriangle className="w-8 h-8 text-sticky-pink mx-auto mb-3" />
          <p className="text-sm text-ink-muted mb-4">Analysis failed. MEMO can still show you GitHub context.</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-primary" onClick={() => runAnalysis()}>
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
            <Link to={`/projects/${projectId}/context`} className="btn-secondary">
              View GitHub Context
            </Link>
          </div>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {hasResults && (
        <>
          {/* Meta bar */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              {report.isFallback ? (
                <span className="text-yellow-600">⚡ Fallback analysis (no AI)</span>
              ) : (
                <span className="text-green-600">✦ Generated by {formatModelId(report.modelId)}</span>
              )}
              <span>·</span>
              <span>{new Date(report.generatedAt).toLocaleTimeString()}</span>
            </div>
            <button
              className="btn-ghost text-xs"
              onClick={() => runAnalysis()}
              disabled={isPending}
            >
              <RefreshCw className="w-3 h-3" /> Update Project
            </button>
          </div>

          {refresh && (
            <div className="card p-5 mb-6">
              <p className="section-heading mb-3">Since your last update</p>
              {refresh.baselineCreated ? <p className="text-sm text-ink-muted">Baseline saved. Future updates will show only meaningful changes.</p> : refresh.changes.length ? <div className="space-y-3">{refresh.changes.map((change, index) => <div key={`${change.kind}-${index}`} className="flex gap-3"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"/><div><p className="text-sm font-semibold">{change.title}</p><p className="text-xs text-ink-muted">{change.description}</p>{change.evidence.length > 0 && <p className="text-[11px] font-mono text-ink-faint mt-1">{change.evidence.join(' · ')}</p>}</div></div>)}</div> : <p className="text-sm text-ink-muted">No meaningful GitHub changes detected.</p>}
            </div>
          )}
          {refresh?.taskProposals.map((proposal) => <div key={proposal.id} className="card border-sticky-yellow p-5 mb-4"><p className="text-[10px] font-black tracking-widest text-sticky-orange">TASK MAY BE COMPLETE</p><h3 className="font-bold mt-1">{proposal.task_title}</h3><p className="text-sm text-ink-muted mt-2">{proposal.reason}</p><EvidenceList evidence={proposal.evidence}/><div className="flex gap-2 mt-4"><button className="btn-primary text-xs" onClick={async () => { await approveTaskUpdate(projectId!, proposal.id); toast.success('Task marked done'); runAnalysis(); }}>Mark done</button><button className="btn-ghost text-xs" onClick={async () => { await dismissTaskUpdate(projectId!, proposal.id); toast.success('Suggestion dismissed'); runAnalysis(); }}>Dismiss</button></div></div>)}
          {/* Project state grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

            {/* Completed */}
            <div className="card p-4">
              <p className="section-heading flex items-center gap-1.5 mb-3">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                Completed
                <span className="ml-auto text-xs font-normal text-ink-faint">
                  {ps?.completed.length ?? 0}
                </span>
              </p>
              {ps?.completed.length ? (
                ps.completed.map((item, i) => (
                  <StateItem
                    key={i}
                    item={item}
                    icon={<CheckCircle className="w-4 h-4 text-green-400" />}
                  />
                ))
              ) : (
                <p className="text-xs text-ink-faint">No completed items detected.</p>
              )}
            </div>

            {/* In Progress */}
            <div className="card p-4">
              <p className="section-heading flex items-center gap-1.5 mb-3">
                <Circle className="w-3.5 h-3.5 text-sticky-blue" />
                In Progress
                <span className="ml-auto text-xs font-normal text-ink-faint">
                  {ps?.inProgress.length ?? 0}
                </span>
              </p>
              {ps?.inProgress.length ? (
                ps.inProgress.map((item, i) => (
                  <StateItem
                    key={i}
                    item={item}
                    icon={<Circle className="w-4 h-4 text-sticky-blue" />}
                  />
                ))
              ) : (
                <p className="text-xs text-ink-faint">No active work detected.</p>
              )}
            </div>

            {/* Blocked */}
            <div className="card p-4">
              <p className="section-heading flex items-center gap-1.5 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-sticky-pink" />
                Blocked
                <span className="ml-auto text-xs font-normal text-ink-faint">
                  {ps?.blocked.length ?? 0}
                </span>
              </p>
              {ps?.blocked.length ? (
                ps.blocked.map((item, i) => (
                  <StateItem
                    key={i}
                    item={item}
                    icon={<AlertTriangle className="w-4 h-4 text-sticky-pink" />}
                  />
                ))
              ) : (
                <p className="text-xs text-ink-faint">No blocked work detected.</p>
              )}
            </div>
          </div>

          {/* Detected Gaps */}
          {activeGaps.length > 0 && (
            <div className="mb-8">
              <h2 className="text-base font-bold text-ink mb-1 flex items-center gap-2">
                <Search className="w-4 h-4 text-sticky-orange" />
                Possible Missing Work
                <span className="text-sm font-normal text-ink-faint">
                  ({activeGaps.length} detected)
                </span>
              </h2>
              <p className="text-xs text-ink-muted mb-4">
                MEMO detected these potential gaps. Each has supporting evidence — review
                before deciding whether to act.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeGaps.map((gap, i) => (
                  <GapCard
                    key={gap.id ?? i}
                    gap={gap}
                    projectId={projectId!}
                    demo={demo}
                    onRemove={(id) => id !== undefined && setHiddenGapIds((current) => new Set(current).add(id))}
                    onUpdate={(updated) => updated.id !== undefined && setEditedGaps((current) => new Map(current).set(updated.id!, updated))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Suggested Next Steps */}
          {report.suggestedNextSteps.length > 0 && (
            <div className="mb-8">
              <h2 className="text-base font-bold text-ink mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-sticky-yellow" />
                Suggested Next Steps
              </h2>
              <p className="text-xs text-ink-muted mb-4">
                MEMO suggests these actions based on the current project state.
              </p>
              <div className="space-y-3">
                {report.suggestedNextSteps.map((step, i) => (
                  <NextStepCard key={i} step={step} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!ps?.completed.length && !ps?.inProgress.length && !ps?.blocked.length
           && !activeGaps.length && !report.suggestedNextSteps.length && (
            <div className="card p-8 text-center mb-8">
              <p className="text-sm text-ink-muted">
                MEMO could not detect any project state from the available evidence.
                Try connecting a GitHub repository with recent activity.
              </p>
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to={`/projects/${projectId}/memos/new`} className="btn-end-session">
              End Session
            </Link>
            <Link to={`/projects/${projectId}/catch-me-up`} className="btn-secondary">
              <Zap className="w-4 h-4" />
              Catch Me Up
            </Link>
            <Link to={`/projects/${projectId}/context`} className="btn-ghost">
              View GitHub Context
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
