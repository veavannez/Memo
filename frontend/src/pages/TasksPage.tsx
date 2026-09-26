import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Task, TaskStatus, TaskPriority, ProjectMember } from '../types';
import {
  statusBadgeClass, priorityBadgeClass, getStatusLabel, getPriorityLabel, timeAgo,
} from '../lib/utils';
import { Plus, Kanban, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newAssigneeId, setNewAssigneeId] = useState('');

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', projectId, filterStatus],
    queryFn: () =>
      api.get(`/projects/${projectId}/tasks${filterStatus ? `?status=${filterStatus}` : ''}`).then(
        (r) => r.data
      ),
    enabled: !!projectId,
  });

  const { data: members = [] } = useQuery<ProjectMember[]>({
    queryKey: ['members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then((r) => r.data),
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/tasks`, {
        title: newTitle.trim(),
        status: 'todo',
        priority: newPriority,
        assignee_id: newAssigneeId ? Number(newAssigneeId) : undefined,
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
    mutationFn: ({ taskId, status }: { taskId: number; status: string }) =>
      api.patch(`/projects/${projectId}/tasks/${taskId}`, { status }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: () => toast.error('Failed to update status'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tasks.length} total</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/projects/${projectId}/kanban`} className="btn-secondary">
            <Kanban className="w-4 h-4" />
            Kanban
          </Link>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['', 'todo', 'in_progress', 'blocked', 'done'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterStatus === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {s === '' ? 'All' : getStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-4 mb-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
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
                className="input"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            {members.length > 0 && (
              <div className="w-40">
                <label className="label">Assign to</label>
                <select
                  className="input"
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user?.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              className="btn-primary"
              onClick={() => newTitle.trim() && createTask.mutate()}
              disabled={!newTitle.trim() || createTask.isPending}
            >
              {createTask.isPending ? 'Adding…' : 'Add'}
            </button>
            <button className="btn-ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm mb-3">No tasks yet</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            Create first task
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{task.title}</span>
                  {task.source_memo_id && (
                    <Link
                      to={`/projects/${projectId}/memos/${task.source_memo_id}`}
                      className="text-xs text-gray-400 hover:text-blue-600"
                    >
                      from memo
                    </Link>
                  )}
                </div>
                {task.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {task.assignee && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      {task.assignee.avatar_url && (
                        <img
                          src={task.assignee.avatar_url}
                          className="w-4 h-4 rounded-full"
                          alt=""
                        />
                      )}
                      {task.assignee.display_name}
                    </span>
                  )}
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{timeAgo(task.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={priorityBadgeClass(task.priority)}>
                  {getPriorityLabel(task.priority)}
                </span>
                <select
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:outline-none focus:border-gray-400"
                  value={task.status}
                  onChange={(e) =>
                    updateStatus.mutate({ taskId: task.id, status: e.target.value })
                  }
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
