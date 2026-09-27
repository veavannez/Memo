// API types matching backend schemas

export interface User {
  id: number;
  display_name: string;
  email?: string;
  avatar_url?: string;
  github_login?: string;
  created_at: string;
}

export interface Installation {
  id: number;
  installation_id: number;
  account_login: string;
  account_type: string;
  account_avatar_url?: string;
  is_active: boolean;
}

export interface Repository {
  id: number;
  github_repo_id: number;
  full_name: string;
  name: string;
  owner_login: string;
  is_private: boolean;
  default_branch: string;
  html_url?: string;
  installation_id: number;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  repository_id: number;
  repository?: Repository;
  is_active: boolean;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: 'owner' | 'member';
  joined_at: string;
  user?: User;
}

export interface GitHubActivity {
  id: number;
  activity_type: 'commit' | 'pull_request' | 'issue';
  github_id: string;
  title?: string;
  url?: string;
  author_login?: string;
  occurred_at?: string;
  // enriched fields (present when available from GitHub API)
  branch?: string;
  changed_files?: string[];
  additions?: number;
  deletions?: number;
  pr_state?: 'open' | 'closed' | 'merged';
  pr_number?: number;
}

/** Pre-flight context shown in the END SESSION form before the developer writes. */
export interface SessionContext {
  branch: string;
  commits: GitHubActivity[];
  pull_requests: GitHubActivity[];
  changed_files: string[];
  open_issues: { id: number; number: number; title: string; url: string }[];
}

export interface Memo {
  id: number;
  project_id: number;
  author_id: number;
  author?: User;
  completed?: string;
  in_progress?: string;
  blocked?: string;
  next_steps?: string;
  notes?: string;
  is_draft: boolean;
  github_activities: GitHubActivity[];
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  project_id: number;
  source_memo_id?: number;
  assignee_id?: number;
  assignee?: User;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  github_issue_url?: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberStatus {
  user: User;
  role: string;
  latest_memo?: Memo;
  current_task?: Task;
  open_tasks_count: number;
  blocked_tasks_count: number;
}

export interface Dashboard {
  project: Project;
  team: TeamMemberStatus[];
  recent_memos: Memo[];
  recent_tasks: Task[];
}

export interface CatchMeUp {
  user: User;
  last_session_memo?: Memo;
  my_open_tasks: Task[];
  my_blocked_tasks: Task[];
  team_memos_since_last: Memo[];
  recent_github_activity: GitHubActivity[];
  suggested_next_steps: string[];
  summary_lines: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
