import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MemoForm } from '../features/memos/MemoForm';

export default function CreateMemoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Memo</h1>
        <p className="text-sm text-gray-500 mt-1">
          End your session with context for your team
        </p>
      </div>
      <div className="card p-6">
        <MemoForm
          projectId={projectId!}
          onSuccess={(memo) => navigate(`/projects/${projectId}/memos/${memo.id}`)}
          onCancel={() => navigate(`/projects/${projectId}`)}
        />
      </div>
    </div>
  );
}
