import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, GitCommit, GitPullRequest, ChevronRight,
  FileText, CheckSquare, ArrowRight, Plus, Zap, LayoutDashboard,
  Kanban,
} from 'lucide-react';

// ─── Shared demo data ────────────────────────────────────────────────────────

const TEAM = [
  {
    initials: 'JD', name: 'Jane Doe', handle: '@janedoe', color: 'bg-blue-100 text-blue-700',
    role: 'owner', task: 'Refresh token rotation logic', openTasks: 3,
    memo: { ago: '2h ago', body: 'Implementing JWT refresh — 80% done, blocked on DB schema sign-off', blocked: 'Waiting on DB migration approval — PR #42 open since Monday' },
  },
  {
    initials: 'MK', name: 'Mike Kim', handle: '@mikekim', color: 'bg-green-100 text-green-700',
    role: 'member', task: 'OAuth2 PKCE flow implementation', openTasks: 2,
    memo: { ago: '5h ago', body: 'PKCE code verifier working in local tests', blocked: null },
  },
  {
    initials: 'SL', name: 'Sara Lin', handle: '@saralin', color: 'bg-purple-100 text-purple-700',
    role: 'member', task: 'Rate limiting middleware tests', openTasks: 1,
    memo: { ago: '1d ago', body: 'All unit tests passing, writing integration tests', blocked: null },
  },
  {
    initials: 'RP', name: 'Raj Patel', handle: '@rajpatel', color: 'bg-orange-100 text-orange-700',
    role: 'member', task: 'CI pipeline for auth-service', openTasks: 4,
    memo: { ago: '3h ago', body: "Pipeline almost done — token refresh test flaky", blocked: 'Token refresh race condition — needs pair review' },
  },
];

const TASKS = [
  { id: 1, title: 'Wire up token blacklist table', status: 'in_progress', priority: 'high', assignee: TEAM[0], ago: '2h ago', fromMemo: true },
  { id: 2, title: 'Merge DB migration PR #42', status: 'blocked', priority: 'high', assignee: TEAM[3], ago: '1d ago', fromMemo: false },
  { id: 3, title: 'PKCE code verifier — integration test', status: 'in_progress', priority: 'medium', assignee: TEAM[1], ago: '5h ago', fromMemo: false },
  { id: 4, title: 'Rate limiting middleware — integration tests', status: 'in_progress', priority: 'medium', assignee: TEAM[2], ago: '1d ago', fromMemo: false },
  { id: 5, title: 'Open refresh token PR', status: 'todo', priority: 'high', assignee: TEAM[0], ago: '2h ago', fromMemo: true },
  { id: 6, title: 'Token refresh race condition fix', status: 'blocked', priority: 'high', assignee: TEAM[3], ago: '3h ago', fromMemo: false },
  { id: 7, title: 'Update README with auth flow diagrams', status: 'todo', priority: 'low', assignee: null, ago: '3d ago', fromMemo: false },
];

const DONE_TASKS = [
  { id: 8, title: 'RSA-256 token signing', assignee: TEAM[0] },
  { id: 9, title: 'Token validation unit tests', assignee: TEAM[0] },
  { id: 10, title: 'CI pipeline setup', assignee: TEAM[3] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Avatar({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    todo: 'badge-todo', in_progress: 'badge-in-progress', blocked: 'badge-blocked', done: 'badge-done',
  };
  const labels: Record<string, string> = {
    todo: 'To Do', in_progress: 'In Progress', blocked: 'Blocked', done: 'Done',
  };
  return <span className={`badge ${map[status] ?? 'badge-todo'}`}>{labels[status] ?? status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = { high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
  return <span className={`badge ${map[priority] ?? 'badge-low'} capitalize`}>{priority}</span>;
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function ScreenDashboard({ onNav }: { onNav: (s: string) => void }) {
  const blocked = TASKS.filter(t => t.status === 'blocked');
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Auth Service</h2>
          <p className="text-xs text-gray-400 font-mono">acme-corp/auth-service</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNav('catchmeup')} className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Catch Me Up
          </button>
          <button onClick={() => onNav('create-memo')} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Create Memo
          </button>
        </div>
      </div>

      {blocked.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-5 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">{blocked.length} blocked tasks</p>
            <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
              {blocked.map(t => <li key={t.id}>{t.title}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Team</p>
          <div className="grid grid-cols-2 gap-3">
            {TEAM.map(m => (
              <div key={m.name} className="card p-4">
                <div className="flex items-start gap-2 mb-2">
                  <Avatar initials={m.initials} color={m.color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{m.name}</span>
                      {m.role === 'owner' && <span className="badge bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5">Owner</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono">{m.handle}</p>
                  </div>
                  {m.memo.blocked && (
                    <span className="flex items-center gap-0.5 text-[11px] text-yellow-600 font-medium flex-shrink-0">
                      <AlertTriangle className="w-3 h-3" /> blocked
                    </span>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-[11px] text-gray-400 mb-0.5">Currently working on</p>
                  <p className="text-xs text-gray-700 font-medium truncate">{m.task}</p>
                </div>
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <div className="flex justify-between mb-0.5">
                    <p className="text-[11px] text-gray-400">Last Memo</p>
                    <p className="text-[11px] text-gray-400">{m.memo.ago}</p>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{m.memo.body}</p>
                  {m.memo.blocked && (
                    <p className="text-[11px] text-yellow-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />{m.memo.blocked}
                    </p>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">{m.openTasks} open tasks</span>
                  <button onClick={() => onNav('memo-detail')} className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5">
                    View memo <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recent Memos</p>
            <button onClick={() => onNav('memo-detail')} className="text-[11px] text-blue-600 hover:underline">View all</button>
          </div>
          {TEAM.slice(0, 3).map(m => (
            <button key={m.name} onClick={() => onNav('memo-detail')} className="card p-3 w-full text-left hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-2 mb-1.5">
                <Avatar initials={m.initials} color={m.color} size="sm" />
                <span className="text-xs font-medium text-gray-900">{m.name}</span>
                <span className="text-[11px] text-gray-400 ml-auto">{m.memo.ago}</span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{m.memo.body}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenMemoDetail({ onNav }: { onNav: (s: string) => void }) {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <p className="text-xs text-gray-400 mb-3">
        <button onClick={() => onNav('dashboard')} className="hover:text-gray-600">← Dashboard</button>
      </p>
      <div className="flex items-center gap-3 mb-5">
        <Avatar initials="JD" color="bg-blue-100 text-blue-700" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Jane Doe</p>
          <p className="text-xs text-gray-400">2 hours ago · Auth Service</p>
        </div>
        <span className="badge badge-in-progress ml-auto">In Draft</span>
      </div>
      {[
        { icon: '✅', label: 'Completed', body: 'Finished access token generation with RSA-256 signing. Wrote unit tests for token validation — all passing. Updated OpenAPI spec for /auth/token.' },
        { icon: '🔄', label: 'In Progress', body: 'Implementing JWT refresh token rotation. Core logic ~80% done — rotation works but haven\'t wired up the token blacklist yet.' },
      ].map(s => (
        <div key={s.label} className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{s.icon} {s.label}</p>
          <p className="text-sm text-gray-700 leading-relaxed">{s.body}</p>
        </div>
      ))}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">⛔ Blocked</p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
          Waiting on DB migration approval from Raj before I can finalize the token_blacklist table. PR #42 has been open since Monday.
        </div>
      </div>
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">➡️ Next Steps</p>
        <p className="text-sm text-gray-700 leading-relaxed">Once PR #42 merges: wire up blacklist, run integration tests, open refresh token PR. Sync with Mike on token sharing between PKCE and standard flows.</p>
      </div>
      <div className="border-t border-gray-100 pt-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">GitHub Activity Linked</p>
        {[
          { icon: <GitCommit className="w-3.5 h-3.5" />, id: 'a3f9c12', msg: 'feat: add RSA-256 token signing' },
          { icon: <GitCommit className="w-3.5 h-3.5" />, id: 'b81e4a0', msg: 'test: token validation unit tests' },
          { icon: <GitPullRequest className="w-3.5 h-3.5" />, id: 'PR #41', msg: 'feat: JWT refresh token rotation (draft)' },
        ].map(a => (
          <div key={a.id} className="flex items-center gap-2 text-xs text-gray-500 py-1">
            <span className="text-gray-400">{a.icon}</span>
            <code className="text-gray-400 font-mono">{a.id}</code>
            <span>{a.msg}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tasks from this Memo</p>
        <div className="space-y-2">
          {[
            { s: 'in_progress', t: 'Wire up token blacklist table' },
            { s: 'blocked', t: 'Merge DB migration PR #42' },
            { s: 'todo', t: 'Open refresh token PR' },
          ].map(item => (
            <div key={item.t} className="flex items-center gap-2">
              <StatusBadge status={item.s} />
              <span className="text-sm text-gray-700">{item.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenCreateMemo({ onNav }: { onNav: (s: string) => void }) {
  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-1">New Memo</h2>
      <p className="text-sm text-gray-500 mb-5">Capture your session — what you did, where you are, and what's next.</p>
      <div className="card p-4 mb-5 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 mb-2">🔗 GitHub Activity (auto-detected)</p>
        <div className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
          <GitCommit className="w-3.5 h-3.5 text-gray-400" /><code className="text-gray-400">d44e81f</code><span>fix: token expiry edge case on renewal</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
          <GitCommit className="w-3.5 h-3.5 text-gray-400" /><code className="text-gray-400">f9a2b30</code><span>test: add expiry boundary tests</span>
        </div>
        <p className="text-[11px] text-gray-400 italic mt-1">2 commits since your last memo</p>
      </div>
      {[
        { label: '✅ What did you complete?', value: 'Fixed token expiry edge case — boundary tests all passing now.' },
        { label: '🔄 What are you working on?', value: 'Starting on the refresh token blacklist integration.' },
        { label: '⛔ Blocked on anything?', value: '' },
        { label: '➡️ Next steps', value: 'Finish blacklist wiring, then open the refresh token PR.' },
      ].map(f => (
        <div key={f.label} className="mb-4">
          <label className="label">{f.label}</label>
          <textarea
            className="textarea"
            rows={2}
            defaultValue={f.value}
            placeholder={f.value ? undefined : 'Leave blank if nothing is blocking you…'}
          />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onNav('memo-detail')} className="btn-primary">Publish Memo</button>
        <button className="btn-secondary">Save Draft</button>
        <button onClick={() => onNav('dashboard')} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

function ScreenTasks({ onNav }: { onNav: (s: string) => void }) {
  const [filter, setFilter] = useState('');
  const shown = filter ? TASKS.filter(t => t.status === filter) : TASKS;
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-500">{TASKS.length} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNav('kanban')} className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1.5">
            <Kanban className="w-3.5 h-3.5" /> Kanban
          </button>
          <button className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'todo', 'in_progress', 'blocked', 'done'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
          >
            {s === '' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div className="card divide-y divide-gray-100">
        {shown.map(task => (
          <div key={task.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{task.title}</span>
                {task.fromMemo && <span className="text-[11px] text-gray-400">from memo</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {task.assignee && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Avatar initials={task.assignee.initials} color={task.assignee.color} size="sm" />
                    {task.assignee.name}
                  </span>
                )}
                <span className="text-[11px] text-gray-300">·</span>
                <span className="text-[11px] text-gray-400">{task.ago}</span>
              </div>
            </div>
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenKanban({ onNav }: { onNav: (s: string) => void }) {
  const cols: { key: string; label: string; cls: string; badgeCls: string }[] = [
    { key: 'todo', label: 'To Do', cls: 'bg-gray-50', badgeCls: 'bg-gray-200 text-gray-600' },
    { key: 'in_progress', label: 'In Progress', cls: 'bg-blue-50', badgeCls: 'bg-blue-100 text-blue-700' },
    { key: 'blocked', label: '⚠️ Blocked', cls: 'bg-yellow-50', badgeCls: 'bg-yellow-100 text-yellow-800' },
    { key: 'done', label: 'Done', cls: 'bg-green-50', badgeCls: 'bg-green-100 text-green-700' },
  ];
  const byStatus = (s: string) => s === 'done' ? DONE_TASKS.map(t => ({ ...t, status: 'done', priority: 'low', ago: '', fromMemo: false })) : TASKS.filter(t => t.status === s);
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Kanban Board</h2>
          <p className="text-sm text-gray-500">Auth Service</p>
        </div>
        <button className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Task
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {cols.map(col => {
          const tasks = byStatus(col.key);
          return (
            <div key={col.key} className={`${col.cls} rounded-lg p-3`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{col.label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.badgeCls}`}>{tasks.length}</span>
              </div>
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className={`bg-white border border-gray-200 rounded-md p-2.5 ${col.key === 'done' ? 'opacity-60' : ''}`}>
                    <p className="text-xs font-medium text-gray-900 mb-2 leading-snug">{task.title}</p>
                    <div className="flex items-center justify-between">
                      {(task as any).assignee ? (
                        <Avatar initials={(task as any).assignee.initials} color={(task as any).assignee.color} size="sm" />
                      ) : <span className="text-[10px] text-gray-300">Unassigned</span>}
                      {'priority' in task && task.priority !== 'low' && <PriorityBadge priority={(task as any).priority} />}
                      {col.key === 'done' && <span className="badge badge-done text-[10px]">Done</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScreenCatchMeUp({ onNav }: { onNav: (s: string) => void }) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2"><Zap className="w-5 h-5" /> Catch Me Up</h2>
      <p className="text-sm text-gray-500 mb-4">Here's what's been happening since you were last active</p>
      <div className="card p-4 mb-5 bg-gray-50 border-gray-200">
        <ul className="space-y-1">
          <li className="text-sm font-semibold text-gray-900">Back after 3 days — here's what you missed on Auth Service.</li>
          <li className="text-sm text-gray-700">Mike merged PKCE support while you were out — PR #44 is in main.</li>
          <li className="text-sm text-gray-700">Raj is still blocked on the token refresh race condition — needs your review.</li>
          <li className="text-sm text-gray-700">Sara finished rate-limiting integration tests; all green.</li>
          <li className="text-sm text-gray-700">Your DB migration PR #42 was approved and merged yesterday.</li>
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Your Last Memo
          </h3>
          <p className="text-[11px] text-gray-400 mb-2">3 days ago</p>
          <p className="text-xs font-medium text-gray-500 mb-0.5">Was working on</p>
          <p className="text-sm text-gray-700 mb-3">Implementing JWT refresh token rotation (~80% done)</p>
          <p className="text-xs font-medium text-yellow-600 mb-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Was blocked</p>
          <p className="text-sm text-yellow-700 mb-3">Waiting on DB migration approval</p>
          <button onClick={() => onNav('memo-detail')} className="text-xs text-blue-600 hover:underline">View full memo →</button>
        </div>
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" /> Your Tasks
          </h3>
          <div className="space-y-2">
            {[
              { t: 'Wire up token blacklist table', s: 'in_progress' },
              { t: 'Open refresh token PR', s: 'todo' },
            ].map(item => (
              <div key={item.t} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-700 flex-1">{item.t}</span>
                <StatusBadge status={item.s} />
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-green-600">✅ No blocked tasks — DB migration unblocked!</p>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Team Activity Since Your Last Session</h3>
          {[
            { m: TEAM[1], ago: '2d ago', body: 'PKCE integration tests done — merged PR #44.' },
            { m: TEAM[3], ago: '1d ago', body: 'Race condition still open — needs pair review on the mutex approach.' },
            { m: TEAM[2], ago: '1d ago', body: 'Rate limiting integration suite: all 42 tests green ✅' },
          ].map(item => (
            <div key={item.m.name} className="border-l-2 border-gray-100 pl-3 mb-3">
              <div className="flex items-center gap-1.5">
                <Avatar initials={item.m.initials} color={item.m.color} size="sm" />
                <span className="text-xs font-medium text-gray-700">{item.m.name}</span>
                <span className="text-[11px] text-gray-400">{item.ago}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">💡 Suggested Next Steps</h3>
          <div className="space-y-2">
            {[
              'Pick up where you left off: wire the blacklist into the refresh flow',
              "Review Raj's mutex approach on the race condition (PR #46)",
              'Open the refresh token PR — DB migration is now unblocked',
              'Sync with Mike on token sharing between PKCE and standard flows',
            ].map(step => (
              <div key={step} className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button onClick={() => onNav('create-memo')} className="btn-primary">Create Memo / Start Session</button>
        <button onClick={() => onNav('kanban')} className="btn-secondary">View Kanban</button>
      </div>
    </div>
  );
}

// ─── Nav bar ─────────────────────────────────────────────────────────────────

const SCREENS = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { key: 'memo-detail', label: 'Memo', icon: <FileText className="w-3.5 h-3.5" /> },
  { key: 'create-memo', label: 'Create Memo', icon: <Plus className="w-3.5 h-3.5" /> },
  { key: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { key: 'kanban', label: 'Kanban', icon: <Kanban className="w-3.5 h-3.5" /> },
  { key: 'catchmeup', label: 'Catch Me Up', icon: <Zap className="w-3.5 h-3.5" /> },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [active, setActive] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-bold text-lg tracking-tight text-gray-900">MEMO</Link>
          <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2.5 py-0.5 rounded-full">Live Demo</span>
        </div>
        <Link to="/" className="btn-primary text-sm px-4 py-1.5">
          Sign in with GitHub
        </Link>
      </div>

      {/* Fake browser chrome */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-6 gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">See MEMO in action</h1>
          <p className="text-sm text-gray-500">Click through the screens below to explore the full workflow.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Fake browser bar */}
          <div className="bg-gray-100 px-4 py-2.5 flex items-center gap-3 border-b border-gray-200">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white rounded text-xs text-gray-400 px-3 py-1 font-mono">
              localhost:5173{active === 'dashboard' ? '/projects/1' : active === 'memo-detail' ? '/projects/1/memos/7' : active === 'create-memo' ? '/projects/1/memos/new' : active === 'catchmeup' ? '/projects/1/catch-me-up' : `/projects/1/${active}`}
            </div>
          </div>

          {/* Fake app nav */}
          <div className="bg-white border-b border-gray-100 px-5 flex items-center gap-0 h-11">
            <span className="font-bold text-base text-gray-900 mr-5">MEMO</span>
            {SCREENS.map(s => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`flex items-center gap-1.5 text-xs px-3 h-full border-b-2 transition-colors ${active === s.key ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                {s.icon}{s.label}
              </button>
            ))}
            <div className="ml-auto">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">JD</div>
            </div>
          </div>

          {/* Screen content */}
          <div className="min-h-[540px] overflow-y-auto">
            {active === 'dashboard' && <ScreenDashboard onNav={setActive} />}
            {active === 'memo-detail' && <ScreenMemoDetail onNav={setActive} />}
            {active === 'create-memo' && <ScreenCreateMemo onNav={setActive} />}
            {active === 'tasks' && <ScreenTasks onNav={setActive} />}
            {active === 'kanban' && <ScreenKanban onNav={setActive} />}
            {active === 'catchmeup' && <ScreenCatchMeUp onNav={setActive} />}
          </div>
        </div>

        <div className="text-center">
          <Link to="/" className="btn-primary text-base px-6 py-2.5">
            Get started with GitHub →
          </Link>
        </div>
      </div>
    </div>
  );
}
