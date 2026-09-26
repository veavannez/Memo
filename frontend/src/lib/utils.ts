import { format, formatDistanceToNow } from 'date-fns';

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    done: 'Done',
  };
  return labels[status] ?? status;
}

export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  };
  return labels[priority] ?? priority;
}

export function statusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    todo: 'badge-todo',
    in_progress: 'badge-in-progress',
    blocked: 'badge-blocked',
    done: 'badge-done',
  };
  return classes[status] ?? 'badge';
}

export function priorityBadgeClass(priority: string): string {
  const classes: Record<string, string> = {
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  };
  return classes[priority] ?? 'badge';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}
