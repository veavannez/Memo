import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { DEMO_TASKS, isDemoMode } from '../lib/demo';
import type { Task, TaskStatus, TaskPriority } from '../types';
import {
  statusBadgeClass, priorityBadgeClass, getStatusLabel, getPriorityLabel, timeAgo,
} from '../lib/utils';
import { Plus, Kanban, ArrowRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_FILTERS: { value: TaskStatus | ''; label: string; color: string }[] = [
  { value: '',            label: 'All',         color: '' },
  { value: 'todo',        label: 'To Do',        color: 'bg-paper-dark' },
  { value: 'in_progress', label: 'In Progress',  color: 'bg-sticky-blue' },
  { value: 'blocked',     label: 'Blocked',      color: 'bg-sticky-pink' },
  { value: 'done',        label: 'Done',         color: 'bg-sticky-green' },
];

export default function TasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const isDemo = isDemoMode();

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', projectId, filterStatus],
    queryFn: () => {
      if (isDemo) {
        const all = DEMO_TASKS;
        return Promise.resolve(filterStatus ? all.filter((t) => t.status === filterStatus) : all);
      }
      return api
        .get(`/projects/${projectId}/tasks${filterStatus ? `?status=${filterStatus}` : ''}`)
        .then((r) => r.data);
    },
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/tasks`, {
        title: newTitle.trim(),
        status: 'todo',
        priority: newPriority,
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task created');
      setNewTitle('');
      setShowCreate(false);
    },
    onError: () => toast.error('Failed to create task'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: string }) => {
      if (isDemo) return Promise.resolve({});
      return api.patch(`/projects/${projectId}/tasks/${taskId}`, { status }).then((r) => r.data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: () => toast.error('Failed to update status'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">Tasks</h1>
          <p className="text-sm text-ink-muted">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {blockedCount > 0 && (
              <span className="ml-2 text-sticky-pink flex items-center gap-1 inline-flex">
                <AlertTriangle className="w-3.5 h-3.5" /> {blockedCount} blocked
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link to={`/projects/${projectId}/kanban`} className="btn-secondary text-sm">
            <Kanban className="w-4 h-4" />
            Kanban view
          </Link>
          {!isDemo && (
            <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {STATUS_FILTERS.map(({ value, label, color }) => {
          const active = filterStatus === value;
          const count = value ? tasks.filter((t) => t.status === value).length : tasks.length;
          return (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold
                border-2 transition-all duration-150
                ${active
                  ? 'bg-ink text-paper-cream border-ink shadow-editorial-sm hover:shadow-none hover:translate-x-px hover:translate-y-px'
                  : 'bg-paper-cream text-ink-muted border-border hover:border-ink hover:text-ink'
                }
              `}
            >
              {color && active && <span className={`w-2 h-2 rounded-full ${color}`} />}
              {label}
              <span className={`${active ? 'text-paper-cream/70' : 'text-ink-faint'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inline create form */}
      {showCreate && !isDemo && (
        <div className="card-editorial p-4 mb-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48">
              <label className="label">Title</label>
              <input
                className="input"
                autoFocus
                placeholder="Task title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && createTask.mutate()}
              />
            </div>
            <div className="w-32">
              <label className="label">Priority</label>
              <select
                className="select"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <button
              className="btn-primary text-sm"
              onClick={() => newTitle.trim() && createTask.mutate()}
              disabled={!newTitle.trim() || createTask.isPending}
            >
              {createTask.isPending ? 'Adding…' : 'Add Task'}
            </button>
            <button className="btn-ghost text-sm" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="card-editorial p-12 text-center">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Kanban className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-ink text-lg mb-2">No tasks yet</h3>
            <p className="text-ink-muted text-sm mb-5">
              Create tasks manually or convert next steps from a memo.
            </p>
            <Link
              to={`/projects/${projectId}/memos`}
              className="btn-create-tasks text-sm"
            >
              <ArrowRight className="w-4 h-4" />
              Go to Memos
            </Link>
          </div>
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-paper-dark/50 transition-colors">
              {/* Priority indicator */}
              <div className={`w-1 h-full min-h-[2rem] rounded-full flex-shrink-0 mt-1
                ${task.priority === 'high' ? 'bg-sticky-pink' : task.priority === 'medium' ? 'bg-sticky-orange' : 'bg-border'}
              `} />

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-ink-faint' : 'text-ink'}`}>
                    {task.title}
                  </span>
                  {task.source_memo_id && (
                    <Link
                      to={`/projects/${projectId}/memos/${task.source_memo_id}`}
                      className="text-[11px] font-mono text-ink-faint hover:text-ink transition-colors"
                    >
                      from memo →
                    </Link>
                  )}
                </div>
                {task.description && (
                  <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {task.assignee && (
                    <span className="flex items-center gap-1 text-xs text-ink-muted">
                      {task.assignee.avatar_url ? (
                        <img src={task.assignee.avatar_url} className="w-4 h-4 rounded-full" alt="" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-sticky-blue flex items-center justify-center text-[9px] font-bold text-ink">
                          {task.assignee.display_name[0]}
                        </div>
                      )}
                      {task.assignee.display_name}
                    </span>
                  )}
                  <span className="text-xs text-ink-faint">{timeAgo(task.created_at)}</span>
                </div>
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={priorityBadgeClass(task.priority)}>
                  {getPriorityLabel(task.priority)}
                </span>
                {!isDemo ? (
                  <select
                    className="text-xs border-2 border-border rounded-editorial px-2 py-1 text-ink bg-paper-cream focus:border-ink focus:outline-none"
                    value={task.status}
                    onChange={(e) => updateStatus.mutate({ taskId: task.id, status: e.target.value })}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <span className={statusBadgeClass(task.status)}>
                    {getStatusLabel(task.status)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-6 flex items-center gap-3">
        <Link to={`/projects/${projectId}/kanban`} className="btn-primary text-sm">
          <Kanban className="w-4 h-4" />
          View Kanban Board
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
