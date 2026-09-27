/**
 * MEMO Design System — Reusable UI primitives
 * Every component here enforces the editorial + scrapbook visual language.
 */
import React from 'react';
import { getInitials } from '../lib/utils';

// ─────────────────────────────────────────────────────────
// SectionHeading
// ─────────────────────────────────────────────────────────
interface SectionHeadingProps {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}
export function SectionHeading({ children, action, className = '' }: SectionHeadingProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <h2 className="section-heading">{children}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// StickyNote
// ─────────────────────────────────────────────────────────
type StickyColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'lavender';
interface StickyNoteProps {
  children: React.ReactNode;
  color?: StickyColor;
  rotate?: '-2' | '-1' | '0' | '1' | '2';
  label?: string;
  className?: string;
}
const stickyBg: Record<StickyColor, string> = {
  yellow:   'bg-sticky-yellow',
  green:    'bg-sticky-green',
  pink:     'bg-sticky-pink',
  blue:     'bg-sticky-blue',
  orange:   'bg-sticky-orange',
  lavender: 'bg-sticky-lavender',
};
const stickyRotate: Record<string, string> = {
  '-2': '-rotate-2', '-1': '-rotate-1', '0': 'rotate-0', '1': 'rotate-1', '2': 'rotate-2',
};
export function StickyNote({ children, color = 'yellow', rotate = '0', label, className = '' }: StickyNoteProps) {
  return (
    <div className={`sticky ${stickyBg[color]} ${stickyRotate[rotate]} ${className}`}>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1.5 font-display">{label}</p>
      )}
      <div className="text-ink-soft">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────────────────────
const statusMap: Record<string, { cls: string; label: string }> = {
  todo:        { cls: 'badge-todo',        label: 'To Do' },
  in_progress: { cls: 'badge-in-progress', label: 'In Progress' },
  blocked:     { cls: 'badge-blocked',     label: 'Blocked' },
  done:        { cls: 'badge-done',        label: 'Done' },
};
export function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] ?? { cls: 'badge-todo', label: status };
  return <span className={s.cls}>{s.label}</span>;
}

// ─────────────────────────────────────────────────────────
// PriorityBadge
// ─────────────────────────────────────────────────────────
const priorityMap: Record<string, { cls: string; label: string }> = {
  high:   { cls: 'badge-high',   label: 'High' },
  medium: { cls: 'badge-medium', label: 'Med' },
  low:    { cls: 'badge-low',    label: 'Low' },
};
export function PriorityBadge({ priority }: { priority: string }) {
  const p = priorityMap[priority] ?? { cls: 'badge-low', label: priority };
  return <span className={p.cls}>{p.label}</span>;
}

// ─────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────
const avatarColors = [
  'bg-sticky-yellow', 'bg-sticky-green', 'bg-sticky-blue',
  'bg-sticky-orange', 'bg-sticky-lavender', 'bg-sticky-pink',
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}
interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const cls = `avatar-${size} ${getAvatarColor(name)} ${className}`;
  if (src) return <img src={src} alt={name} className={`avatar avatar-${size} object-cover ${className}`} />;
  return <div className={cls}>{getInitials(name)}</div>;
}

// ─────────────────────────────────────────────────────────
// AvatarStack
// ─────────────────────────────────────────────────────────
interface AvatarStackProps {
  users: Array<{ name: string; src?: string }>;
  max?: number;
  size?: 'sm' | 'md';
}
export function AvatarStack({ users, max = 4, size = 'sm' }: AvatarStackProps) {
  const visible = users.slice(0, max);
  const extra = users.length - max;
  return (
    <div className="avatar-stack items-center">
      {visible.map((u, i) => (
        <Avatar key={i} name={u.name} src={u.src} size={size} />
      ))}
      {extra > 0 && (
        <div className={`avatar avatar-${size} bg-paper-dark text-ink-muted text-xs -ml-2`}>
          +{extra}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BrowserFrame
// ─────────────────────────────────────────────────────────
interface BrowserFrameProps {
  url?: string;
  children: React.ReactNode;
  className?: string;
}
export function BrowserFrame({ url = 'memo.app', children, className = '' }: BrowserFrameProps) {
  return (
    <div className={`browser-frame ${className}`}>
      <div className="browser-chrome">
        <div className="browser-dot bg-sticky-pink" />
        <div className="browser-dot bg-sticky-yellow" />
        <div className="browser-dot bg-sticky-green" />
        <div className="flex-1 flex justify-center">
          <div className="bg-paper-cream border border-border rounded-pill px-4 py-0.5 text-xs font-mono text-ink-muted max-w-[200px] truncate">
            {url}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MemoCard
// ─────────────────────────────────────────────────────────
interface MemoCardProps {
  authorName: string;
  authorAvatar?: string;
  inProgress?: string;
  blocked?: string;
  timeAgo: string;
  commitCount?: number;
  prCount?: number;
  onClick?: () => void;
  className?: string;
}
export function MemoCard({
  authorName, authorAvatar, inProgress, blocked,
  timeAgo, commitCount = 0, prCount = 0, onClick, className = '',
}: MemoCardProps) {
  return (
    <div
      className={`card-collage p-4 cursor-pointer ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <Avatar name={authorName} src={authorAvatar} size="sm" />
        <div>
          <p className="text-sm font-semibold text-ink leading-tight font-display">{authorName}</p>
          <p className="text-xs text-ink-faint font-mono">{timeAgo}</p>
        </div>
      </div>
      {inProgress && (
        <p className="text-sm text-ink-soft line-clamp-2 mb-2 leading-snug">{inProgress}</p>
      )}
      {blocked && (
        <div className="sticky-pink rounded-editorial px-2 py-1 text-xs mt-2">
          🚧 {blocked}
        </div>
      )}
      {(commitCount > 0 || prCount > 0) && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
          {commitCount > 0 && (
            <span className="activity-pill">
              <span className="text-ink-faint">⬡</span> {commitCount}
            </span>
          )}
          {prCount > 0 && (
            <span className="activity-pill">
              <span className="text-ink-faint">⇄</span> {prCount} PR
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TaskCard
// ─────────────────────────────────────────────────────────
interface TaskCardProps {
  title: string;
  status: string;
  priority: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  fromMemo?: boolean;
  className?: string;
  actions?: React.ReactNode;
}
export function TaskCard({
  title, status, priority, assigneeName, assigneeAvatar, fromMemo, className = '', actions,
}: TaskCardProps) {
  return (
    <div className={`card p-3 border border-border ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-ink leading-snug flex-1">{title}</p>
        <PriorityBadge priority={priority} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {fromMemo && (
            <span className="text-[10px] font-mono text-ink-faint uppercase tracking-wide">from memo</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {assigneeName && <Avatar name={assigneeName} src={assigneeAvatar} size="sm" />}
          {actions}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ActivityCard
// ─────────────────────────────────────────────────────────
interface ActivityCardProps {
  type: 'commit' | 'pull_request' | 'issue';
  id: string;
  title: string;
  url?: string;
  authorLogin?: string;
  occurredAt?: string;
}
const activityIcon: Record<string, string> = {
  commit: '⬡', pull_request: '⇄', issue: '◎',
};
export function ActivityCard({ type, id, title, url, authorLogin }: ActivityCardProps) {
  const content = (
    <div className="flex items-start gap-2.5 py-2">
      <span className="text-ink-faint text-sm mt-0.5 font-mono">{activityIcon[type] ?? '·'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-soft truncate leading-snug">{title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <code className="text-[11px] font-mono text-ink-faint">{id.slice(0, 7)}</code>
          {authorLogin && <span className="text-[11px] text-ink-faint">@{authorLogin}</span>}
        </div>
      </div>
    </div>
  );
  if (url) return <a href={url} target="_blank" rel="noopener noreferrer" className="block hover:bg-paper-dark rounded-editorial transition-colors">{content}</a>;
  return <div>{content}</div>;
}

// ─────────────────────────────────────────────────────────
// EditorialCard
// ─────────────────────────────────────────────────────────
interface EditorialCardProps {
  children: React.ReactNode;
  accent?: StickyColor;
  className?: string;
}
const accentBorder: Record<StickyColor, string> = {
  yellow: 'border-l-sticky-yellow', green: 'border-l-sticky-green',
  pink:   'border-l-sticky-pink',   blue:  'border-l-sticky-blue',
  orange: 'border-l-sticky-orange', lavender: 'border-l-sticky-lavender',
};
export function EditorialCard({ children, accent, className = '' }: EditorialCardProps) {
  const accentCls = accent ? `border-l-4 ${accentBorder[accent]}` : '';
  return (
    <div className={`card-editorial ${accentCls} p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Timeline
// ─────────────────────────────────────────────────────────
interface TimelineItem {
  id: string | number;
  label: string;
  time: string;
  content: React.ReactNode;
  accent?: StickyColor;
}
export function Timeline({ items }: { items: TimelineItem[] }) {
  const dotColor: Record<string, string> = {
    yellow: 'bg-sticky-yellow', green: 'bg-sticky-green',
    pink:   'bg-sticky-pink',   blue:  'bg-sticky-blue',
    orange: 'bg-sticky-orange', lavender: 'bg-sticky-lavender',
  };
  return (
    <div className="space-y-0">
      {items.map((item) => (
        <div key={item.id} className="timeline-item">
          <div className={`timeline-dot ${item.accent ? dotColor[item.accent] : 'bg-paper-dark'}`} />
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold font-display text-ink">{item.label}</span>
            <span className="text-xs font-mono text-ink-faint">{item.time}</span>
          </div>
          <div className="text-sm text-ink-soft">{item.content}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PrimaryButton / SecondaryButton (convenience wrappers)
// ─────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  loading?: boolean;
}
export function PrimaryButton({ children, loading, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button className={`btn-primary ${className}`} disabled={disabled || loading} {...props}>
      {loading && <span className="w-4 h-4 border-2 border-paper-cream border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}
export function SecondaryButton({ children, loading, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button className={`btn-secondary ${className}`} disabled={disabled || loading} {...props}>
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}
export function AccentButton({ children, loading, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button className={`btn-accent ${className}`} disabled={disabled || loading} {...props}>
      {loading && <span className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="text-display-md text-ink mb-1">{title}</p>
      {description && <p className="text-sm text-ink-muted max-w-xs mx-auto mt-1 mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PageSpinner
// ─────────────────────────────────────────────────────────
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="spinner" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PageHeader
// ─────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  tag?: string;
}
export function PageHeader({ title, subtitle, actions, tag }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        {tag && <p className="section-heading mb-2">{tag}</p>}
        <h1 className="text-display-lg text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-1 max-w-lg">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0 pt-1">{actions}</div>}
    </div>
  );
}
