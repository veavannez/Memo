import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';
import { BrowserFrame, StickyNote } from '../components/ui';
import { ArrowRight } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000';

// ── Mini mock UI for the browser frame preview ──────────────
function DashboardPreview() {
  return (
    <div className="bg-paper p-4 font-sans text-xs" style={{ minHeight: 320 }}>
      {/* mini top bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <span className="font-display font-bold text-ink text-sm tracking-tight">my-startup / api</span>
        <div className="flex gap-1.5">
          <span className="badge-in-progress">In Progress</span>
        </div>
      </div>

      {/* team row */}
      <p className="section-heading mb-2">Team</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { name: 'Alex', color: 'bg-sticky-blue',   status: 'Auth refactor', blocked: false },
          { name: 'Sam',  color: 'bg-sticky-yellow', status: 'DB migrations', blocked: true },
        ].map((m) => (
          <div key={m.name} className="card p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={`w-6 h-6 rounded-full ${m.color} border border-border flex items-center justify-center text-[10px] font-bold text-ink`}>
                {m.name[0]}
              </div>
              <span className="font-semibold font-display text-ink">{m.name}</span>
              {m.blocked && <span className="badge-blocked ml-auto">Blocked</span>}
            </div>
            <p className="text-ink-muted leading-snug">{m.status}</p>
          </div>
        ))}
      </div>

      {/* catch me up strip */}
      <div className="sticky-yellow rounded-editorial px-3 py-2 flex items-center gap-2">
        <span className="text-base">⚡</span>
        <div>
          <p className="font-bold font-display text-ink text-[11px]">Catch Me Up</p>
          <p className="text-ink-soft text-[10px]">3 memos since you were last here</p>
        </div>
      </div>

      {/* recent memos */}
      <p className="section-heading mt-4 mb-2">Recent Memos</p>
      <div className="space-y-1.5">
        {[
          { author: 'Alex', time: '2h ago',   text: 'Finished OAuth middleware, wiring refresh tokens next' },
          { author: 'Jordan', time: '5h ago', text: 'Blocked on Postgres connection pooling config' },
        ].map((m) => (
          <div key={m.author} className="card p-2.5 flex items-start gap-2">
            <div className="w-5 h-5 rounded-full bg-sticky-lavender border border-border flex items-center justify-center text-[9px] font-bold text-ink flex-shrink-0">
              {m.author[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-semibold font-display text-ink">{m.author}</span>
                <span className="font-mono text-ink-faint" style={{ fontSize: 9 }}>{m.time}</span>
              </div>
              <p className="text-ink-soft leading-snug truncate">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) navigate('/projects');
  }, [isAuthenticated, navigate]);

  const handleGitHubLogin = async () => {
    try {
      const res = await api.get('/auth/github/login');
      window.location.href = res.data.auth_url;
    } catch {
      window.location.href = `${BACKEND_URL}/api/v1/auth/github/login`;
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">

      {/* ── NAV ───────────────────────────────────────────── */}
      <nav className="border-b-2 border-ink bg-paper-cream sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-14">
          <span className="font-display text-ink" style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
            MEMO
          </span>
          <div className="flex items-center gap-3">
            <Link to="/demo" className="btn-ghost text-sm">
              Demo
            </Link>
            <button onClick={handleGitHubLogin} className="btn-primary text-sm">
              Sign in with GitHub
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 items-start">

          {/* Left: editorial headline + CTAs */}
          <div>
            {/* Eyebrow tag */}
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="sticky-yellow text-[11px] font-bold uppercase tracking-widest font-display px-2 py-1 rounded-editorial">
                IBM watsonx Hackathon
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-display-2xl text-ink mb-0 leading-none">
              Save your<br />
              <span className="underline-yellow">work.</span>
            </h1>
            <h1 className="text-display-2xl text-ink mb-6 leading-none">
              Share the<br />
              <span className="underline-yellow">context.</span>
            </h1>

            <p className="text-base text-ink-soft max-w-md mb-2 leading-relaxed">
              GitHub tells the team <em>what</em> changed.
              MEMO tells them <strong>what it means</strong> — where you left off,
              what's blocking you, and what happens next.
            </p>
            <p className="text-sm text-ink-muted max-w-sm mb-8 leading-relaxed">
              End every session with a memo. Start the next one knowing exactly what's happening.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleGitHubLogin} className="btn-accent text-base px-6 py-3">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Get started free
              </button>
              <Link to="/demo" className="btn-secondary text-base px-6 py-3">
                See it in action <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Social proof strip */}
            <div className="flex items-center gap-4 mt-8 pt-6 border-t border-border">
              <div className="flex -space-x-2">
                {['A','S','J','M','R'].map((l, i) => (
                  <div key={i} className={`w-7 h-7 rounded-full border-2 border-paper-cream flex items-center justify-center text-[10px] font-bold text-ink ${['bg-sticky-blue','bg-sticky-yellow','bg-sticky-green','bg-sticky-lavender','bg-sticky-orange'][i]}`}>
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-muted font-display">
                Built for dev teams that ship fast
              </p>
            </div>
          </div>

          {/* Right: browser frame preview + floating stickies */}
          <div className="relative hidden lg:block">
            {/* Floating sticky notes — editorial layering */}
            <div className="absolute -top-6 -right-4 z-10 rotate-2">
              <StickyNote color="yellow" label="Today's focus">
                Finish auth flow,<br />review Sam's PR
              </StickyNote>
            </div>
            <div className="absolute -bottom-8 -left-6 z-10 -rotate-1">
              <StickyNote color="pink" label="Blocked">
                Waiting on API keys<br />from DevOps
              </StickyNote>
            </div>

            {/* Browser frame with app preview */}
            <div className="mt-8">
              <BrowserFrame url="memo.app/projects/42">
                <DashboardPreview />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ── RULE ──────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 w-full">
        <div className="border-t-2 border-ink" />
      </div>

      {/* ── HOW IT WORKS — 3 column editorial ─────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 w-full">
        <div className="flex items-end justify-between mb-10">
          <h2 className="text-display-lg text-ink">How it works</h2>
          <span className="font-mono text-xs text-ink-faint">3 steps</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-ink rounded-editorial overflow-hidden">
          {[
            {
              num: '01',
              title: 'End your session with a Memo',
              desc: 'Completed, in-progress, blocked, next steps — structured context your team can actually use.',
              color: 'bg-paper-cream',
              sticky: { color: 'blue' as const, text: 'Linked to your GitHub commits automatically' },
            },
            {
              num: '02',
              title: 'Team stays in sync',
              desc: 'Dashboard shows exactly what everyone is working on. No standups required.',
              color: 'bg-paper',
              sticky: { color: 'green' as const, text: 'Blocked tasks surface to the top' },
            },
            {
              num: '03',
              title: 'Catch Me Up when you return',
              desc: 'AI-powered briefing tells you exactly what happened while you were gone.',
              color: 'bg-paper-cream',
              sticky: { color: 'lavender' as const, text: 'Powered by IBM watsonx' },
            },
          ].map((step, i) => (
            <div
              key={step.num}
              className={`${step.color} p-7 ${i < 2 ? 'border-r-2 border-ink' : ''} flex flex-col gap-4`}
            >
              <span className="font-display font-bold text-ink-faint text-4xl leading-none" style={{ letterSpacing: '-0.03em' }}>
                {step.num}
              </span>
              <h3 className="text-display-md text-ink">{step.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed flex-1">{step.desc}</p>
              <StickyNote color={step.sticky.color} className="text-xs">
                {step.sticky.text}
              </StickyNote>
            </div>
          ))}
        </div>
      </section>

      {/* ── RULE ──────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 w-full">
        <div className="border-t-2 border-dashed border-border" />
      </div>

      {/* ── FEATURES — ASYMMETRIC GRID ─────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 w-full">
        <h2 className="text-display-lg text-ink mb-10">Everything your team needs</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Large feature card */}
          <div className="card-editorial p-6 md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="sticky-yellow px-2 py-1 text-xs font-bold font-display rounded-editorial">Core</span>
              <h3 className="text-display-md text-ink">Structured Memos</h3>
            </div>
            <p className="text-sm text-ink-soft leading-relaxed max-w-md">
              Every memo captures what you completed, what's in progress, what's blocking you, and what's next. Automatically linked to your GitHub commits and PRs.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {['Completed work', 'In progress', 'Blocked', 'Next steps'].map((item, i) => (
                <div key={item} className={`sticky ${['sticky-green','sticky-blue','sticky-pink','sticky-yellow'][i]} text-xs font-semibold font-display`}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Catch Me Up card */}
          <div className="card-editorial p-6 flex flex-col gap-3">
            <span className="sticky-lavender px-2 py-1 text-xs font-bold font-display rounded-editorial w-fit">AI</span>
            <h3 className="text-display-md text-ink">Catch Me Up</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              Return to a project and instantly know what happened, who's blocked, and where to start.
            </p>
            <div className="mt-auto pt-3 border-t border-border">
              <p className="text-xs font-mono text-ink-faint">Powered by IBM watsonx.ai</p>
            </div>
          </div>

          {/* Kanban card */}
          <div className="card p-6 border border-border flex flex-col gap-3">
            <h3 className="text-display-md text-ink">Kanban Board</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              Tasks flow from memo next-steps into a kanban. One click converts your plan into trackable work.
            </p>
          </div>

          {/* GitHub card */}
          <div className="card p-6 border border-border flex flex-col gap-3">
            <h3 className="text-display-md text-ink">GitHub Native</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              Sign in with GitHub. Commits and PRs auto-attach to your memos. Zero extra configuration.
            </p>
          </div>

          {/* Team dashboard card */}
          <div className="card p-6 border border-border flex flex-col gap-3">
            <h3 className="text-display-md text-ink">Team Dashboard</h3>
            <p className="text-sm text-ink-soft leading-relaxed">
              See what every team member is doing, what's blocking them, and what they finished last session.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA BAND ──────────────────────────────────────── */}
      <section className="border-t-2 border-b-2 border-ink bg-ink">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-display-xl text-paper-cream mb-2">
              Ready to ship<br />with context?
            </h2>
            <p className="text-sm text-paper-dark max-w-sm">
              Free during the IBM watsonx Hackathon. Sign in with GitHub and create your first memo in under 2 minutes.
            </p>
          </div>
          <div className="flex flex-col gap-3 flex-shrink-0">
            <button onClick={handleGitHubLogin} className="btn-accent text-base px-8 py-3.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Start with GitHub
            </button>
            <Link to="/demo" className="text-center text-sm text-paper-dark hover:text-paper-cream underline-offset-2 hover:underline font-display">
              See the demo first →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="max-w-6xl mx-auto px-5 sm:px-8 py-8 w-full">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-ink" style={{ letterSpacing: '-0.02em' }}>MEMO</span>
          <p className="text-xs font-mono text-ink-faint">
            Built for IBM watsonx Hackathon · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
