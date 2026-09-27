/**
 * Frontend service abstraction for MEMO's watsonx.ai intelligence layer.
 *
 * All intelligence API calls go through this module — never scattered
 * across UI components.
 *
 * Architecture
 * ────────────
 * GitHub        → project evidence (github.ts)
 * MEMO backend  → normalises evidence, calls watsonx.ai
 * watsonx.ts    → typed API calls + fallback helpers
 * UI components → present results, allow user to approve/act
 *
 * The AI never directly modifies app state.
 * Returned data is validated by the backend (Pydantic) before reaching here.
 */

import api from './api';
import type {
  ProjectAnalysis,
  GeneratedMemoContent,
  CatchUpAIEnrichment,
  TaskAssignmentSuggestion,
  WatsonxStatus,
  ConfidenceLevel,
  DetectedGap,
  Task,
  GapTaskSuggestion,
  ProjectRefreshResponse, AutomationMode,
} from '../types';

export { confidenceLevel } from '../types';

// ─── API wrappers ─────────────────────────────────────────────────────────────

/**
 * Check whether the watsonx.ai service is configured on the backend.
 * Use this to decide whether to show AI-powered UI elements.
 */
export async function getIntelligenceStatus(projectId: string | number): Promise<WatsonxStatus> {
  const { data } = await api.get<WatsonxStatus>(
    `/projects/${projectId}/intelligence/status`,
  );
  return data;
}

/**
 * Run a full project-state analysis.
 * Returns a structured analysis of completed / in-progress / blocked work,
 * detected gaps, and suggested next steps — all with evidence and confidence.
 */
export async function analyzeProject(projectId: string | number): Promise<ProjectAnalysis> {
  const { data } = await api.post<ProjectAnalysis>(
    `/projects/${projectId}/intelligence/analyze`,
  );
  return data;
}

/**
 * Detect potentially missing work items.
 * Every gap includes supporting evidence and a confidence level.
 */
export async function detectGaps(
  projectId: string | number,
): Promise<ProjectAnalysis['detectedGaps']> {
  const { data } = await api.post<ProjectAnalysis['detectedGaps']>(
    `/projects/${projectId}/intelligence/detect-gaps`,
  );
  return data;
}

/**
 * Generate an AI-assisted memo draft.
 *
 * IMPORTANT: The returned content is a DRAFT for the developer to review.
 * It is not saved automatically — the user must approve and save it via
 * the normal memo creation flow.
 */
export async function generateMemoDraft(
  projectId: string | number,
  manual: { completed?: string; in_progress?: string; blocked?: string; next_steps?: string; notes?: string },
): Promise<GeneratedMemoContent> {
  const { data } = await api.post<GeneratedMemoContent>(
    `/projects/${projectId}/intelligence/generate-memo`,
    manual,
  );
  return data;
}

/**
 * AI-powered Catch Me Up enrichment.
 * Supplements the deterministic catch-me-up data with AI interpretation.
 */
export async function generateCatchUpEnrichment(
  projectId: string | number,
): Promise<CatchUpAIEnrichment> {
  const { data } = await api.post<CatchUpAIEnrichment>(
    `/projects/${projectId}/intelligence/catch-me-up`,
  );
  return data;
}

/**
 * Get task-assignment suggestions based on contributor activity patterns.
 * Suggestions must be explicitly applied by the user — never auto-assigned.
 */
export async function suggestAssignments(
  projectId: string | number,
  taskIds?: number[],
): Promise<TaskAssignmentSuggestion[]> {
  const { data } = await api.post<TaskAssignmentSuggestion[]>(
    `/projects/${projectId}/intelligence/suggest-assignments`,
    taskIds ?? null,
  );
  return data;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export async function editDetectedGap(
  projectId: string | number,
  gapId: number,
  updates: Pick<DetectedGap, 'title' | 'description' | 'category'>,
): Promise<DetectedGap> {
  const { data } = await api.patch<DetectedGap>(`/projects/${projectId}/intelligence/gaps/${gapId}`, updates);
  return data;
}

export async function dismissDetectedGap(projectId: string | number, gapId: number): Promise<void> {
  await api.post(`/projects/${projectId}/intelligence/gaps/${gapId}/dismiss`);
}

export async function getGapTaskSuggestion(
  projectId: string | number,
  gapId: number,
): Promise<GapTaskSuggestion> {
  const { data } = await api.get<GapTaskSuggestion>(`/projects/${projectId}/intelligence/gaps/${gapId}/task-suggestion`);
  return data;
}

export async function createTaskFromGap(
  projectId: string | number,
  gapId: number,
  draft: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'todo' | 'in_progress' | 'blocked' | 'done';
    assignee_id?: number;
    assignment_reason?: string;
    assignment_confidence?: number;
  },
): Promise<Task> {
  const { data } = await api.post<Task>(`/projects/${projectId}/intelligence/gaps/${gapId}/task`, draft);
  return data;
}
/** Human-readable confidence badge props. */
export function confidenceBadge(score: number): { label: ConfidenceLevel; color: string } {
  if (score >= 0.75) return { label: 'HIGH',   color: 'text-green-700 bg-green-50 border-green-200' };
  if (score >= 0.45) return { label: 'MEDIUM', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
  return               { label: 'LOW',    color: 'text-red-700 bg-red-50 border-red-200' };
}

/**
 * Return a short "MEMO detected…" / "MEMO suggests…" prefix appropriate
 * for the given confidence score.
 */
export function aiPrefix(score: number): string {
  if (score >= 0.75) return 'MEMO detected';
  if (score >= 0.45) return 'MEMO suggests';
  return 'Possible:';
}

/** Format the AI model ID for display. */
export function formatModelId(modelId: string): string {
  if (modelId === 'fallback') return 'Fallback (no AI)';
  return modelId;
}

export async function refreshProjectIntelligence(projectId: string | number): Promise<ProjectRefreshResponse> {
  const { data } = await api.post<ProjectRefreshResponse>(`/projects/${projectId}/intelligence/refresh`);
  return data;
}

export async function setAutomationMode(projectId: string | number, mode: AutomationMode): Promise<void> {
  await api.patch(`/projects/${projectId}/intelligence/automation-mode`, { mode });
}

export async function approveTaskUpdate(projectId: string | number, proposalId: number): Promise<Task> {
  const { data } = await api.post<Task>(`/projects/${projectId}/intelligence/task-proposals/${proposalId}/approve`);
  return data;
}

export async function dismissTaskUpdate(projectId: string | number, proposalId: number): Promise<void> {
  await api.post(`/projects/${projectId}/intelligence/task-proposals/${proposalId}/dismiss`);
}