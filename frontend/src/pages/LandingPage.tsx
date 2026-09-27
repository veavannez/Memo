import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';


// Staggered sticky note data — represents real MEMO workflow stages
const STICKIES = [
  { color: 'sticky-yellow',   rotate: '-rotate-2',  label: 'IN PROGRESS', body: 'Connect frontend to new /auth/refresh endpoint', settle: 'sticky-settle-1' },
  { color: 'sticky-green',    rotate: 'rotate-1',   label: 'DONE',         body: 'Fixed token expiry edge case', settle: 'sticky-settle-2' },
  { color: 'sticky-pink',     rotate: 'rotate-3',   label: 'BLOCKED',      body: 'Waiting on Redis in staging', settle: 'sticky-settle-3' },
  { color: 'sticky-blue',     rotate: '-rotate-1',  label: 'NEXT',         body: 'Update integration tests to new token format', settle: 'sticky-settle-4' },
  { color: 'sticky-lavender', rotate: 'rotate-2',   label: 'NOTE',         body: 'Token deprecation deadline: April 1', settle: 'sticky-settle-5' },
];

const TICKER_ITEMS = [
  'End sessions with context',
  'No more lost Slack threads',
  'Memos linked to GitHub',
  'AI-powered briefings',
  'Catch Me Up in seconds',
  'Team sync without standups',
  'Context that actually helps',
  'Tasks from your last memo',
  'Always know where you left off',
];

export default function LandingPage() {
  const { isAuthenticated, loginDemo } = useAuth();
  const navigate = useNavigate();
  const revealRefs = useRef<HTMLElement[]>([]);

  // Redirect already-authed users to their projects
  useEffect(() => {
    if (isAuthenticated) navigate('/projects', { replace: true });
  }, [isAuthenticated, navigate]);

  // Scroll reveal
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      revealRefs.current.forEach((el) => el?.classList.add('revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('revealed'); }),
      { threshold: 0.12 }
    );
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addReveal = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  const handleDemoLogin = () => {
    loginDemo();
    navigate('/projects');
  };

  const handleGitHubLogin = async () => {
    try {
      const { data } = await api.get<{ auth_url: string }>('/auth/github/login');
      window.location.assign(data.auth_url);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not start GitHub sign-in.');
    }
  };

  return (
    <div className="min-h-screen bg-paper font-sans overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-4 bg-paper-cream border-b-2 border-ink sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <img src="/memo-logo.png" alt="MEMO" className="h-9 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDemoLogin}
            className="btn-secondary text-sm px-4 py-2"
          >
            Try Demo
          </button>
          <a
            href="#" onClick={(event) => { event.preventDefault(); handleGitHubLogin(); }}
            className="btn-primary text-sm px-4 py-2"
          >
            Sign in with GitHub
          </a>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pt-16 pb-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[88vh]">

        {/* Left — editorial text */}
        <div>
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 border-2 border-ink rounded-pill text-xs font-bold uppercase tracking-widest bg-sticky-yellow">
            <span className="w-2 h-2 rounded-full bg-ink" />
            IBM watsonx Hackathon 2024
          </div>

          <h1 className="text-display-2xl text-ink mb-3 leading-none">
            MEMO
          </h1>
          <p className="text-display-xl text-ink mb-2 leading-none font-display">
            SAVE YOUR WORK.
          </p>
          <p className="text-display-xl text-ink mb-2 leading-none font-display">
            SHARE THE CONTEXT.
          </p>
          <p className="text-display-xl text-ink mb-8 leading-none font-display">
            KEEP CODING.
          </p>

          <p className="text-lg text-ink-soft max-w-lg mb-8 leading-relaxed fade-up-1">
            End every coding session with a structured memo. Let your team pick up exactly where you left off — and let AI catch you up when you return.
          </p>

          <div className="flex flex-wrap gap-3 fade-up-2">
            <a
              href="#" onClick={(event) => { event.preventDefault(); handleGitHubLogin(); }}
              className="btn-primary text-base px-6 py-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Continue with GitHub
            </a>
            <button
              onClick={handleDemoLogin}
              className="btn-secondary text-base px-6 py-3"
            >
              Try the demo
            </button>
          </div>

          {/* Social proof chips */}
          <div className="flex flex-wrap gap-2 mt-8 fade-up-3">
            {['End sessions with context', 'GitHub-linked memos', 'AI-powered briefings', 'Kanban board'].map((t) => (
              <span key={t} className="activity-pill">{t}</span>
            ))}
          </div>
        </div>

        {/* Right — monitor corner with sticky notes */}
        <div className="relative flex justify-end items-center h-[520px] overflow-hidden">
          {/* Monitor partial — cropped at right by viewport */}
          <div
            className="monitor-enter relative w-[380px] h-[440px] rounded-2xl border-2 border-ink bg-paper-dark"
            style={{ boxShadow: '8px 8px 0 0 #0F0F0F', marginRight: '-60px' }}
          >
            {/* Screen chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b-2 border-ink">
              <div className="w-3 h-3 rounded-full bg-sticky-pink border border-ink/30" />
              <div className="w-3 h-3 rounded-full bg-sticky-yellow border border-ink/30" />
              <div className="w-3 h-3 rounded-full bg-sticky-green border border-ink/30" />
              <span className="ml-2 text-xs font-mono text-ink-muted">auth-service — MEMO</span>
            </div>

            {/* Screen surface — sticky canvas */}
            <div className="relative w-full h-full p-4 bg-paper-cream/70">
              {/* Sticky note grid */}
              <div className={`absolute top-6 left-4 w-36 ${STICKIES[0].settle} ${STICKIES[0].rotate}`}>
                <div className={`${STICKIES[0].color} sticky p-3`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-1">{STICKIES[0].label}</p>
                  <p className="text-xs leading-snug">{STICKIES[0].body}</p>
                </div>
              </div>
              <div className={`absolute top-4 right-6 w-32 ${STICKIES[1].settle} ${STICKIES[1].rotate}`}>
                <div className={`${STICKIES[1].color} sticky p-3`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-1">{STICKIES[1].label}</p>
                  <p className="text-xs leading-snug">{STICKIES[1].body}</p>
                </div>
              </div>
              <div className={`absolute top-48 left-8 w-36 ${STICKIES[2].settle} ${STICKIES[2].rotate}`}>
                <div className={`${STICKIES[2].color} sticky p-3`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-1">{STICKIES[2].label}</p>
                  <p className="text-xs leading-snug">{STICKIES[2].body}</p>
                </div>
              </div>
              <div className={`absolute bottom-24 right-4 w-36 ${STICKIES[3].settle} ${STICKIES[3].rotate}`}>
                <div className={`${STICKIES[3].color} sticky p-3`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-1">{STICKIES[3].label}</p>
                  <p className="text-xs leading-snug">{STICKIES[3].body}</p>
                </div>
              </div>
              <div className={`absolute bottom-8 left-6 w-40 ${STICKIES[4].settle} ${STICKIES[4].rotate}`}>
                <div className={`${STICKIES[4].color} sticky p-3`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/50 mb-1">{STICKIES[4].label}</p>
                  <p className="text-xs leading-snug">{STICKIES[4].body}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────────── */}
      <div className="border-y-2 border-ink bg-ink py-3 marquee-wrap overflow-hidden">
        <div className="marquee-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-3 px-6 text-paper-cream text-sm font-sans font-medium whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-sticky-yellow flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
        <div className="text-center mb-12" ref={addReveal as any}>
          <p className="section-heading">The workflow</p>
          <h2 className="text-display-lg text-ink">One loop. No context lost.</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-0 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-0.5 bg-ink z-0" />
          {[
            { step: '01', label: 'End Session',   color: 'bg-sticky-yellow',   body: 'Fill in what you did, what\'s in progress, blockers, and next steps.' },
            { step: '02', label: 'Create Tasks',  color: 'bg-sticky-green',    body: 'Convert next steps into tracked tasks with one click.' },
            { step: '03', label: 'Kanban Board',  color: 'bg-sticky-blue',     body: 'Move tasks across columns. See who owns what.' },
            { step: '04', label: 'Catch Me Up',   color: 'bg-sticky-orange',   body: 'AI-powered briefing when you return. Know exactly what happened.' },
          ].map(({ step, label, color, body }, i) => (
            <div key={step} className="relative z-10 flex flex-col items-center text-center px-4" ref={addReveal as any} style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className={`w-20 h-20 rounded-full ${color} border-2 border-ink flex items-center justify-center mb-4 shadow-editorial`}>
                <span className="text-display-md text-ink">{step}</span>
              </div>
              <h3 className="font-bold text-ink text-base mb-2">{label}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature strip ────────────────────────────────────── */}
      <section className="border-y-2 border-ink bg-paper-dark py-16">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { color: 'bg-sticky-yellow', title: 'GitHub-native', body: 'Commits and PRs attach automatically to every memo. Your activity is always in context.' },
            { color: 'bg-sticky-blue',   title: 'AI-powered catch-up', body: 'IBM watsonx.ai reads your memos, tasks, and GitHub activity to brief you in seconds.' },
            { color: 'bg-sticky-green',  title: 'Team visibility', body: 'See what every teammate left off, what\'s blocked, and what needs attention — without a standup.' },
          ].map(({ color, title, body }) => (
            <div key={title} className="card-editorial p-6 reveal" ref={addReveal as any}>
              <div className={`w-10 h-10 rounded-sticky ${color} border-2 border-ink mb-4`} />
              <h3 className="font-bold text-ink text-lg mb-2">{title}</h3>
              <p className="text-ink-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-6 text-center py-24 reveal" ref={addReveal as any}>
        <h2 className="text-display-xl text-ink mb-6 leading-none">KEEP CODING.</h2>
        <p className="text-lg text-ink-soft mb-8">Start your first project in 60 seconds. No credit card. GitHub account required only for real repos.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#" onClick={(event) => { event.preventDefault(); handleGitHubLogin(); }}
            className="btn-primary text-base px-8 py-4"
          >
            Connect GitHub →
          </a>
          <button onClick={handleDemoLogin} className="btn-secondary text-base px-8 py-4">
            Try with demo data
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t-2 border-ink bg-ink py-8">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 flex items-center justify-between">
          <img src="/memo-logo.png" alt="MEMO" className="h-8 w-auto brightness-0 invert" />
          <p className="text-sm text-paper-cream/60 font-sans">
            Built for IBM watsonx Hackathon 2024
          </p>
        </div>
      </footer>
    </div>
  );
}
