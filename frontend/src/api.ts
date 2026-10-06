import type {
  ActionLog, ChoreInstance, DataConfig, Exercise, ExerciseAssignmentWithExercise, ExerciseCategoryDef,
  ExerciseSession, Spending, StarTransfer, StateSnapshot
} from '@shared/types';

// REST calls. They report what someone did; the resulting state arrives over
// the WebSocket (GameContext), so callers never cache what these return.

const API_URL = '/api';

export interface ValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

export interface ScheduleDebug {
  serverTime: string;
  timezone: string;
  serverTimeLocal: string;
  schedules: { id: string; cron: string; targetId?: string; nextRunLocal?: string; error?: string }[];
}

/** A request the server answered with an error: its message, and the HTTP status (a 400 is a refusal with a reason). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Rejects with an ApiError carrying the server's error message when there is one.
async function request<T>(method: string, path: string, body?: unknown, fallbackError = 'Request failed'): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(json?.error || fallbackError, response.status);
  return json as T;
}

const post = <T = void>(path: string, body: unknown = {}, error?: string) => request<T>('POST', path, body, error);
const put = <T>(path: string, body: unknown, error?: string) => request<T>('PUT', path, body, error);
const get = <T>(path: string, error?: string) => request<T>('GET', path, undefined, error);

export const api = {
  pushNow: (id: string) => post('/hooks/push', { id }, 'Failed to push'),

  // Running routines and flows: report what the kid did; the server moves them on.
  completeTask: (executionId: string, taskId: string) =>
    post<{ success: boolean, starsAwarded: number }>(`/executions/${executionId}/tasks/${taskId}/complete`, {}, 'Failed to complete task'),
  closeRoutine: (executionId: string) => post(`/executions/${executionId}/close`, {}, 'Failed to close routine'),
  dismissAlarm: (runId: string, stepIndex: number) => post(`/flow-runs/${runId}/steps/${stepIndex}/dismiss`, {}, 'Failed to dismiss alarm'),

  // Stars and rewards
  adjustStars: (userId: string, amount: number) =>
    post<{ success: boolean, newTotal: number }>(`/users/${userId}/stars`, { amount }, 'Failed to change stars'),
  spendStars: (userId: string, rewardId: string) => post<Spending>('/spendings', { userId, rewardId }, 'Failed to spend stars'),
  markSpendingDone: (id: string) => put<Spending>(`/spendings/${id}`, { status: 'done' }, 'Failed to update spending'),
  revokeSpending: (id: string) => put<Spending>(`/spendings/${id}`, { status: 'revoked' }, 'Failed to revoke spending'),

  createTransfer: (fromUserId: string, toUserId: string, amount: number) =>
    post<StarTransfer>('/transfers', { fromUserId, toUserId, amount }, 'Failed to create transfer'),
  approveTransfer: (id: string) => put<StarTransfer>(`/transfers/${id}`, { action: 'approve' }, 'Failed to approve transfer'),
  rejectTransfer: (id: string) => put<StarTransfer>(`/transfers/${id}`, { action: 'reject' }, 'Failed to reject transfer'),
  cancelTransfer: (id: string) => put<StarTransfer>(`/transfers/${id}`, { action: 'cancel' }, 'Failed to cancel transfer'),

  // Chores
  claimChore: (instanceId: string, userId: string) => post<ChoreInstance>(`/chores/${instanceId}/claim`, { userId }, 'Failed to claim chore'),
  attemptChore: (instanceId: string) => post<ChoreInstance>(`/chores/${instanceId}/attempt`, {}, 'Failed to mark chore as done'),
  confirmChore: (instanceId: string, stars?: number) => post<ChoreInstance>(`/chores/${instanceId}/confirm`, { stars }, 'Failed to confirm chore'),
  rejectChore: (instanceId: string) => post<ChoreInstance>(`/chores/${instanceId}/reject`, {}, 'Failed to reject chore'),

  // Config and admin
  saveConfig: (config: DataConfig) => post('/admin/data', config, 'Failed to save data'),
  // The Advanced JSON editor replaces the whole file on purpose, so it may replace an invalid one
  // (replace=1; the server keeps the invalid file beside). The forms never do.
  saveRawConfig: (data: unknown) => post('/admin/data?replace=1', data, 'Failed to save data'),
  getConfigText: () => get<{ text: string }>('/admin/data/text', 'Failed to read data.json').then(r => r.text),
  validateConfig: (data: unknown) => post<ValidationResult>('/admin/validate', data, 'Failed to validate config'),
  getRawState: () => get<StateSnapshot>('/admin/state', 'Failed to fetch state'),
  saveRawState: (data: unknown) => post('/admin/state', data, 'Failed to save state'),
  validateState: (data: unknown) => post<ValidationResult>('/admin/validate-state', data, 'Failed to validate state'),
  getRawExercises: () => get<unknown>('/admin/exercises', 'Failed to fetch exercises'),
  saveRawExercises: (data: unknown) => post('/admin/exercises?replace=1', data, 'Failed to save exercises'),
  getExercisesText: () => get<{ text: string }>('/admin/exercises/text', 'Failed to read exercises.json').then(r => r.text),
  getSchema: (name: 'data' | 'state') => get<object>(`/admin/schema/${name}`, 'Failed to fetch schema'),
  getExerciseSchema: () => get<object>('/exercises/schema', 'Failed to fetch exercise schema'),
  listUploads: () => get<string[]>('/admin/uploads/list', 'Failed to list uploads'),
  getScheduleDebug: () => get<ScheduleDebug>('/debug/schedule', 'Failed to fetch schedule debug info'),
  getDebugLogs: () => get<ActionLog[]>('/debug/logs', 'Failed to fetch debug logs'),

  uploadFile: async (file: File): Promise<{ success: boolean, url: string, filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/admin/upload`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Failed to upload file');
    return response.json();
  },

  // Exercises
  getExercises: (category?: string) => get<Exercise[]>(category ? `/exercises?category=${category}` : '/exercises', 'Failed to fetch exercises'),
  getExerciseCategories: () => get<ExerciseCategoryDef[]>('/exercises/categories', 'Failed to fetch exercise categories'),
  startExerciseSession: (playerIds: string[], categories: string[], totalRounds: number, questionsPerRound: number) =>
    post<ExerciseSession>('/exercises/sessions', { playerIds, categories, totalRounds, questionsPerRound }, 'Failed to start exercise session'),
  submitExerciseAnswer: (sessionId: string, userId: string, exerciseId: string, answer: unknown) =>
    post<{ correct: boolean, earnedStars: number, session: ExerciseSession }>(`/exercises/sessions/${sessionId}/answer`, { userId, exerciseId, answer }, 'Failed to submit answer'),
  cancelExerciseSession: (sessionId: string) => request<void>('DELETE', `/exercises/sessions/${sessionId}`, undefined, 'Failed to cancel exercise session'),
  startExtraProblem: (userId: string) =>
    post<ExerciseAssignmentWithExercise>('/exercise-assignments/extra', { userId }, 'Failed to start a problem'),
  // Help tours played (the owl stops offering them), and letting it offer again
  markHelpSeen: (tourIds: string[]) => post('/help/seen', { tourIds }, 'Failed to remember help'),
  resetHelp: (userId?: string) => post<{ reset: number }>('/help/reset', { userId }, 'Failed to reset help'),
  revealExerciseAssignment: (assignmentId: string) =>
    post<ExerciseAssignmentWithExercise>(`/exercise-assignments/${assignmentId}/reveal`, {}, 'Failed to show the answer'),
  answerExerciseAssignment: (assignmentId: string, answer: unknown) =>
    post<{ correct: boolean, starsAwarded: number, assignment: ExerciseAssignmentWithExercise, wrong?: number[] }>(`/exercise-assignments/${assignmentId}/answer`, { answer }, 'Failed to submit answer'),
};
