import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import type { Memo } from '../../types';
import { GitCommit, GitPullRequest, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface MemoFormValues {
  completed: string;
  in_progress: string;
  blocked: string;
  next_steps: string;
  notes: string;
  is_draft: boolean;
}

const empty: MemoFormValues = {
  completed: '',
  in_progress: '',
  blocked: '',
  next_steps: '',
  notes: '',
  is_draft: false,
};

interface MemoFormProps {
  projectId: string;
  initial?: Memo;
  onSuccess?: (memo: Memo) => void;
  onCancel?: () => void;
}

export function MemoForm({ projectId, initial, onSuccess, onCancel }: MemoFormProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<MemoFormValues>(
    initial
      ? {
          completed: initial.completed ?? '',
          in_progress: initial.in_progress ?? '',
          blocked: initial.blocked ?? '',
          next_steps: initial.next_steps ?? '',
          notes: initial.notes ?? '',
          is_draft: initial.is_draft,
        }
      : empty
  );
  const [showActivity, setShowActivity] = useState(false);

  const isEdit = !!initial;

  const mutation = useMutation({
    mutationFn: (data: MemoFormValues) =>
      isEdit
        ? api.patch(`/projects/${projectId}/memos/${initial!.id}`, data).then((r) => r.data)
        : api.post(`/projects/${projectId}/memos`, data).then((r) => r.data),
    onSuccess: (memo: Memo) => {
      queryClient.invalidateQueries({ queryKey: ['memos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success(isEdit ? 'Memo updated' : 'Memo saved!');
      onSuccess?.(memo);
    },
    onError: () => toast.error('Failed to save memo'),
  });

  const set = (key: keyof MemoFormValues) => (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent, draft: boolean) => {
    e.preventDefault();
    mutation.mutate({ ...values, is_draft: draft });
  };

  return (
    <form className="space-y-5">
      {/* Completed */}
      <Section
        label="Completed"
        hint="What did you finish this session?"
        value={values.completed}
        onChange={set('completed')}
        placeholder="- Fixed login validation bug&#10;- Deployed auth service to staging"
      />

      {/* In Progress */}
      <Section
        label="In Progress"
        hint="What are you actively working on right now?"
        value={values.in_progress}
        onChange={set('in_progress')}
        placeholder="Frontend auth integration"
        required
      />

      {/* Blocked */}
      <Section
        label="Blocked"
        hint="What is preventing you from continuing?"
        value={values.blocked}
        onChange={set('blocked')}
        placeholder="Waiting on API response format from backend team"
        icon={values.blocked ? <AlertCircle className="w-4 h-4 text-yellow-500" /> : undefined}
      />

      {/* Next Steps */}
      <Section
        label="Next Steps"
        hint="What should happen next? (one per line — can be converted to tasks)"
        value={values.next_steps}
        onChange={set('next_steps')}
        placeholder="- Connect frontend to new auth endpoint&#10;- Add expired-token handling&#10;- Update auth tests"
        rows={5}
      />

      {/* Notes */}
      <Section
        label="Notes"
        hint="Anything else another developer should know"
        value={values.notes}
        onChange={set('notes')}
        placeholder="The token format changed — see PR #42 for details"
      />

      {/* GitHub Activity preview (only for new memos) */}
      {!isEdit && (
        <div className="card border-dashed">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => setShowActivity(!showActivity)}
          >
            <span className="flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-gray-400" />
              GitHub activity will be automatically attached when you save
            </span>
            {showActivity ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showActivity && (
            <div className="px-4 pb-3 text-xs text-gray-400 border-t border-dashed border-gray-200 pt-3">
              Recent commits and pull requests from your GitHub account will be attached automatically.
              You can refresh activity after saving.
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={(e) => handleSubmit(e as any, true)}
          disabled={mutation.isPending}
        >
          Save as Draft
        </button>
        <button
          type="submit"
          className="btn-primary"
          onClick={(e) => handleSubmit(e as any, false)}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? 'Saving…'
            : isEdit
            ? 'Update Memo'
            : 'Save Memo / End Session'}
        </button>
      </div>
    </form>
  );
}

function Section({
  label,
  hint,
  value,
  onChange,
  placeholder,
  required,
  rows = 3,
  icon,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <label className="label mb-0">{label}</label>
        {required && <span className="text-red-400 text-xs">*</span>}
      </div>
      <p className="text-xs text-gray-400 mb-1.5">{hint}</p>
      <textarea
        className="textarea"
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}
