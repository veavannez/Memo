import { useState } from 'react';
import { Link, Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from './lib/api';
import {
  DEMO_PROJECT,
  isDemoMode,
} from './lib/demo';
import type { Project } from './types/index';
import {
  LayoutDashboard, FileText, CheckSquare, Kanban, Zap,
  LogOut, ChevronRight, Plus, FlaskConical, GitBranch, Brain,
} from 'lucide-react';

// ─── Minimal inline avatar (avoids circular import with ui/index.tsx) ─────────
function AvatarSmall({ name, src }: { name: string; src?: string }) {
  if (src) return <img src={src} alt={name} className="avatar-sm" />;
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  const colors = ['bg-sticky-yellow','bg-sticky-blue','bg-sticky-green','bg-sticky-lavender','bg-sticky-orange','bg-sticky-pink'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`avatar-sm ${color} flex items-center justify-center text-ink`}>
      {initials}
    </div>
  );
}

// ─── Workflow step labels (used in sub-nav context) ───────────────────────────

function AppShell() {
  const { user, logout, isDemo } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // In demo mode return the demo project immediately — no network needed
  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => {
      if (isDemoMode()) return Promise.resolve(DEMO_PROJECT);
      return api.get(`/projects/${projectId}`).then((r) => r.data);
    },
    enabled: !!projectId,
  });

  const navItems = projectId
    ? [
        { to: `/projects/${projectId}`,                label: 'Dashboard',     icon: LayoutDashboard, color: 'bg-sticky-blue'     },
        { to: `/projects/${projectId}/context`,        label: 'Context',       icon: GitBranch,        color: 'bg-sticky-green'    },
        { to: `/projects/${projectId}/intelligence`,   label: 'Intelligence',  icon: Brain,            color: 'bg-sticky-lavender' },
        { to: `/projects/${projectId}/memos`,          label: 'Memos',         icon: FileText,         color: 'bg-sticky-yellow'   },
        { to: `/projects/${projectId}/tasks`,          label: 'Tasks',         icon: CheckSquare,      color: 'bg-sticky-lavender' },
        { to: `/projects/${projectId}/kanban`,         label: 'Kanban',        icon: Kanban,           color: 'bg-sticky-pink'     },
        { to: `/projects/${projectId}/catch-me-up`,    label: 'Catch Me Up',   icon: Zap,              color: 'bg-sticky-orange'   },
      ]
    : [];

  const isActive = (path: string) =>
    path === `/projects/${projectId}`
      ? location.pathname === path
      : location.pathname.startsWith(path);

  // Determine current workflow position for context display

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/');
  };

  // Show END SESSION CTA only on Dashboard and Memos pages
  const showEndSession = projectId && (
    location.pathname === `/projects/${projectId}` ||
    location.pathname === `/projects/${projectId}/memos`
  );

  // Show CATCH ME UP CTA on Dashboard only
  const showCatchMeUp = projectId && location.pathname === `/projects/${projectId}`;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* ── Top nav ─────────────────────────────────────────── */}
      <header className="nav-root">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-14 gap-4">

            {/* Logo + breadcrumb */}
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to="/projects"
                className="flex-shrink-0 hover:opacity-75 transition-opacity active:scale-95"
              >
                <img src="/memo-logo.png" alt="MEMO" className="h-9 w-auto" />
              </Link>

              {project && (
                <>
                  <ChevronRight className="w-4 h-4 text-ink-faint flex-shrink-0" />
                  <Link
                    to={`/projects/${projectId}`}
                    className="text-sm font-semibold text-ink-muted hover:text-ink transition-colors truncate max-w-[160px]"
                  >
                    {project.name}
                  </Link>
                  {project.repository && (
                    <span className="hidden sm:flex items-center gap-1 activity-pill">
                      <span className="font-mono text-[10px]">⬡</span>
                      <span className="font-mono truncate max-w-[120px] text-[11px]">
                        {project.repository.full_name}
                      </span>
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Right: workflow CTAs + user */}
            {user && (
              <div className="flex items-center gap-2">

                {/* Demo badge */}
                {isDemo && (
                  <span className="badge-demo hidden sm:flex items-center gap-1">
                    <FlaskConical className="w-3 h-3" />
                    Demo
                  </span>
                )}

                {/* CATCH ME UP — returns user to context */}
                {showCatchMeUp && (
                  <Link
                    to={`/projects/${projectId}/catch-me-up`}
                    className="btn-catch-me-up text-sm px-4 py-2 hidden md:flex"
                  >
                    <Zap className="w-4 h-4" />
                    Catch Me Up
                  </Link>
                )}

                {/* END SESSION — primary action */}
                {showEndSession && (
                  <Link
                    to={`/projects/${projectId}/memos/new`}
                    className="btn-end-session text-sm px-4 py-2"
                  >
                    <Plus className="w-4 h-4" />
                    End Session
                  </Link>
                )}

                {/* Live pulse */}
                <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-ink-muted">
                  <div className="pulse-dot" />
                  <span>Live</span>
                </div>

                {/* User dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex items-center gap-2 px-2 py-1 rounded-card hover:bg-paper-dark transition-colors duration-150 active:scale-95"
                  >
                    <AvatarSmall name={user.display_name} src={user.avatar_url} />
                    <span className="text-sm font-semibold text-ink hidden sm:block max-w-[100px] truncate">
                      {user.display_name}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-52 card-editorial z-50 overflow-hidden animate-scale-in">
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-xs font-bold text-ink truncate">{user.display_name}</p>
                          {user.github_login && (
                            <p className="text-[11px] font-mono text-ink-muted">@{user.github_login}</p>
                          )}
                          {isDemo && (
                            <span className="badge-demo mt-1 inline-flex">Demo mode</span>
                          )}
                        </div>
                        <Link
                          to="/projects"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-soft hover:bg-paper-dark transition-colors"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5" />
                          All Projects
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-soft hover:bg-sticky-pink/30 transition-colors border-t border-border"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          {isDemo ? 'Exit Demo' : 'Sign out'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Project sub-nav ──────────────────────────────── */}
          {navItems.length > 0 && (
            <div className="flex gap-0 border-t border-border overflow-x-auto scrollbar-none">
              {navItems.map(({ to, label, icon: Icon, color }) => {
                const active = isActive(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold
                      whitespace-nowrap border-b-2 transition-all duration-200 group
                      ${active
                        ? 'text-ink border-ink'
                        : 'text-ink-muted border-transparent hover:text-ink hover:border-ink/30'
                      }
                    `}
                  >
                    {active && <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />}
                    {!active && <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />}
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
