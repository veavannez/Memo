import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_TASKS, isDemoMode } from '../lib/demo';
import type { Task, TaskStatus } from '../types';
import { priorityBadgeClass, getPriorityLabel } from '../lib/utils';
import { Plus, X, List, AlertTriangle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

const COLUMNS: { status: TaskStatus; label: string; headerColor: string; dotColor: string }[] = [
  { status: 'todo',        label: 'To Do',      headerColor: 'border-border',        dotColor: 'bg-paper-dark' },
  { status: 'in_progress', label: 'In Progress', headerColor: 'border-sticky-blue',   dotColor: 'bg-sticky-blue' },
  { status: 'blocked',     label: 'Blocked',    headerColor: 'border-sticky-pink',   dotColor: 'bg-sticky-pink' },
  { status: 'done',        label: 'Done',       headerColor: 'border-sticky-green',  dotColor: 'bg-sticky-green' },
];

// ─── Task card ────────────────────────────────────────────────────────────────
function KanbanCard({
  task,
  onMoveNext,
  onMovePrev,
  onDragStart,
}: {
  task: Task;
  onMoveNext?: () => void;
  onMovePrev?: () => void;
  onDragStart?: (event: React.DragEvent) => void;
}) {
  return (
    <div draggable={!!onDragStart} onDragStart={onDragStart} className={`card p-3 mb-2 hover:border-ink/40 transition-colors ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''} ${task.status === 'blocked' ? 'border-sticky-pink/40' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'line-through text-ink-faint' : 'text-ink'}`}>
          {task.title}
        </p>
        <span className={`${priorityBadgeClass(task.priority)} flex-shrink-0`}>
          {getPriorityLabel(task.priority)}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-ink-muted mb-2 line-clamp-2">{task.description}</p>
      )}

      {task.ai_generated && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded bg-sticky-lavender/40 border border-sticky-lavender">MEMO SUGGESTED</span>
          <span className="text-[10px] text-ink-faint">Optional AI-generated task</span>
        </div>
      )}

      {(task.source_evidence?.length ?? 0) > 0 && (
        <div className="mb-2 space-y-0.5">
          {(task.source_evidence ?? []).slice(0, 2).map((item) => item.startsWith('http') ? (
            <a key={item} href={item} target="_blank" rel="noreferrer" className="block text-[10px] text-ink-muted underline truncate">GitHub evidence ↗</a>
          ) : <p key={item} className="text-[10px] font-mono text-ink-faint truncate">{item}</p>)}
        </div>
      )}
      {task.status === 'blocked' && (
        <p className="text-xs text-sticky-pink flex items-center gap-1 mb-2">
          <AlertTriangle className="w-3 h-3" /> Blocked
        </p>
      )}

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {task.assignee ? (
            task.assignee.avatar_url ? (
              <img
                src={task.assignee.avatar_url}
                alt={task.assignee.display_name}
                className="w-5 h-5 rounded-full"
                title={task.assignee.display_name}
              />
            ) : (
              <div
                className="w-5 h-5 rounded-full bg-sticky-blue flex items-center justify-center text-[9px] font-bold text-ink"
                title={task.assignee.display_name}
              >
                {task.assignee.display_name[0]}
              </div>
            )
          ) : (
            <div className="w-5 h-5 rounded-full bg-paper-dark border border-dashed border-border" />
          )}
          {task.source_memo_id && (
            <span className="text-[11px] font-mono text-ink-faint">from memo</span>
          )}
        </div>
        {/* Move buttons */}
        <div className="flex gap-0.5">
          {onMovePrev && (
            <button
              onClick={onMovePrev}
              className="text-xs text-ink-faint hover:text-ink px-1.5 py-0.5 rounded hover:bg-paper-dark transition-colors"
              title="Move left"
            >
              ←
            </button>
          )}
          {onMoveNext && (
            <button
              onClick={onMoveNext}
              className="text-xs text-ink-faint hover:text-ink px-1.5 py-0.5 rounded hover:bg-paper-dark transition-colors"
              title="Move right"
            >
              →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inline add form ──────────────────────────────────────────────────────────
function AddTaskInline({
  projectId,
  status,
  onClose,
}: {
  projectId: string;
  status: TaskStatus;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const createTask = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/tasks`, {
        title: title.trim(),
        status,
        priority: 'medium',
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task created');
      onClose();
    },
    onError: () => toast.error('Failed to create task'),
  });

  return (
    <div className="card p-3 mb-2 border-ink/30">
      <input
        className="input mb-2 text-sm"
        autoFocus
        placeholder="Task title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) createTask.mutate();
          if (e.key === 'Escape') onClose();
        }}
      />
      <div className="flex gap-1.5">
        <button
          className="btn-primary text-xs py-1 px-3"
          onClick={() => title.trim() && createTask.mutate()}
          disabled={!title.trim() || createTask.isPending}
        >
          Add
        </button>
        <button className="btn-ghost text-xs py-1 px-2" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const isDemo = isDemoMode();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', projectId],
    queryFn: () => {
      if (isDemo) return Promise.resolve(DEMO_TASKS);
      return api.get(`/projects/${projectId}/tasks`).then((r) => r.data);
    },
    enabled: !!projectId,
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) => {
      if (isDemo) return Promise.resolve({});
      return api.patch(`/projects/${projectId}/tasks/${taskId}`, { status }).then((r) => r.data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: () => toast.error('Failed to update task'),
  });

  const getAdjacentStatus = (status: TaskStatus, dir: 'next' | 'prev'): TaskStatus | null => {
    const idx = COLUMNS.findIndex((c) => c.status === status);
    if (dir === 'next' && idx < COLUMNS.length - 1) return COLUMNS[idx + 1].status;
    if (dir === 'prev' && idx > 0) return COLUMNS[idx - 1].status;
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter((t) => t.status === 'done').length;
  const progress   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="px-5 sm:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-full flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">Kanban</h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-ink-muted">{doneTasks}/{totalTasks} done</p>
            {/* Progress bar */}
            <div className="w-32 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-sticky-green transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-ink-faint">{progress}%</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link to={`/projects/${projectId}/tasks`} className="btn-secondary text-sm">
            <List className="w-4 h-4" />
            List view
          </Link>
          <Link to={`/projects/${projectId}/catch-me-up`} className="btn-catch-me-up text-sm">
            <Zap className="w-4 h-4" />
            Catch Me Up
          </Link>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(({ status, label, headerColor, dotColor }) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="w-72 flex-shrink-0" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const taskId = Number(event.dataTransfer.getData('text/task-id')); if (taskId) updateTask.mutate({ taskId, status }); }}>
              {/* Column header */}
              <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${headerColor}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor} border border-ink/10`} />
                  <span className="text-sm font-bold text-ink">{label}</span>
                  <span className="text-xs font-mono text-ink-faint bg-paper-dark px-1.5 py-0.5 rounded-pill">
                    {colTasks.length}
                  </span>
                </div>
                {!isDemo && (
                  <button
                    className="text-ink-faint hover:text-ink transition-colors"
                    onClick={() => setAddingTo(status)}
                    title="Add task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Add inline form */}
              {addingTo === status && !isDemo && (
                <AddTaskInline
                  projectId={projectId!}
                  status={status}
                  onClose={() => setAddingTo(null)}
                />
              )}

              {/* Tasks */}
              {colTasks.length === 0 && addingTo !== status ? (
                <div className="border-2 border-dashed border-border rounded-card h-20 flex items-center justify-center">
                  <span className="text-xs text-ink-faint">
                    {status === 'done' ? '🎉 Empty' : 'No tasks'}
                  </span>
                </div>
              ) : (
                colTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onDragStart={!isDemo ? (event) => event.dataTransfer.setData('text/task-id', String(task.id)) : undefined}
                    onMoveNext={!isDemo ? () => {
                      const next = getAdjacentStatus(task.status, 'next');
                      if (next) updateTask.mutate({ taskId: task.id, status: next });
                    } : undefined}
                    onMovePrev={!isDemo ? () => {
                      const prev = getAdjacentStatus(task.status, 'prev');
                      if (prev) updateTask.mutate({ taskId: task.id, status: prev });
                    } : undefined}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
