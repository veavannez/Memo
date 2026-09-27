import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_CATCH_ME_UP, isDemoMode } from '../lib/demo';
import type { BriefingEvidence, BriefingItem, CatchMeUp, TeamBriefing } from '../types';
import { AlertTriangle, ArrowRight, CheckCircle, ChevronDown, ChevronUp, ExternalLink, FileCode2, GitCommit, GitPullRequest, ListTodo, MessageSquareText, Sparkles, UserRound, Zap } from 'lucide-react';

function EvidenceIcon({ type }: { type: string }) {
  if (type === 'commit') return <GitCommit className="w-3.5 h-3.5" />;
  if (type === 'pull_request') return <GitPullRequest className="w-3.5 h-3.5" />;
  if (type === 'task') return <ListTodo className="w-3.5 h-3.5" />;
  if (type === 'memo') return <MessageSquareText className="w-3.5 h-3.5" />;
  return <FileCode2 className="w-3.5 h-3.5" />;
}

function EvidenceDrawer({ evidence }: { evidence: BriefingEvidence[] }) {
  const [open, setOpen] = useState(false);
  if (!evidence.length) return null;
  return <div className="mt-2">
    <button className="text-[11px] font-bold uppercase tracking-wider text-ink-muted hover:text-ink flex items-center gap-1" onClick={() => setOpen(!open)}>
      {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} View evidence
    </button>
    {open && <div className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
      {evidence.map((item, index) => {
        const content = <><EvidenceIcon type={item.type} /><span className="font-mono break-all">{item.label}</span>{item.url && <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0" />}</>;
        return item.url ? (item.url.startsWith('/') ? <Link key={index} to={item.url} className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink">{content}</Link> : <a key={index} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink">{content}</a>) : <div key={index} className="flex items-center gap-2 text-xs text-ink-muted">{content}</div>;
      })}
    </div>}
  </div>;
}

function ChangeRow({ item }: { item: BriefingItem }) {
  const icon = item.tone === 'warning' ? <AlertTriangle className="w-4 h-4 text-sticky-orange" /> : item.tone === 'positive' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <ArrowRight className="w-4 h-4 text-sticky-blue" />;
  return <div className="py-3 border-b border-border last:border-0 flex gap-3">
    <span className="mt-0.5 flex-shrink-0">{icon}</span><div className="min-w-0"><p className="text-sm font-semibold text-ink">{item.title}</p>{item.detail && <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{item.detail}</p>}<EvidenceDrawer evidence={item.evidence} /></div>
  </div>;
}

function TeamRow({ member }: { member: TeamBriefing }) {
  return <div className="py-3 border-b border-border last:border-0 flex gap-3"><div className="w-9 h-9 rounded-full bg-sticky-blue/30 border border-ink/20 flex items-center justify-center flex-shrink-0"><UserRound className="w-4 h-4" /></div><div><p className="text-sm font-bold">{member.name}</p><p className="text-xs text-ink-muted mt-0.5">{member.summary}</p><EvidenceDrawer evidence={member.evidence} /></div></div>;
}

export default function CatchMeUpPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const demo = isDemoMode();
  const { data, isLoading, error, refetch } = useQuery<CatchMeUp>({ queryKey: ['catch-me-up', projectId], queryFn: () => demo ? Promise.resolve(DEMO_CATCH_ME_UP) : api.get(`/projects/${projectId}/catch-me-up`).then(r => r.data), enabled: !!projectId });

  if (isLoading) return <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4"><div className="w-12 h-12 rounded-full bg-sticky-orange border-2 border-ink flex items-center justify-center"><Sparkles className="w-5 h-5 animate-pulse" /></div><div className="text-center"><p className="font-semibold">Assembling your briefing</p><p className="text-xs text-ink-muted mt-1">Comparing project activity and your previous context…</p></div></div>;
  if (error || !data) return <div className="max-w-xl mx-auto py-16 text-center"><p className="text-sm text-ink-muted mb-4">MEMO could not assemble the briefing.</p><button className="btn-primary" onClick={() => refetch()}>Try again</button></div>;

  const changes = data.what_changed ?? [];
  const team = data.team_activity ?? [];
  const attention = data.attention_items ?? [];
  const next = data.next_step;

  return <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">
    <header className="mb-8 memo-reveal" style={{ animationDelay: '0ms' }}><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-full bg-sticky-orange border-2 border-ink flex items-center justify-center shadow-editorial"><Zap className="w-6 h-6" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-sticky-orange">Developer continuity briefing</p><h1 className="text-3xl font-black uppercase tracking-tight">Catch Me Up</h1><p className="text-sm text-ink-muted">Here's what changed while you were away.</p></div></div></header>

    <section className="card-editorial p-6 mb-6 memo-reveal" style={{ animationDelay: '80ms' }}><p className="section-heading mb-2">While you were away</p><p className="text-xl sm:text-2xl font-bold leading-tight">{data.briefing_summary ?? data.summary_lines[0] ?? 'Your project context is ready.'}</p>{data.compared_from && <p className="text-xs text-ink-faint mt-2">Compared with the project snapshot from {new Date(data.compared_from).toLocaleString()}.</p>}</section>

    <div className="grid lg:grid-cols-2 gap-5 mb-6">
      <section className="card p-5 memo-reveal" style={{ animationDelay: '160ms' }}><p className="section-heading mb-1">What changed</p>{changes.length ? changes.map((item, m) => <ChangeRow item={item} key={m} />) : <p className="text-sm text-ink-muted py-4">No meaningful changes were detected since the comparison snapshot.</p>}</section>
      <section className="card p-5 memo-reveal" style={{ animationDelay: '240ms' }}><p className="section-heading mb-1">Your team</p>{team.length ? team.map((member, m) => <TeamRow member={member} key={`${member.name}-${m}`} />) : <p className="text-sm text-ink-muted py-4">No new contributor activity was detected.</p>}</section>
    </div>

    <section className="card p-5 mb-6 memo-reveal" style={{ animationDelay: '320ms' }}><p className="section-heading flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-sticky-orange" /> What needs attention</p>{attention.length ? attention.map((item, m) => <ChangeRow item={item} key={m} />) : <p className="text-sm text-ink-muted py-4">Nothing urgent was identified from the available evidence.</p>}</section>

    {next && <section className="bg-sticky-yellow/25 border-2 border-ink rounded-card shadow-editorial p-6 mb-7 memo-reveal" style={{ animationDelay: '400ms' }}><p className="section-heading mb-2">Your next step</p><h2 className="text-xl font-bold">{next.title}</h2>{next.detail && <p className="text-sm text-ink-muted mt-2 max-w-2xl">{next.detail}</p>}<EvidenceDrawer evidence={next.evidence} /></section>}

    <div className="flex flex-wrap gap-3 memo-reveal" style={{ animationDelay: '480ms' }}><Link to={`/projects/${projectId}`} className="btn-primary">View Project <ArrowRight className="w-4 h-4" /></Link><Link to={`/projects/${projectId}/intelligence`} className="btn-secondary">Update Intelligence</Link><Link to={`/projects/${projectId}/kanban`} className="btn-ghost">View Kanban</Link></div>
  </div>;
}