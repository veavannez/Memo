import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MemoForm } from '../features/memos/MemoForm';
import { isDemoMode, DEMO_SESSION_CONTEXT } from '../lib/demo';
import toast from 'react-hot-toast';
import { ArrowLeft, GitBranch, GitCommit, GitPullRequest } from 'lucide-react';

export default function CreateMemoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const isDemo = isDemoMode();

  const handleDemoSuccess = () => {
    toast.success('Session saved.');
    navigate(`/projects/${projectId}/memos/1`);
  };

  // In demo mode we pass the pre-built session context.
  // In real mode it would come from a GitHub API prefetch (future).
  const ctx = isDemo ? DEMO_SESSION_CONTEXT : undefined;

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Dashboard
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between mb-8 gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-ink leading-tight mb-1">End Session</h1>
          <p className="text-sm text-ink-muted">
            Document your state before you close the laptop.
          </p>
        </div>

        {/* Live session context summary — only when we have it */}
        {ctx && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 activity-pill">
              <GitBranch className="w-3.5 h-3.5 text-ink-muted" />
              <code className="font-mono text-xs">{ctx.branch}</code>
            </div>
            <div className="flex items-center gap-1.5 activity-pill">
              <GitCommit className="w-3.5 h-3.5 text-ink-muted" />
              <span>{ctx.commits.length} commit{ctx.commits.length > 1 ? 's' : ''}</span>
            </div>
            {ctx.pull_requests.length > 0 && (
              <div className="flex items-center gap-1.5 activity-pill">
                <GitPullRequest className="w-3.5 h-3.5 text-ink-muted" />
                <span>{ctx.pull_requests.length} PR{ctx.pull_requests.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflow progress */}
      <div className="flex items-center gap-2 mb-8 pb-6 border-b border-border flex-wrap">
        {[
          { label: 'End Session',  active: true  },
          { label: 'Create Tasks', active: false },
          { label: 'Kanban',       active: false },
          { label: 'Catch Me Up',  active: false },
        ].map(({ label, active }, i) => (
          <React.Fragment key={label}>
            <div className={active ? 'workflow-step-active' : 'workflow-step'}>
              <span className={active ? 'workflow-step-dot-active' : 'workflow-step-dot'} />
              {label}
            </div>
            {i < 3 && <span className="text-ink-faint text-xs">→</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Form — handles the GitHub context panel internally */}
      <MemoForm
        projectId={projectId!}
        sessionContext={ctx}
        onSuccess={isDemo
          ? handleDemoSuccess
          : (memo) => navigate(`/projects/${projectId}/memos/${memo.id}`)
        }
        onCancel={() => navigate(`/projects/${projectId}`)}
      />
    </div>
  );
}
