import React from 'react';
import { Link, Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from './lib/api';
import type { Project } from './types/index';
import { Avatar } from './components/ui';
import { LayoutDashboard, FileText, CheckSquare, Kanban, Zap, LogOut, ChevronRight } from 'lucide-react';

function AppShell() {
  const { user, logout } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data),
    enabled: !!projectId,
  });

  const navItems = projectId
    ? [
        { to: `/projects/${projectId}`,            label: 'Dashboard', icon: LayoutDashboard },
        { to: `/projects/${projectId}/memos`,       label: 'Memos',     icon: FileText },
        { to: `/projects/${projectId}/tasks`,       label: 'Tasks',     icon: CheckSquare },
        { to: `/projects/${projectId}/kanban`,      label: 'Kanban',    icon: Kanban },
        { to: `/projects/${projectId}/catch-me-up`, label: 'Catch Me Up', icon: Zap },
      ]
    : [];

  const isActive = (path: string) =>
    path === `/projects/${projectId}`
      ? location.pathname === path
      : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* ── Top nav ─────────────────────────────────────── */}
      <header className="nav-root">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-14">

            {/* Left: logo + breadcrumb */}
            <div className="flex items-center gap-2">
              <Link
                to="/projects"
                className="font-display font-800 text-ink text-xl tracking-tight hover:opacity-70 transition-opacity"
                style={{ fontWeight: 800, letterSpacing: '-0.03em' }}
              >
                MEMO
              </Link>

              {project && (
                <>
                  <ChevronRight className="w-4 h-4 text-ink-faint" />
                  <Link
                    to={`/projects/${projectId}`}
                    className="text-sm font-semibold font-display text-ink-muted hover:text-ink transition-colors max-w-[180px] truncate"
                  >
                    {project.name}
                  </Link>
                </>
              )}
            </div>

            {/* Right: user + logout */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Avatar name={user.display_name} src={user.avatar_url} size="sm" />
                  <span className="text-sm font-medium text-ink hidden sm:block font-display">
                    {user.display_name}
                  </span>
                </div>
                <button
                  onClick={() => logout().then(() => navigate('/'))}
                  className="btn-ghost py-1.5 px-2 text-xs"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ── Project sub-nav ──────────────────────────── */}
          {navItems.length > 0 && (
            <div className="flex gap-0 border-t border-border -mx-0 overflow-x-auto">
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={isActive(to) ? 'nav-link-active' : 'nav-link'}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              ))}
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
