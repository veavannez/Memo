import React, { useState } from 'react';
import { Link, Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from './lib/api';
import type { Project } from './types/index';
import { Avatar } from './components/ui';
import { LayoutDashboard, FileText, CheckSquare, Kanban, Zap, LogOut, ChevronRight, Plus } from 'lucide-react';

function AppShell() {
  const { user, logout } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data),
    enabled: !!projectId,
  });

  const navItems = projectId
    ? [
        { to: `/projects/${projectId}`,            label: 'Dashboard',   icon: LayoutDashboard, color: 'bg-sticky-blue' },
        { to: `/projects/${projectId}/memos`,       label: 'Memos',       icon: FileText,         color: 'bg-sticky-yellow' },
        { to: `/projects/${projectId}/tasks`,       label: 'Tasks',       icon: CheckSquare,      color: 'bg-sticky-green' },
        { to: `/projects/${projectId}/kanban`,      label: 'Kanban',      icon: Kanban,           color: 'bg-sticky-lavender' },
        { to: `/projects/${projectId}/catch-me-up`, label: 'Catch Me Up', icon: Zap,              color: 'bg-sticky-orange' },
      ]
    : [];

  const isActive = (path: string) =>
    path === `/projects/${projectId}`
      ? location.pathname === path
      : location.pathname.startsWith(path);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* ── Top nav ─────────────────────────────────────── */}
      <header className="nav-root">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-14 gap-4">

            {/* Logo + breadcrumb */}
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to="/projects"
                className="font-display text-ink flex-shrink-0 hover:opacity-70 transition-opacity active:scale-95"
                style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.035em' }}
              >
                MEMO
              </Link>

              {project && (
                <>
                  <ChevronRight className="w-4 h-4 text-ink-faint flex-shrink-0" />
                  <Link
                    to={`/projects/${projectId}`}
                    className="text-sm font-semibold font-display text-ink-muted hover:text-ink transition-colors truncate max-w-[160px]"
                  >
                    {project.name}
                  </Link>
                  {project.repository && (
                    <span className="hidden sm:flex items-center gap-1 activity-pill">
                      <span className="text-[10px]">⬡</span>
                      <span className="truncate max-w-[120px]">{project.repository.full_name}</span>
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Right: quick actions + user */}
            {user && (
              <div className="flex items-center gap-2">
                {/* Create memo quick-action */}
                {projectId && (
                  <Link
                    to={`/projects/${projectId}/memos/new`}
                    className="btn-accent text-xs px-3 py-1.5 hidden sm:flex"
                    style={{ fontSize: '12px' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Memo
                  </Link>
                )}

                {/* Live indicator */}
                <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-ink-muted">
                  <div className="pulse-dot" />
                  <span>Live</span>
                </div>

                {/* User button */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(o => !o)}
                    className="flex items-center gap-2 px-2 py-1 rounded-card hover:bg-paper-dark transition-colors duration-150 active:scale-95"
                  >
                    <Avatar name={user.display_name} src={user.avatar_url} size="sm" />
                    <span className="text-sm font-semibold font-display text-ink hidden sm:block max-w-[100px] truncate">
                      {user.display_name}
                    </span>
                  </button>

                  {/* Dropdown */}
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-48 card-editorial z-50 overflow-hidden animate-scale-in">
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-xs font-bold font-display text-ink truncate">{user.display_name}</p>
                          {user.github_login && (
                            <p className="text-[11px] font-mono text-ink-muted">@{user.github_login}</p>
                          )}
                        </div>
                        <Link
                          to="/projects"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-soft hover:bg-paper-dark transition-colors font-display"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5" />
                          All Projects
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-soft hover:bg-sticky-pink/30 transition-colors font-display border-t border-border"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Project sub-nav ──────────────────────────── */}
          {navItems.length > 0 && (
            <div className="flex gap-0 border-t border-border overflow-x-auto scrollbar-none -mx-0">
              {navItems.map(({ to, label, icon: Icon, color }) => {
                const active = isActive(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap
                      border-b-2 transition-all duration-200 font-display group
                      ${active
                        ? 'text-ink border-ink'
                        : 'text-ink-muted border-transparent hover:text-ink hover:border-ink/30'
                      }
                    `}
                  >
                    {/* Active colour dot */}
                    {active && (
                      <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
                    )}
                    {!active && (
                      <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                    )}
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* ── Page content ────────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
