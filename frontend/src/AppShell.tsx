import React from 'react';
import { Link, Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from './lib/api';
import type { Project } from './types/index';
import { LogOut, LayoutDashboard, FileText, CheckSquare, Kanban, Zap } from 'lucide-react';

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
        { to: `/projects/${projectId}`, label: 'Dashboard', icon: LayoutDashboard },
        { to: `/projects/${projectId}/memos`, label: 'Memos', icon: FileText },
        { to: `/projects/${projectId}/tasks`, label: 'Tasks', icon: CheckSquare },
        { to: `/projects/${projectId}/kanban`, label: 'Kanban', icon: Kanban },
        { to: `/projects/${projectId}/catch-me-up`, label: 'Catch Me Up', icon: Zap },
      ]
    : [];

  const isActive = (path: string) =>
    path === `/projects/${projectId}`
      ? location.pathname === path
      : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link to="/projects" className="font-bold text-gray-900 tracking-tight text-lg">
              MEMO
            </Link>
            {project && (
              <>
                <span className="text-gray-300">/</span>
                <Link
                  to={`/projects/${projectId}`}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1"
                >
                  <span className="max-w-[160px] truncate">{project.name}</span>
                </Link>
              </>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name}
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                    {user.display_name[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-gray-700 hidden sm:block">{user.display_name}</span>
              </div>
              <button
                onClick={() => logout().then(() => navigate('/'))}
                className="btn-ghost text-xs px-2 py-1"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Project sub-nav */}
        {navItems.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-0 border-t border-gray-100">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive(to)
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
