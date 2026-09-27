import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
  DEMO_PROJECT, DEMO_REPO, isDemoMode,
} from '../lib/demo';
import type { Repository, Installation, Project } from '../types';
import {
  GitBranch, Lock, Globe, ArrowRight, Check, Search,
  AlertCircle, RefreshCw, ExternalLink, Star, GitCommit,
  ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { timeAgo } from '../lib/utils';
import toast from 'react-hot-toast';

// ─── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-card bg-sticky-pink/8 border border-red-200">
      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink font-medium">GitHub connection error</p>
        <p className="text-xs text-ink-muted mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-ink-soft transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Repository card ──────────────────────────────────────────────────────────

function RepoCard({
  repo,
  isSelected,
  onClick,
}: {
  repo: Repository;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-card border-2 transition-all duration-150
        ${isSelected
          ? 'border-ink bg-paper-dark shadow-memo'
          : 'border-border hover:border-ink/30 hover:bg-paper-dark'
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Visibility icon */}
          <div className="flex-shrink-0 mt-0.5">
            {repo.is_private
              ? <Lock className="w-4 h-4 text-ink-faint" />
              : <Globe className="w-4 h-4 text-ink-faint" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-ink truncate">
                {repo.full_name}
              </span>
              {repo.is_private && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-paper-dark border border-border text-ink-muted">
                  PRIVATE
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] font-mono text-ink-faint">
                <GitBranch className="w-3 h-3" />
                {repo.default_branch}
              </span>
            </div>
          </div>
        </div>
        {/* Selection indicator */}
        <div className={`
          w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
          ${isSelected ? 'bg-ink border-ink' : 'border-border'}
        `}>
          {isSelected && <Check className="w-3 h-3 text-paper" />}
        </div>
      </div>
    </button>
  );
}

// ─── Installation group ───────────────────────────────────────────────────────

function InstallationGroup({
  installation,
  repos,
  selectedRepoId,
  onSelect,
  searchQuery,
}: {
  installation: Installation;
  repos: Repository[];
  selectedRepoId: number | null;
  onSelect: (repo: Repository) => void;
  searchQuery: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const filtered = repos.filter((r) =>
    searchQuery ? r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  if (filtered.length === 0) return null;

  return (
    <div className="card-editorial overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between p-4 hover:bg-paper-dark transition-colors"
      >
        <div className="flex items-center gap-3">
          {installation.account_avatar_url && (
            <img
              src={installation.account_avatar_url}
              alt={installation.account_login}
              className="w-6 h-6 rounded-full border border-border"
            />
          )}
          <div className="text-left">
            <p className="text-sm font-bold text-ink">{installation.account_login}</p>
            <p className="text-xs text-ink-muted">
              {filtered.length} repo{filtered.length !== 1 ? 's' : ''}
              {installation.account_type === 'Organization' ? ' · Organization' : ''}
            </p>
          </div>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-ink-faint" />
          : <ChevronUp className="w-4 h-4 text-ink-faint" />
        }
      </button>

      {!collapsed && (
        <div className="border-t border-border divide-y divide-border/50 px-4 py-2 space-y-2 pb-4">
          {filtered.map((repo) => (
            <div key={repo.id} className="pt-2 first:pt-0">
              <RepoCard
                repo={repo}
                isSelected={selectedRepoId === repo.id}
                onClick={() => onSelect(repo)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RepositorySelectionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDemo = isDemoMode();

  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [search, setSearch] = useState('');
  const [step, setStep] = useState<'select' | 'configure'>('select');

  // ── Fetch installations ──────────────────────────────────────────────────
  const {
    data: installations = [],
    isLoading: loadingInstalls,
    error: installError,
    refetch: refetchInstalls,
  } = useQuery<Installation[]>({
    queryKey: ['github-installations'],
    queryFn: async () => {
      if (isDemo) return [];
      return api.get('/github/installations').then((r) => r.data);
    },
    enabled: !isDemo,
    retry: 1,
  });

  // ── Fetch repositories per installation ──────────────────────────────────
  const repoQueries = installations.map((inst) => ({
    queryKey: ['github-repos', inst.installation_id],
    queryFn: () =>
      api
        .get(`/github/installations/${inst.installation_id}/repositories`)
        .then((r) => r.data as Repository[]),
    enabled: !isDemo && installations.length > 0,
    retry: 1,
  }));

  // Manually combine — useQueries would be ideal but we keep dep surface small
  const [reposByInstall, setReposByInstall] = useState<Map<number, Repository[]>>(new Map());
  React.useEffect(() => {
    if (isDemo || installations.length === 0) return;
    const map = new Map<number, Repository[]>();
    Promise.all(
      installations.map((inst) =>
        api
          .get(`/github/installations/${inst.installation_id}/repositories`)
          .then((r) => ({ instId: inst.id, repos: r.data as Repository[] }))
          .catch(() => ({ instId: inst.id, repos: [] }))
      )
    ).then((results) => {
      results.forEach(({ instId, repos }) => map.set(instId, repos));
      setReposByInstall(new Map(map));
    });
  }, [installations]);

  const allRepos = Array.from(reposByInstall.values()).flat();

  // ── Create project mutation ───────────────────────────────────────────────
  const createProject = useMutation({
    mutationFn: (data: { name: string; description?: string; repository_id: number }) =>
      api.post('/projects', data).then((r) => r.data as Project),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Project "${project.name}" created!`);
      navigate(`/projects/${project.id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? 'Failed to create project';
      toast.error(msg);
    },
  });

  const handleRepoSelect = (repo: Repository) => {
    setSelectedRepo(repo);
    setProjectName(repo.name.replace(/-/g, ' ').replace(/_/g, ' '));
  };

  const handleContinue = () => {
    if (!selectedRepo) return;
    setStep('configure');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo || !projectName.trim()) return;
    createProject.mutate({
      name: projectName.trim(),
      description: projectDesc.trim() || undefined,
      repository_id: selectedRepo.id,
    });
  };

  // ─── Demo mode shortcut ────────────────────────────────────────────────────
  if (isDemo) {
    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        <div className="mb-8">
          <h1 className="font-display text-display-lg text-ink tracking-wide mb-1">
            CONNECT REPOSITORY
          </h1>
          <p className="text-sm text-ink-muted">Demo mode — using sample repository.</p>
        </div>
        <div className="card-editorial p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-sticky bg-sticky-green border-2 border-ink flex items-center justify-center flex-shrink-0">
              <GitBranch className="w-5 h-5 text-ink" />
            </div>
            <div>
              <p className="font-mono font-bold text-ink">{DEMO_REPO.full_name}</p>
              <p className="text-xs text-ink-muted">TypeScript · Public · main</p>
            </div>
          </div>
          <p className="text-sm text-ink-muted mb-5">
            In demo mode, MEMO uses sample data from <code className="font-mono text-xs bg-paper-dark px-1 py-0.5 rounded">alexrivera/auth-service</code>.
          </p>
          <button
            onClick={() => navigate(`/projects/${DEMO_PROJECT.id}`)}
            className="btn-primary w-full"
          >
            Open Demo Project
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Configure step ────────────────────────────────────────────────────────
  if (step === 'configure' && selectedRepo) {
    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-10">
        <button
          onClick={() => setStep('select')}
          className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6"
        >
          ← Back to repositories
        </button>

        <div className="mb-8">
          <h1 className="font-display text-display-lg text-ink tracking-wide mb-1">
            NAME YOUR PROJECT
          </h1>
          <p className="text-sm text-ink-muted">
            Configure your MEMO project for{' '}
            <code className="font-mono text-xs bg-paper-dark px-1 rounded">{selectedRepo.full_name}</code>.
          </p>
        </div>

        {/* Selected repo summary */}
        <div className="card p-4 mb-6 flex items-center gap-3">
          {selectedRepo.is_private
            ? <Lock className="w-4 h-4 text-ink-faint flex-shrink-0" />
            : <Globe className="w-4 h-4 text-ink-faint flex-shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-semibold text-ink truncate">{selectedRepo.full_name}</p>
            <p className="text-xs font-mono text-ink-faint">{selectedRepo.default_branch}</p>
          </div>
          <Check className="w-4 h-4 text-sticky-green flex-shrink-0" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Project Name</label>
            <input
              className="input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Auth Service"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">
              Description{' '}
              <span className="text-ink-faint font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              className="input"
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              placeholder="Brief description of this project…"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setStep('select')}
            >
              Back
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={!projectName.trim() || createProject.isPending}
            >
              {createProject.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  Create Project
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ─── Select step (main) ────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-display-lg text-ink tracking-wide mb-1">
            SELECT REPOSITORY
          </h1>
          <p className="text-sm text-ink-muted">
            Choose a GitHub repository for MEMO to monitor.
          </p>
        </div>
        <a
          href={`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG || 'memo-workspace'}/installations/new`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs flex-shrink-0 hidden sm:flex"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Install on more accounts
        </a>
      </div>

      {/* Error state */}
      {installError && (
        <div className="mb-6">
          <ErrorBanner
            message="Could not fetch GitHub installations. Make sure the MEMO GitHub App is installed."
            onRetry={() => refetchInstalls()}
          />
          <div className="mt-4 card p-4 border-dashed">
            <p className="text-xs font-bold text-ink mb-2">Install the GitHub App</p>
            <p className="text-xs text-ink-muted mb-3">
              MEMO needs to be installed on your GitHub account or organisation to access repositories.
            </p>
            <a
              href={`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG || 'memo-workspace'}/installations/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-xs inline-flex"
            >
              Install GitHub App →
            </a>
          </div>
        </div>
      )}

      {/* Loading */}
      {loadingInstalls && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-ink-faint" />
          <p className="text-sm text-ink-muted">Fetching your GitHub installations…</p>
        </div>
      )}

      {/* No installations */}
      {!loadingInstalls && !installError && installations.length === 0 && (
        <div className="card-editorial p-10 text-center">
          <div className="empty-state">
            <div className="empty-state-icon">
              <GitBranch className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-ink text-lg mb-2">No GitHub installations found</h3>
            <p className="text-ink-muted text-sm mb-6 max-w-sm">
              Install the MEMO GitHub App on your account or organisation to grant access to repositories.
            </p>
            <a
              href={`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG || 'memo-workspace'}/installations/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex"
            >
              Install GitHub App →
            </a>
          </div>
        </div>
      )}

      {/* Repository list */}
      {!loadingInstalls && installations.length > 0 && (
        <>
          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
            <input
              className="input pl-9"
              placeholder="Filter repositories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {installations.map((inst) => (
              <InstallationGroup
                key={inst.id}
                installation={inst}
                repos={reposByInstall.get(inst.id) ?? []}
                selectedRepoId={selectedRepo?.id ?? null}
                onSelect={handleRepoSelect}
                searchQuery={search}
              />
            ))}
          </div>
        </>
      )}

      {/* Continue bar */}
      {selectedRepo && (
        <div className="sticky bottom-6 mt-6">
          <div className="card-editorial p-4 flex items-center justify-between gap-4 shadow-memo-lg">
            <div className="min-w-0">
              <p className="text-xs text-ink-muted mb-0.5">Selected repository</p>
              <p className="font-mono text-sm font-bold text-ink truncate">{selectedRepo.full_name}</p>
            </div>
            <button
              onClick={handleContinue}
              className="btn-primary flex-shrink-0"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
