import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../features/auth/AuthContext';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000';
const GH_ICON = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

// ── Scroll reveal hook ───────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); }),
      { threshold: 0.12 }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ── Cursor glow ──────────────────────────────────────────
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.left = e.clientX + 'px';
        ref.current.style.top  = e.clientY + 'px';
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-0"
      style={{
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,230,66,0.13) 0%, transparent 70%)',
        transform: 'translate(-50%,-50%)',
        transition: 'left 0.12s ease, top 0.12s ease',
      }}
    />
  );
}

// ── Animated counter ─────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const step = () => {
        start += Math.ceil(to / 40);
        if (start >= to) { setVal(to); return; }
        setVal(start);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to]);
  return <span ref={ref}>{val}{suffix}</span>;
}

// ── Mini app preview inside browser frame ───────────────
function AppPreview() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3200);
    return () => clearInterval(id);
  }, []);
  const memos = [
    { author: 'Alex K.', color: 'bg-sticky-blue',   time: '2m ago',  text: 'Wired refresh tokens, OAuth flow done ✓' },
    { author: 'Sam R.',  color: 'bg-sticky-yellow',  time: '1h ago',  text: 'Blocked on Postgres pool config — need help' },
    { author: 'Jordan',  color: 'bg-sticky-lavender', time: '3h ago', text: 'PR #42 open — auth middleware ready for review' },
  ];
  const active = tick % memos.length;
  return (
    <div className="bg-paper min-h-[340px] text-xs font-sans p-4">
      {/* mini nav */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-ink">
        <span className="font-display font-bold text-ink text-sm" style={{ letterSpacing: '-0.02em' }}>MEMO</span>
        <div className="flex items-center gap-2">
          <span className="badge-in-progress">Live</span>
          <div className="pulse-dot" />
        </div>
      </div>
      {/* team cards */}
      <p className="section-heading mb-2">Team Status</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { name: 'Alex',   color: 'bg-sticky-blue',     status: 'Auth refactor' },
          { name: 'Sam',    color: 'bg-sticky-yellow',   status: 'Blocked 🚧',    blocked: true },
        ].map((m) => (
          <div key={m.name} className="card p-2 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-5 h-5 rounded-full ${m.color} border border-border flex items-center justify-center text-[9px] font-bold text-ink`}>
                {m.name[0]}
              </div>
              <span className="font-semibold font-display text-ink text-[11px]">{m.name}</span>
              {m.blocked && <span className="badge-blocked ml-auto" style={{ fontSize: 9 }}>Blocked</span>}
            </div>
            <p className="text-ink-muted text-[10px] leading-snug">{m.status}</p>
          </div>
        ))}
      </div>
      {/* animated memo feed */}
      <p className="section-heading mb-2">Recent Memos</p>
      <div className="space-y-1.5">
        {memos.map((m, i) => (
          <div
            key={m.author}
            className={`card p-2 flex items-start gap-2 transition-all duration-500 ${i === active ? 'border-ink/40 -translate-x-0.5' : ''}`}
          >
            <div className={`w-5 h-5 rounded-full ${m.color} border border-border flex items-center justify-center text-[9px] font-bold text-ink flex-shrink-0`}>
              {m.author[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-semibold font-display text-ink text-[11px]">{m.author}</span>
                <span className="font-mono text-ink-faint" style={{ fontSize: 9 }}>{m.time}</span>
              </div>
              <p className="text-ink-soft text-[10px] leading-snug line-clamp-1">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
      {/* catch me up strip */}
      <div className="sticky-yellow rounded-editorial px-3 py-2 flex items-center gap-2 mt-3 cursor-pointer hover:scale-[1.01] transition-transform">
        <span>⚡</span>
        <div>
          <p className="font-bold font-display text-ink text-[11px]">Catch Me Up</p>
          <p className="text-ink-soft text-[10px]">3 new memos since your last session</p>
        </div>
      </div>
    </div>
  );
}

// ── Ticker marquee ───────────────────────────────────────
const TICKER = ['End sessions with context', 'No more lost Slack threads', 'Memos linked to GitHub', 'AI-powered briefings', 'Catch Me Up in seconds', 'Team sync without standups', 'Context that actually helps'];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useReveal();

  useEffect(() => {
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
    <div className="min-h-screen bg-paper flex flex-col overflow-x-hidden">
      <CursorGlow />

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="border-b-2 border-ink bg-paper-cream/95 sticky top-0 z-50" style={{ backdropFilter: 'blur(10px)' }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-14 gap-6">
          {/* Logo */}
          <span className="font-display text-ink flex-shrink-0" style={{ fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.035em' }}>
            MEMO
          </span>

          {/* Centre links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'Features',   color: 'bg-sticky-blue' },
              { label: 'How it works', color: 'bg-sticky-yellow' },
              { label: 'Demo',       color: 'bg-sticky-green', href: '/demo' },
            ].map(({ label, color, href }) => (
              href
                ? <Link key={label} to={href} className={`nav-chip ${color} text-ink`}>{label}</Link>
                : <a key={label} href={`#${label.toLowerCase().replace(/ /g,'-')}`} className={`nav-chip ${color} text-ink`}>{label}</a>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-ink-muted">
              <div className="pulse-dot" />
              <span>Live</span>
            </div>
            <button
              onClick={handleGitHubLogin}
              className="btn-accent btn-shimmer text-sm px-4 py-2"
            >
              {GH_ICON}
              <span className="hidden sm:inline">Sign in</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-10 w-full">
        {/* Dot grid behind hero */}
        <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10 items-start">

          {/* ── Left column ── */}
          <div>
            {/* IBM tag */}
            <div className="fade-up-1 inline-flex items-center gap-2 mb-7">
              <span className="sticky-yellow text-[11px] font-bold uppercase tracking-widest font-display px-2.5 py-1 rounded-editorial cursor-default select-none">
                IBM watsonx Hackathon ⚡
              </span>
            </div>

            {/* Giant headline — each word animates in */}
            <div className="mb-7 leading-none" style={{ overflow: 'hidden' }}>
              <h1 className="text-display-2xl text-ink mb-1">
                <span className="word-rise word-rise-1">Save</span>{' '}
                <span className="word-rise word-rise-2">your</span>{' '}
                <span className="word-rise word-rise-3 underline-yellow">work.</span>
              </h1>
              <h1 className="text-display-2xl text-ink">
                <span className="word-rise word-rise-4">Share</span>{' '}
                <span className="word-rise word-rise-5">the</span>{' '}
                <span className="word-rise word-rise-5 underline-yellow">context.</span>
              </h1>
            </div>

            <p className="fade-up-2 text-base text-ink-soft max-w-md mb-2 leading-relaxed">
              GitHub tells the team <em>what</em> changed.
              MEMO tells them <strong className="text-ink">what it means</strong> —
              where you left off, what's blocking you, what happens next.
            </p>
            <p className="fade-up-3 text-sm text-ink-muted max-w-sm mb-8 leading-relaxed">
              End every session with a memo. Start the next one already knowing everything.
            </p>

            {/* CTAs */}
            <div className="fade-up-3 flex flex-wrap items-center gap-3 mb-8">
              <button
                onClick={handleGitHubLogin}
                className="btn-accent btn-shimmer text-base px-7 py-3 group"
              >
                {GH_ICON}
                Get started free
                <span className="group-hover:translate-x-1 transition-transform duration-150 inline-block">→</span>
              </button>
              <Link to="/demo" className="btn-secondary text-base px-6 py-3 group">
                Watch demo
                <span className="group-hover:translate-x-1 transition-transform duration-150 inline-block">↗</span>
              </Link>
            </div>

            {/* Social proof */}
            <div className="fade-up-4 flex items-center gap-4 pt-5 border-t border-border">
              <div className="flex -space-x-2">
                {['A','S','J','M','R'].map((l, i) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full border-2 border-paper-cream flex items-center justify-center text-[11px] font-bold text-ink transition-transform duration-150 hover:scale-110 hover:z-10 relative cursor-default ${['bg-sticky-blue','bg-sticky-yellow','bg-sticky-green','bg-sticky-lavender','bg-sticky-orange'][i]}`}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-muted font-display">
                Built for dev teams that ship fast
              </p>
            </div>
          </div>

          {/* ── Right column — browser + floating stickies ── */}
          <div className="relative hidden lg:block mt-4">
            {/* Sticky 1 — top right */}
            <div className="sticky-anim-1 absolute -top-8 -right-2 z-20 w-44">
              <div className="sticky-yellow p-3 rounded-editorial border border-black/15 shadow-sticky">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1 font-display">Today's focus</p>
                <p className="text-ink-soft text-[12px] leading-snug">Finish auth flow,<br />review Sam's PR</p>
              </div>
            </div>

            {/* Sticky 2 — left */}
            <div className="sticky-anim-4 absolute top-24 -left-12 z-20 w-40">
              <div className="sticky-pink p-3 rounded-editorial border border-black/15 shadow-sticky">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1 font-display">Blocked 🚧</p>
                <p className="text-ink-soft text-[12px] leading-snug">Waiting on<br />API keys</p>
              </div>
            </div>

            {/* Sticky 3 — bottom right */}
            <div className="sticky-anim-3 absolute -bottom-6 -right-8 z-20 w-44">
              <div className="sticky-green p-3 rounded-editorial border border-black/15 shadow-sticky">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1 font-display">Done ✓</p>
                <p className="text-ink-soft text-[12px] leading-snug">OAuth flow,<br />webhook handler</p>
              </div>
            </div>

            {/* Sticky 4 — bottom left */}
            <div className="sticky-anim-2 absolute -bottom-10 left-4 z-20 w-40">
              <div className="sticky-lavender p-3 rounded-editorial border border-black/15 shadow-sticky">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1 font-display">Next steps</p>
                <p className="text-ink-soft text-[12px] leading-snug">Deploy preview<br />+ write tests</p>
              </div>
            </div>

            {/* Browser frame */}
            <div className="mt-10 browser-frame" style={{ transform: 'perspective(1200px) rotateY(-2deg) rotateX(1deg)' }}>
              <div className="browser-chrome">
                <div className="browser-dot bg-sticky-pink" />
                <div className="browser-dot bg-sticky-yellow" />
                <div className="browser-dot bg-sticky-green" />
                <div className="flex-1 flex justify-center">
                  <div className="bg-paper-cream border border-border rounded-pill px-4 py-0.5 text-xs font-mono text-ink-muted max-w-[180px] truncate">
                    memo.app/projects/42
                  </div>
                </div>
              </div>
              <AppPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER STRIP ─────────────────────────────────── */}
      <div className="border-y-2 border-ink bg-ink overflow-hidden py-3">
        <div className="marquee-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-3 px-6 text-paper-cream font-display font-bold text-sm uppercase tracking-wide whitespace-nowrap">
              <span className="text-sticky-yellow">✦</span>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 w-full">
        <div className="reveal flex items-end justify-between mb-10">
          <h2 className="text-display-lg text-ink">How it works</h2>
          <span className="font-mono text-xs text-ink-faint hidden sm:block">3 steps</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-2 border-ink rounded-editorial overflow-hidden">
          {[
            {
              num: '01', title: 'End your session',
              desc: 'Fill in what you completed, what\'s in progress, what\'s blocking you, and what\'s next. Takes 2 minutes.',
              sticky: { color: 'sticky-blue' as const, label: 'Auto-linked', text: 'Commits & PRs attach automatically' },
              delay: 'reveal-delay-1',
            },
            {
              num: '02', title: 'Team stays in sync',
              desc: 'Dashboard shows what everyone is on, who\'s blocked, and what shipped. No standup needed.',
              sticky: { color: 'sticky-green' as const, label: 'Real-time', text: 'Blocked tasks surface to the top' },
              delay: 'reveal-delay-2',
            },
            {
              num: '03', title: 'Catch Me Up',
              desc: 'AI-powered briefing tells you exactly what happened while you were gone. Back to flow in seconds.',
              sticky: { color: 'sticky-lavender' as const, label: 'Powered by', text: 'IBM watsonx.ai' },
              delay: 'reveal-delay-3',
            },
          ].map((step, i) => (
            <div
              key={step.num}
              className={`reveal ${step.delay} bg-paper-cream p-8 ${i < 2 ? 'border-r-2 border-ink' : ''} flex flex-col gap-5 group hover:bg-paper transition-colors duration-200`}
            >
              <span
                className="font-display font-bold text-ink-faint text-5xl leading-none group-hover:text-ink transition-colors duration-200"
                style={{ letterSpacing: '-0.04em' }}
              >
                {step.num}
              </span>
              <h3 className="text-display-md text-ink">{step.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed flex-1">{step.desc}</p>
              <div className={`sticky ${step.sticky.color} text-xs transition-transform duration-200 group-hover:scale-[1.02]`}>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1 font-display">{step.sticky.label}</p>
                {step.sticky.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────── */}
      <div className="border-y-2 border-ink bg-paper-dark">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-0 divide-x-2 divide-ink">
          {[
            { val: 2,  suffix: 'min', label: 'to write a memo' },
            { val: 5,  suffix: 'sec', label: 'to catch up' },
            { val: 0,  suffix: ' standups', label: 'required' },
            { val: 100, suffix: '%', label: 'context preserved' },
          ].map((s, i) => (
            <div key={i} className="reveal px-6 py-2 text-center first:pl-0 last:pr-0">
              <p className="text-display-lg text-ink mb-0.5">
                <Counter to={s.val} suffix={s.suffix} />
              </p>
              <p className="text-xs text-ink-muted font-display uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES GRID ────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-5 sm:px-8 py-20 w-full">
        <h2 className="reveal text-display-lg text-ink mb-10">Everything your team needs</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Hero feature — spans 2 cols */}
          <div className="reveal card-editorial p-7 md:col-span-2 group cursor-default">
            <div className="flex items-center gap-3 mb-4">
              <span className="sticky-yellow px-2.5 py-1 text-xs font-bold font-display rounded-editorial">Core</span>
              <h3 className="text-display-md text-ink">Structured Memos</h3>
            </div>
            <p className="text-sm text-ink-soft leading-relaxed max-w-md mb-5">
              Every memo captures what you completed, what's in progress, what's blocking you, and what's next. Automatically linked to GitHub.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '✓ Completed', color: 'sticky-green'   },
                { label: '⟳ In progress', color: 'sticky-blue' },
                { label: '🚧 Blocked', color: 'sticky-pink'     },
                { label: '→ Next steps', color: 'sticky-yellow' },
              ].map(({ label, color }) => (
                <div
                  key={label}
                  className={`sticky ${color} text-xs font-semibold font-display transition-transform duration-150 hover:scale-105 cursor-default`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Catch Me Up */}
          <div className="reveal reveal-delay-1 card-editorial p-7 flex flex-col group cursor-default">
            <span className="sticky-lavender px-2.5 py-1 text-xs font-bold font-display rounded-editorial w-fit mb-4">AI ✦</span>
            <h3 className="text-display-md text-ink mb-3">Catch Me Up</h3>
            <p className="text-sm text-ink-soft leading-relaxed flex-1">
              Return to a project and instantly know what happened, who's blocked, and exactly where to start.
            </p>
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
              <div className="pulse-dot" />
              <p className="text-xs font-mono text-ink-faint">IBM watsonx.ai</p>
            </div>
          </div>

          {[
            { title: 'Kanban Board', desc: 'Tasks flow from next-steps into kanban. One click converts your memo into trackable work.', color: 'sticky-orange' },
            { title: 'GitHub Native', desc: 'Sign in with GitHub. Commits and PRs auto-attach to your memos. Zero setup.', color: 'sticky-blue' },
            { title: 'Team Dashboard', desc: 'See what everyone is doing, what\'s blocking them, and what shipped last session.', color: 'sticky-green' },
          ].map(({ title, desc, color }, i) => (
            <div key={title} className={`reveal reveal-delay-${i+1} card p-7 border border-border group cursor-default hover:border-ink transition-colors duration-200`}>
              <div className={`sticky ${color} text-xs font-bold font-display mb-4 w-fit px-2 py-1 rounded-editorial`}>{['⬡', '⇄', '◎'][i]}</div>
              <h3 className="text-display-md text-ink mb-3">{title}</h3>
              <p className="text-sm text-ink-soft leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIAL / QUOTE ──────────────────────────── */}
      <section className="border-y-2 border-ink bg-paper-dark py-16">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center reveal">
          <p className="text-display-md text-ink mb-6 leading-snug">
            "GitHub tells you <span className="underline-yellow">what</span> changed.<br />
            MEMO tells you <span className="underline-yellow">what it means.</span>"
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="flex -space-x-1.5">
              {['bg-sticky-yellow','bg-sticky-blue','bg-sticky-green'].map((c,i) => (
                <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-paper-dark flex items-center justify-center text-[10px] font-bold text-ink`}>
                  {['A','S','J'][i]}
                </div>
              ))}
            </div>
            <p className="text-sm text-ink-muted font-display">The MEMO team</p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────── */}
      <section className="bg-ink border-b-2 border-ink py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-10 reveal">
          <div>
            <h2 className="text-display-xl text-paper-cream mb-3 leading-tight">
              Ready to ship<br />with context?
            </h2>
            <p className="text-sm text-paper-dark max-w-sm leading-relaxed">
              Free during the IBM watsonx Hackathon. Sign in with GitHub and write your first memo in under 2 minutes.
            </p>
          </div>
          <div className="flex flex-col gap-3 flex-shrink-0 items-center">
            <button
              onClick={handleGitHubLogin}
              className="btn-accent btn-shimmer text-base px-8 py-4 group"
            >
              {GH_ICON}
              Start with GitHub
              <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </button>
            <Link to="/demo" className="text-sm text-paper-dark hover:text-paper-cream transition-colors font-display underline underline-offset-2">
              See the demo first
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="bg-ink border-t border-ink/20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display font-bold text-paper-cream text-lg" style={{ letterSpacing: '-0.03em' }}>MEMO</span>
          <div className="flex items-center gap-6">
            <Link to="/demo" className="text-xs text-paper-dark hover:text-paper-cream transition-colors font-display">Demo</Link>
            <a href="https://github.com/veavannez/Memo" target="_blank" rel="noopener noreferrer" className="text-xs text-paper-dark hover:text-paper-cream transition-colors font-display">GitHub</a>
          </div>
          <p className="text-xs font-mono text-paper-dark/60">
            IBM watsonx Hackathon · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
