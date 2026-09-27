import { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_PROJECT, activateDemoMode, deactivateDemoMode, isDemoMode } from '../lib/demo';
import type { Project } from '../types';
import { Plus, GitBranch, Lock, Globe, ArrowRight, FlaskConical, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

// â”€â”€â”€ Demo project card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DemoProjectCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left card-editorial p-6 cursor-pointer group hover:-translate-y-0.5 transition-transform"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-sticky bg-sticky-yellow border-2 border-ink flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-ink" />
          </div>
          <div>
            <h3 className="font-bold text-ink text-base">{DEMO_PROJECT.name}</h3>
            <p className="text-xs font-mono text-ink-muted">{DEMO_PROJECT.repository?.full_name}</p>
          </div>
        </div>
        <span className="badge-demo">Demo</span>
      </div>
      <p className="text-sm text-ink-muted mb-4">{DEMO_PROJECT.description}</p>
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-sticky-green" /> 3 members
        </span>
        <span>8 tasks</span>
        <span>3 memos</span>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm font-bold text-ink group-hover:gap-3 transition-all">
        Open demo project <ArrowRight className="w-4 h-4" />
      </div>
    </button>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);

  const isDemo = isDemoMode();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => {
      if (isDemo) return Promise.resolve([DEMO_PROJECT]);
      return api.get('/projects').then((r) => r.data);
    },
  });

  const handleConnectGitHub = async () => {
    setIsConnecting(true);
    deactivateDemoMode();
    localStorage.removeItem('access_token');
    try {
      const { data } = await api.get<{ auth_url: string }>('/auth/github/login');
      window.location.assign(data.auth_url);
    } catch (error) {
      activateDemoMode();
      setIsConnecting(false);
      const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
      toast.error(
        typeof detail === 'string'
          ? detail
          : 'Could not start GitHub connection. Check that the backend is running and allows this frontend origin.',
      );
    }
  };
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">Your Projects</h1>
          <p className="text-sm text-ink-muted">Connect a GitHub repository and start leaving memos.</p>
        </div>
        {isDemo ? (
          <button className="btn-primary" onClick={handleConnectGitHub} disabled={isConnecting}>
            <GitBranch className="w-4 h-4" />
            {isConnecting ? 'Connectingâ€¦' : 'Connect GitHub'}
          </button>
        ) : projects.length > 0 ? (
          <button className="btn-primary" onClick={() => navigate('/projects/new')}>
            <Plus className="w-4 h-4" />
            Connect Repository
          </button>
        ) : null}
      </div>

      {/* Demo mode CTA */}
      {isDemo && (
        <div className="mb-6">
          <DemoProjectCard onClick={() => navigate(`/projects/${DEMO_PROJECT.id}`)} />
        </div>
      )}

      {/* Real project list */}
      {!isDemo && projects.length === 0 ? (
        <div className="card-editorial p-12 text-center">
          <div className="empty-state">
            <div className="empty-state-icon">
              <GitBranch className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-ink text-lg mb-2">No projects yet</h3>
            <p className="text-ink-muted text-sm mb-6 max-w-xs">
              Connect a GitHub repository to start tracking your team's sessions with structured memos.
            </p>
            <button className="btn-primary" onClick={() => navigate('/projects/new')}>
              <Plus className="w-4 h-4" />
              Connect your first repository
            </button>
          </div>
        </div>
      ) : !isDemo ? (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card-collage p-5 flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-ink group-hover:text-ink transition-colors">
                    {project.name}
                  </h3>
                  {project.repository?.is_private ? (
                    <Lock className="w-3.5 h-3.5 text-ink-faint" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-ink-faint" />
                  )}
                </div>
                {project.description && (
                  <p className="text-sm text-ink-muted mb-1">{project.description}</p>
                )}
                {project.repository && (
                  <p className="text-xs font-mono text-ink-faint">{project.repository.full_name}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-mono text-ink-faint">{project.repository?.default_branch}</span>
                <ArrowRight className="w-4 h-4 text-ink-faint group-hover:text-ink group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {/* Onboarding tip for new users */}
      {!isDemo && (
        <div className="mt-8 card p-5 border-dashed">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-sticky bg-sticky-lavender border border-ink/20 flex-shrink-0 flex items-center justify-center">
              <Zap className="w-4 h-4 text-ink" />
            </div>
            <div>
              <p className="font-semibold text-ink text-sm mb-1">How MEMO works</p>
              <p className="text-xs text-ink-muted leading-relaxed">
                Connect a GitHub repository â†’ End each coding session with a structured memo â†’ Convert next steps to tasks â†’ Use <strong>Catch Me Up</strong> when you return.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
