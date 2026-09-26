import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Task, TaskStatus, ProjectMember } from '../types';
import { statusBadgeClass, priorityBadgeClass, getStatusLabel, getPriorityLabel } from '../lib/utils';
import { Plus, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'To Do', color: 'border-gray-200' },
  { status: 'in_progress', label: 'In Progress', color: 'border-blue-200' },
  { status: 'blocked', label: 'Blocked', color: 'border-yellow-200' },
  { status: 'done', label: 'Done', color: 'border-green-200' },
];

function TaskCard({
  task,
  onMoveNext,
  onMovePrev,
  members,
}: {
  task: Task;
  onMoveNext?: () => void;
  onMovePrev?: () => void;
  members: ProjectMember[];
}) {
  return (
    <div className="card p-3 mb-2 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
        <span className={`${priorityBadgeClass(task.priority)} flex-shrink-0`}>
          {getPriorityLabel(task.priority)}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {task.assignee?.avatar_url ? (
            <img
              src={task.assignee.avatar_url}
              alt={task.assignee.display_name}
              className="w-5 h-5 rounded-full"
              title={task.assignee.display_name}
            />
          ) : task.assignee ? (
            <div
              className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600"
              title={task.assignee.display_name}
            >
              {task.assignee.display_name[0].toUpperCase()}
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-100 border border-dashed border-gray-300" />
          )}
          {task.source_memo_id && (
            <span className="text-xs text-gray-400">from memo</span>
          )}
        </div>
        <div className="flex gap-1">
          {onMovePrev && (
            <button
              onClick={onMovePrev}
              className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100"
            >
              ←
            </button>
          )}
          {onMoveNext && (
            <button
              onClick={onMoveNext}
              className="text-xs text-gray-400 hover:text-gray-700 px-1.5 py-0.5 rounded hover:bg-gray-100"
            >
              →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddTaskInline({
  projectId,
  status,
  members,
  onClose,
}: {
  projectId: string;
  status: TaskStatus;
  members: ProjectMember[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  const createTask = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/tasks`, {
        title: title.trim(),
        status,
        priority: 'medium',
        assignee_id: assigneeId ? Number(assigneeId) : undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task created');
      onClose();
    },
    onError: () => toast.error('Failed to create task'),
  });

  return (
    <div className="card p-3 mb-2">
      <input
        className="input mb-2"
        autoFocus
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) createTask.mutate();
          if (e.key === 'Escape') onClose();
        }}
      />
      {members.length > 0 && (
        <select
          className="input mb-2 text-xs"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.user?.display_name}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-1.5">
        <button
          className="btn-primary text-xs py-1 px-2"
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

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', projectId],
    queryFn: () => api.get(`/projects/${projectId}/tasks`).then((r) => r.data),
    enabled: !!projectId,
  });

  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ['members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then((r) => r.data),
    enabled: !!projectId,
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) =>
      api.patch(`/projects/${projectId}/tasks/${taskId}`, { status }).then((r) => r.data),
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
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Kanban</h1>
        <Link to={`/projects/${projectId}/tasks`} className="btn-secondary text-sm">
          List view
        </Link>
      </div>

      <div className="flex gap-4 min-w-max pb-4">
        {COLUMNS.map(({ status, label, color }) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="w-72 flex-shrink-0">
              <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${color}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  className="text-gray-400 hover:text-gray-700"
                  onClick={() => setAddingTo(status)}
                  title="Add task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {addingTo === status && (
                <AddTaskInline
                  projectId={projectId!}
                  status={status}
                  members={members}
                  onClose={() => setAddingTo(null)}
                />
              )}

              {colTasks.length === 0 && addingTo !== status ? (
                <div className="border-2 border-dashed border-gray-100 rounded-lg h-20 flex items-center justify-center">
                  <span className="text-xs text-gray-300">Drop tasks here</span>
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    members={members}
                    onMoveNext={() => {
                      const next = getAdjacentStatus(task.status, 'next');
                      if (next) updateTask.mutate({ taskId: task.id, status: next });
                    }}
                    onMovePrev={() => {
                      const prev = getAdjacentStatus(task.status, 'prev');
                      if (prev) updateTask.mutate({ taskId: task.id, status: prev });
                    }}
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
