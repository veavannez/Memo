import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MemoForm } from '../features/memos/MemoForm';
import { isDemoMode } from '../lib/demo';
import toast from 'react-hot-toast';
import { ArrowLeft, Clock } from 'lucide-react';

// Demo session tips — gives the form context in demo mode
const SESSION_TIPS = [
  'Be specific about what you completed — not just "worked on X", but "fixed Y bug in Z"',
  'The "Next Steps" field converts directly into Kanban tasks',
  'Mention blockers even if small — they\'re important for teammates',
  'GitHub activity (commits & PRs) will be automatically attached',
];

export default function CreateMemoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const isDemo = isDemoMode();

  const handleDemoSuccess = () => {
    toast.success('Session saved! Now convert your next steps into tasks.');
    // In demo mode navigate to the existing demo memo detail to show the CREATE TASKS flow
    navigate(`/projects/${projectId}/memos/1`);
  };

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8">

      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-sticky bg-sticky-yellow border-2 border-ink flex items-center justify-center text-xl">
            ✍️
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink leading-tight">End Session</h1>
            <p className="text-sm text-ink-muted">Leave context for your teammates — and future you.</p>
          </div>
        </div>

        {/* Workflow progress indicator */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {[
            { label: 'End Session',  color: 'bg-sticky-yellow', active: true  },
            { label: 'Create Tasks', color: 'bg-sticky-green',  active: false },
            { label: 'Kanban',       color: 'bg-sticky-blue',   active: false },
          ].map(({ label, color, active }) => (
            <div key={label} className={active ? 'workflow-step-active' : 'workflow-step'}>
              <span className={active ? 'workflow-step-dot-active' : 'workflow-step-dot'} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Tips strip in demo mode */}
      {isDemo && (
        <div className="sticky-blue sticky mb-6 text-sm">
          <p className="font-bold text-xs uppercase tracking-widest mb-2 opacity-60">Demo tip</p>
          <p className="text-ink-soft">
            This is a real form. Fill it in with sample data, hit <strong>End Session</strong>, and it will take you to the memo detail where you can convert next steps into tasks.
          </p>
        </div>
      )}

      {/* Form */}
      <div className="card-editorial p-6">
        <MemoForm
          projectId={projectId!}
          onSuccess={isDemo ? handleDemoSuccess : (memo) => navigate(`/projects/${projectId}/memos/${memo.id}`)}
          onCancel={() => navigate(`/projects/${projectId}`)}
        />
      </div>

      {/* Side tips */}
      <div className="mt-6 space-y-2">
        {SESSION_TIPS.map((tip, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-ink-muted">
            <span className="text-sticky-yellow flex-shrink-0 mt-0.5">→</span>
            {tip}
          </div>
        ))}
      </div>
    </div>
  );
}
