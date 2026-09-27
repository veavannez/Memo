import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_PROJECT, DEMO_MEMBERS, isDemoMode } from '../lib/demo';
import type { Project, Repository } from '../types';
import { Plus, GitBranch, Lock, Globe, ArrowRight, FlaskConical, Zap } from 'lucide-react';
import { timeAgo } from '../lib/utils';
import toast from 'react-hot-toast';

// ─── Demo project card ────────────────────────────────────────────────────────
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
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  const isDemo = isDemoMode();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => {
      if (isDemo) return Promise.resolve([DEMO_PROJECT]);
      return api.get('/projects').then((r) => r.data);
    },
  });

  const createProject = useMutation({
    mutationFn: (data: { name: string; description: string; repository_id: number }) =>
      api.post('/projects', data).then((r) => r.data),
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created!');
      navigate(`/projects/${project.id}`);
    },
    onError: () => toast.error('Failed to create project'),
  });

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
        {!isDemo && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
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
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Create your first project
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
                Connect a GitHub repository → End each coding session with a structured memo → Convert next steps to tasks → Use <strong>Catch Me Up</strong> when you return.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create project modal */}
      {showCreate && !isDemo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card-editorial w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-ink mb-1">Create Project</h2>
            <p className="text-sm text-ink-muted mb-5">Connect a GitHub repository to get started.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!projectName.trim()) return;
                // Without a real repo selected, prompt to install GitHub App
                toast.error('Please install the MEMO GitHub App and select a repository.');
              }}
              className="space-y-4"
            >
              <div>
                <label className="label">Project Name</label>
                <input
                  className="input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Auth Service"
                  required
                />
              </div>
              <div>
                <label className="label">Description <span className="text-ink-faint font-normal normal-case tracking-normal">(optional)</span></label>
                <input
                  className="input"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Brief description…"
                />
              </div>
              <div className="card p-4 border-dashed">
                <p className="text-xs font-bold text-ink mb-2">GitHub Repository</p>
                <p className="text-xs text-ink-muted mb-3">
                  Install the MEMO GitHub App on your account or organisation to select a repository.
                </p>
                <a
                  href={`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG || 'memo-workspace'}/installations/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs px-3 py-1.5 inline-flex"
                >
                  Install GitHub App →
                </a>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={!projectName.trim()}>
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
