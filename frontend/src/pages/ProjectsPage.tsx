import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Installation, Repository, Project } from '../types';
import { Plus, GitBranch, Lock, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = React.useState(false);
  const [selectedRepo, setSelectedRepo] = React.useState<Repository | null>(null);
  const [projectName, setProjectName] = React.useState('');
  const [projectDesc, setProjectDesc] = React.useState('');
  const [selectedInstallation, setSelectedInstallation] = React.useState<number | null>(null);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  });

  const { data: installations = [] } = useQuery<Installation[]>({
    queryKey: ['installations'],
    queryFn: () => api.get('/github/installations').then((r) => r.data),
    enabled: showCreate,
  });

  const { data: repos = [], isLoading: reposLoading } = useQuery<Repository[]>({
    queryKey: ['repos', selectedInstallation],
    queryFn: () =>
      api.get(`/github/installations/${selectedInstallation}/repositories`).then((r) => r.data),
    enabled: !!selectedInstallation,
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo || !projectName.trim()) return;
    createProject.mutate({
      name: projectName.trim(),
      description: projectDesc.trim(),
      repository_id: selectedRepo.id,
    });
  };

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your MEMO projects connected to GitHub repositories</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Project list */}
      {projects.length === 0 ? (
        <div className="card p-12 text-center">
          <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-700 font-medium mb-1">No projects yet</h3>
          <p className="text-gray-400 text-sm mb-4">Connect a GitHub repository to get started</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card p-5 hover:border-gray-300 transition-colors flex items-start justify-between group"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </h3>
                  {project.repository?.is_private ? (
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </div>
                {project.description && (
                  <p className="text-sm text-gray-500 mb-1">{project.description}</p>
                )}
                {project.repository && (
                  <p className="text-xs text-gray-400 font-mono">{project.repository.full_name}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap mt-1">
                {project.repository?.default_branch}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Create project modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Installation selector */}
              <div>
                <label className="label">GitHub Account / Organization</label>
                <select
                  className="input"
                  value={selectedInstallation ?? ''}
                  onChange={(e) => {
                    setSelectedInstallation(Number(e.target.value) || null);
                    setSelectedRepo(null);
                  }}
                >
                  <option value="">Select account…</option>
                  {installations.map((inst) => (
                    <option key={inst.id} value={inst.installation_id}>
                      {inst.account_login} ({inst.account_type})
                    </option>
                  ))}
                </select>
                {installations.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No GitHub App installations found.{' '}
                    <a
                      href={`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG || 'memo-app'}/installations/new`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Install MEMO GitHub App
                    </a>
                  </p>
                )}
              </div>

              {/* Repository selector */}
              {selectedInstallation && (
                <div>
                  <label className="label">Repository</label>
                  {reposLoading ? (
                    <div className="text-sm text-gray-400">Loading repositories…</div>
                  ) : (
                    <select
                      className="input"
                      value={selectedRepo?.id ?? ''}
                      onChange={(e) => {
                        const repo = repos.find((r) => r.id === Number(e.target.value));
                        setSelectedRepo(repo ?? null);
                        if (repo && !projectName) setProjectName(repo.name);
                      }}
                    >
                      <option value="">Select repository…</option>
                      {repos.map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.full_name} {repo.is_private ? '🔒' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Project name */}
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

              {/* Description */}
              <div>
                <label className="label">Description <span className="text-gray-400">(optional)</span></label>
                <input
                  className="input"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Brief description…"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!selectedRepo || !projectName.trim() || createProject.isPending}
                >
                  {createProject.isPending ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
