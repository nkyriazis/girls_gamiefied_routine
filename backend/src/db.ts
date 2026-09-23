import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import type { WebSocket } from 'ws';
import {
  Chore, ChoreInstance, Exercise, ExerciseAnswer, ExerciseAssignment, ExerciseAssignmentWithExercise,
  ExerciseCategoryDef, ExerciseSession, RoutineExecution, ServerMessage, Spending, StarTransfer,
  StateSnapshot, SyncStatePayload, ActionLog
} from '../../shared/types';
import { exercisePoolProvider, ASSIGNMENTS_PER_DAY } from './exercisePool';
import { config, ConfigUser, dataConfig, DataConfig, exercisesConfig, exercisesFile, ExercisesConfig } from './config';
import { DB_FILE, UPLOADS_DIR } from './paths';
import { Store } from './store';

// ============================================================================
// Domain operations. Config comes from the in-memory cache (config.ts); all
// runtime state and history is read from and written straight to the
// database (store.ts). Every mutation broadcasts what changed.
// ============================================================================

export { UPLOADS_DIR };

// Ensure uploads dir exists
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

export const store = new Store(DB_FILE);

// Action Logging
export const MAX_LOGS = 200;

export function logAction(type: string, details: unknown) {
  const entry: ActionLog = { id: randomUUID(), timestamp: new Date().toISOString(), type, details };
  console.log(`[ACTION:${type}]`, JSON.stringify(details));
  try {
    store.appendLog(entry);
  } catch (err) {
    console.error('Failed to write action log:', err);
  }
}

// WebSocket connections
export const wsConnections = new Set<WebSocket>();

// Broadcast helper. Only well-formed protocol messages can be sent — adding a
// new message type or changing a payload starts in shared/types.ts.
export function broadcast(message: ServerMessage) {
  const payload = JSON.stringify(message);
  wsConnections.forEach(ws => {
    if (ws.readyState === 1) { // OPEN
      ws.send(payload);
    }
  });
}

// ============================================
// CONFIG
// ============================================

export type UserWithStars = ConfigUser & { stars: number };

/** Config users with their current star balance. */
export function usersWithStars(): UserWithStars[] {
  const stars = store.allStars();
  return config().users.map(u => ({ ...u, stars: stars[u.id] ?? 0 }));
}

function findUser(userId: string): UserWithStars | undefined {
  return usersWithStars().find(u => u.id === userId);
}

/** Mutable copy of data.json (for editors that change it and save it back). */
export function readRawConfig(): DataConfig {
  return dataConfig.raw();
}

/** Validate and save data.json, then tell clients to reload. Throws when invalid. */
export function writeRawConfig(data: unknown): void {
  const error = dataConfig.save(data);
  if (error) throw new Error(`Validation failed: ${JSON.stringify(error.errors)}`);
  broadcast({ type: 'CONFIG_UPDATED' });
}

export function readRawExercises(): ExercisesConfig {
  return exercisesConfig.raw();
}

export function writeRawExercises(data: unknown): void {
  const error = exercisesConfig.save(data);
  if (error) throw new Error(`Exercises validation failed: ${JSON.stringify(error.errors)}`);
  broadcast({ type: 'CONFIG_UPDATED' }); // Trigger a reload on all clients
}

// ============================================
// ROUTINES
// ============================================

export type TriggerResult =
  | { success: true; skipped: true; existingExecutionId: string }
  | { success: true; type: 'assignment' | 'flow'; id: string };

// Trigger an action (Routine assignment or Flow)
export function triggerAction(id: string, source: string = 'unknown'): TriggerResult | null {
  const { routineAssignments, flows } = config();
  const assignment = routineAssignments.find(a => a.id === id);

  if (assignment) {
    // A user can only be in one routine at a time (idempotency)
    const [existingExecution] = store.routineExecutions.all(
      'userId = ? AND completedAt IS NULL', assignment.userId
    );

    if (existingExecution) {
      logAction('TRIGGER_ROUTINE_SKIPPED', {
        id,
        userId: assignment.userId,
        routineId: assignment.routineId,
        source,
        existingExecutionId: existingExecution.id
      });
      // Broadcast existing execution instead of creating duplicate
      broadcast({
        type: 'ROUTINE_START',
        payload: { userId: assignment.userId, routineId: assignment.id, executionId: existingExecution.id }
      });
      return { success: true, skipped: true, existingExecutionId: existingExecution.id };
    }

    logAction('TRIGGER_ROUTINE', { id, userId: assignment.userId, routineId: assignment.routineId, source });
    const execution: RoutineExecution = {
      id: randomUUID(),
      userId: assignment.userId,
      routineId: assignment.routineId,
      startedAt: new Date().toISOString(),
      totalStars: 0
    };
    store.routineExecutions.put(execution);

    broadcast({
      type: 'ROUTINE_START',
      payload: {
        userId: assignment.userId,
        routineId: assignment.id, // Use assignment ID as routineId for frontend
        executionId: execution.id
      }
    });

    return { success: true, type: 'assignment', id };
  }

  const flow = flows.find(f => f.id === id);

  if (flow) {
    logAction('TRIGGER_FLOW', { id, flowId: flow.id, source });
    broadcast({ type: 'FLOW_START', payload: { flowId: flow.id, steps: flow.steps } });
    return { success: true, type: 'flow', id };
  }

  logAction('TRIGGER_FAILED', { id, source, reason: 'Not found' });
  return null;
}

export type TaskCompletion =
  | { success: true; starsAwarded: number }
  | { success: false; error: string };

// Record a completed task and award its stars to the routine's user.
export function completeTask(executionId: string, taskId: string, duration: number, isOnTime: boolean): TaskCompletion | null {
  const task = config().tasks.find(t => t.id === taskId);
  if (!task) return null;

  const starsToAdd = store.transaction(() => {
    store.taskExecutions.put({
      id: randomUUID(), executionId, taskId, duration, isOnTime, completedAt: new Date().toISOString()
    });
    const execution = store.routineExecutions.get(executionId);
    if (!execution) return null;
    const stars = isOnTime ? (task.stars || 0) : (task.lateStars ?? 0);
    store.routineExecutions.put({ ...execution, totalStars: (execution.totalStars || 0) + stars });
    if (stars !== 0) awardStars(execution.userId, stars);
    logAction('TASK_COMPLETE', { executionId, taskId, starsAwarded: stars, userId: execution.userId });
    return stars;
  });

  return starsToAdd === null
    ? { success: false, error: 'Execution not found' }
    : { success: true, starsAwarded: starsToAdd };
}

// ============================================
// STARS, SPENDINGS, TRANSFERS
// ============================================

function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function getEnrichedSpendings(): Spending[] {
  const users = usersWithStars();
  const { rewards } = config();
  return store.spendings.all().map(s => ({
    ...s,
    user: users.find(u => u.id === s.userId),
    reward: rewards.find(r => r.id === s.rewardId)
  })).sort(byNewest);
}

export function getEnrichedTransfers(): StarTransfer[] {
  const users = usersWithStars();
  return store.starTransfers.all().map(t => ({
    ...t,
    fromUser: users.find(u => u.id === t.fromUserId),
    toUser: users.find(u => u.id === t.toUserId)
  })).sort(byNewest);
}

// Available balance: total minus stars locked in pending outgoing transfers
export function getAvailableBalance(userId: string): number {
  const pendingOutgoing = store.starTransfers
    .all("fromUserId = ? AND status = 'pending'", userId)
    .reduce((sum, t) => sum + t.amount, 0);
  return store.getStars(userId) - pendingOutgoing;
}

export function readLastLogs(limit: number): ActionLog[] {
  return store.recentLogs(limit);
}

// Commit a new star balance and notify all clients. The broadcast is intrinsic
// to the mutation — a balance can never change without every client hearing
// about it, so callers have nothing to remember.
function commitUserStars(userId: string, newTotal: number): number {
  store.setStars(userId, newTotal);
  broadcast({ type: 'SYNC_STATE', payload: { userStars: store.allStars() } });
  return newTotal;
}

// Adjust a user's star balance by a delta. All star-mutating code paths go
// through this, trySpendStars or setUserStars.
export function adjustUserStars(userId: string, delta: number): number {
  return store.transaction(() => commitUserStars(userId, store.getStars(userId) + delta));
}

// Spend stars: balance check and deduction happen in one transaction, so
// concurrent spends can never overdraw. Returns the new total, or null if the
// balance is insufficient (nothing is deducted).
export function trySpendStars(userId: string, cost: number): number | null {
  return store.transaction(() => {
    const balance = store.getStars(userId);
    return balance < cost ? null : commitUserStars(userId, balance - cost);
  });
}

// Award stars to a user
export function awardStars(userId: string, amount: number): { success: boolean; newTotal: number } {
  if (!findUser(userId)) throw new Error(`User not found: ${userId}`);

  const newTotal = adjustUserStars(userId, amount);
  logAction('AWARD_STARS', { userId, amount, newBalance: newTotal });

  // Semantic notification on top of the balance sync (which adjustUserStars
  // already broadcast) — lets the UI celebrate the award if it wants to.
  broadcast({ type: 'STARS_AWARDED', payload: { userId, amount, totalStars: newTotal } });

  return { success: true, newTotal };
}

// Set stars for a user (absolute value)
export function setUserStars(userId: string, amount: number): { success: boolean; newTotal: number } {
  if (!findUser(userId)) throw new Error(`User not found: ${userId}`);

  const oldStars = store.getStars(userId);
  commitUserStars(userId, amount);
  logAction('SET_STARS', { userId, oldBalance: oldStars, newBalance: amount });

  return { success: true, newTotal: amount };
}

// ============================================
// ADMIN STATE EDITOR
// ============================================

export function stateSnapshot(): StateSnapshot {
  return store.snapshot();
}

// Replace the whole runtime state (validated by the caller) and resync clients.
export async function replaceState(state: StateSnapshot): Promise<void> {
  store.replaceState(state);
  logAction('STATE_REPLACED', { source: 'admin' });
  broadcast({ type: 'SYNC_STATE', payload: await fullSyncPayload() });
}

// Everything a client needs on connect (or after a bulk change).
export async function fullSyncPayload(): Promise<SyncStatePayload> {
  return {
    userStars: store.allStars(),
    spendings: getEnrichedSpendings(),
    starTransfers: getEnrichedTransfers(),
    choreInstances: getChoresWithInstances().instances,
    activeExerciseSessions: activeExerciseSessions(),
    exerciseAssignments: await getExerciseAssignments()
  };
}

// ============================================
// CHORES SYSTEM
// ============================================

// Helper to parse cron expression and check if it matches current time
function cronMatches(cronExpr: string, date: Date): boolean {
  const parts = cronExpr.split(' ');
  if (parts.length !== 5) return false;
  
  const [minuteExpr, hourExpr, dayOfMonthExpr, monthExpr, dayOfWeekExpr] = parts;
  
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay(); // 0 = Sunday
  
  const matchField = (expr: string, value: number, _max: number): boolean => {
    if (expr === '*') return true;
    
    // Handle ranges (e.g., 1-5)
    if (expr.includes('-')) {
      const [start, end] = expr.split('-').map(Number);
      return value >= start && value <= end;
    }
    
    // Handle lists (e.g., 1,3,5)
    if (expr.includes(',')) {
      return expr.split(',').map(Number).includes(value);
    }
    
    // Handle step values (e.g., */5)
    if (expr.includes('/')) {
      const [range, step] = expr.split('/');
      const stepNum = parseInt(step, 10);
      if (range === '*') return value % stepNum === 0;
      return false;
    }
    
    return parseInt(expr, 10) === value;
  };
  
  return (
    matchField(minuteExpr, minute, 59) &&
    matchField(hourExpr, hour, 23) &&
    matchField(dayOfMonthExpr, dayOfMonth, 31) &&
    matchField(monthExpr, month, 12) &&
    matchField(dayOfWeekExpr, dayOfWeek, 6)
  );
}

// Generate chore instances when cron matches
export function generateChoreInstances(): ChoreInstance[] {
  const chores = config().chores ?? [];
  const now = new Date();
  const newInstances: ChoreInstance[] = [];

  for (const chore of chores) {
    if (!cronMatches(chore.availabilityCron, now)) continue;

    // Any instance of this chore still within its window (regardless of status)
    // prevents respawning after claim/reject/confirm/expire.
    const [existingInWindow] = store.choreInstances.all('choreId = ? AND expiresAt > ?', chore.id, now.toISOString());
    if (existingInWindow) continue;

    const expiresAt = new Date(now.getTime() + chore.expirationHours * 60 * 60 * 1000);
    const instance: ChoreInstance = {
      id: randomUUID(),
      choreId: chore.id,
      status: 'available',
      availableAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    store.choreInstances.put(instance);
    newInstances.push(instance);

    logAction('CHORE_AVAILABLE', { choreId: chore.id, instanceId: instance.id, expiresAt: instance.expiresAt });
  }

  if (newInstances.length > 0) {
    broadcastChoreState();
    for (const instance of newInstances) {
      const chore = chores.find(c => c.id === instance.choreId);
      broadcast({
        type: 'CHORE_AVAILABLE',
        payload: { instanceId: instance.id, choreId: instance.choreId, choreTitle: chore?.title, expiresAt: instance.expiresAt }
      });
    }
  }

  return newInstances;
}

function findChore(choreId: string): Chore | undefined {
  return (config().chores ?? []).find(c => c.id === choreId);
}

// Expire chores that are past their expiration time
export function expireChores(): { expired: ChoreInstance[], notified: { userId: string, choreTitle: string }[] } {
  const now = new Date().toISOString();
  const expiredInstances: ChoreInstance[] = [];
  const notified: { userId: string, choreTitle: string }[] = [];

  // Only available or claimed instances expire
  for (const instance of store.choreInstances.all("status IN ('available', 'claimed') AND expiresAt <= ?", now)) {
    const chore = findChore(instance.choreId);
    const oldStatus = instance.status;
    const expired: ChoreInstance = { ...instance, status: 'expired' };
    store.choreInstances.put(expired);
    expiredInstances.push(expired);

    logAction('CHORE_EXPIRED', { instanceId: instance.id, choreId: instance.choreId, previousStatus: oldStatus, claimedBy: instance.claimedBy });

    // If it was claimed, notify that user
    if (oldStatus === 'claimed' && instance.claimedBy) {
      notified.push({ userId: instance.claimedBy, choreTitle: chore?.title || 'Unknown chore' });
      broadcast({
        type: 'CHORE_EXPIRED',
        payload: { instanceId: instance.id, choreId: instance.choreId, choreTitle: chore?.title, userId: instance.claimedBy }
      });
    }
  }

  if (expiredInstances.length > 0) {
    broadcastChoreState();
  }

  return { expired: expiredInstances, notified };
}

// Clean up old chore instances to prevent unbounded growth: closed instances
// are kept for 7 days after their window closes.
export function cleanupOldChoreInstances(): number {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const removed = store.choreInstances.deleteWhere(
    "status NOT IN ('available', 'claimed', 'attempted') AND expiresAt <= ?", cutoff
  );
  if (removed > 0) {
    logAction('CHORE_CLEANUP', { removed, remaining: store.choreInstances.count() });
  }
  return removed;
}

// Get chores with their active instances, optionally filtered by user eligibility
export function getChoresWithInstances(userId?: string): { chores: Chore[], instances: ChoreInstance[] } {
  let chores = config().chores ?? [];
  if (userId) {
    chores = chores.filter(c =>
      !c.eligibleUsers || c.eligibleUsers.length === 0 || c.eligibleUsers.includes(userId)
    );
  }

  // Active instances, plus ones completed/rejected/expired in the last 24h (for display)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const instances = store.choreInstances.all().filter(ci => {
    if (['available', 'claimed', 'attempted'].includes(ci.status)) return true;
    const completedAt = ci.confirmedAt || ci.rejectedAt || ci.expiresAt;
    return completedAt && completedAt > oneDayAgo;
  });

  return { chores, instances };
}

function getChoreInstance(instanceId: string): ChoreInstance {
  const instance = store.choreInstances.get(instanceId);
  if (!instance) throw new Error(`Chore instance not found: ${instanceId}`);
  return instance;
}

// Claim a chore instance
export function claimChore(instanceId: string, userId: string): ChoreInstance {
  const instance = getChoreInstance(instanceId);

  if (instance.status !== 'available') {
    throw new Error(`Chore is not available (status: ${instance.status})`);
  }

  const chore = findChore(instance.choreId);
  if (chore?.eligibleUsers && chore.eligibleUsers.length > 0 && !chore.eligibleUsers.includes(userId)) {
    throw new Error(`User ${userId} is not eligible for this chore`);
  }

  if (new Date(instance.expiresAt) < new Date()) {
    store.choreInstances.put({ ...instance, status: 'expired' });
    throw new Error('Chore has expired');
  }

  const claimed: ChoreInstance = { ...instance, status: 'claimed', claimedBy: userId, claimedAt: new Date().toISOString() };
  store.choreInstances.put(claimed);

  logAction('CHORE_CLAIMED', { instanceId, choreId: instance.choreId, userId });
  broadcast({
    type: 'CHORE_CLAIMED',
    payload: { instanceId, choreId: instance.choreId, choreTitle: chore?.title, userId }
  });
  broadcastChoreState();

  return claimed;
}

// Mark chore as attempted (user says "I did it!")
export function attemptChore(instanceId: string): ChoreInstance {
  const instance = getChoreInstance(instanceId);

  if (instance.status !== 'claimed') {
    throw new Error(`Chore must be claimed first (status: ${instance.status})`);
  }

  const chore = findChore(instance.choreId);
  const attempted: ChoreInstance = { ...instance, status: 'attempted', attemptedAt: new Date().toISOString() };
  store.choreInstances.put(attempted);

  logAction('CHORE_ATTEMPTED', { instanceId, choreId: instance.choreId, userId: instance.claimedBy });
  broadcast({
    type: 'CHORE_ATTEMPTED',
    payload: { instanceId, choreId: instance.choreId, choreTitle: chore?.title, userId: instance.claimedBy }
  });
  broadcastChoreState();

  return attempted;
}

// Confirm chore completion (parent approves)
export function confirmChore(instanceId: string, starsOverride?: number): ChoreInstance {
  const instance = getChoreInstance(instanceId);

  if (instance.status !== 'attempted') {
    throw new Error(`Chore must be attempted first (status: ${instance.status})`);
  }
  const userId = instance.claimedBy;
  if (!userId) {
    throw new Error('Chore has no claimer');
  }

  const chore = findChore(instance.choreId);
  const stars = starsOverride ?? chore?.defaultStars ?? 0;
  const confirmed: ChoreInstance = {
    ...instance, status: 'confirmed', confirmedAt: new Date().toISOString(), starsAwarded: stars
  };

  store.transaction(() => {
    store.choreInstances.put(confirmed);
    if (stars > 0) awardStars(userId, stars);
  });

  logAction('CHORE_CONFIRMED', { instanceId, choreId: instance.choreId, userId, starsAwarded: stars });
  broadcast({
    type: 'CHORE_CONFIRMED',
    payload: { instanceId, choreId: instance.choreId, choreTitle: chore?.title, userId, starsAwarded: stars }
  });
  broadcastChoreState();

  return confirmed;
}

// Reject chore attempt (parent disapproves)
export function rejectChore(instanceId: string): ChoreInstance {
  const instance = getChoreInstance(instanceId);

  if (instance.status !== 'attempted') {
    throw new Error(`Chore must be attempted first (status: ${instance.status})`);
  }

  const chore = findChore(instance.choreId);
  const rejected: ChoreInstance = { ...instance, status: 'rejected', rejectedAt: new Date().toISOString() };
  store.choreInstances.put(rejected);

  logAction('CHORE_REJECTED', { instanceId, choreId: instance.choreId, userId: instance.claimedBy });
  broadcast({
    type: 'CHORE_REJECTED',
    payload: { instanceId, choreId: instance.choreId, choreTitle: chore?.title, userId: instance.claimedBy }
  });
  broadcastChoreState();

  return rejected;
}

// Broadcast current chore state to all clients
export function broadcastChoreState() {
  broadcast({
    type: 'SYNC_STATE',
    payload: {
      userStars: store.allStars(),
      spendings: getEnrichedSpendings(),
      choreInstances: getChoresWithInstances().instances
    }
  });
}

// ============================================
// SCHOOL EXERCISES SYSTEM
// ============================================

export function readExercises(): Exercise[] {
  return exercisesFile().exercises;
}

export function readExerciseCategories(): ExerciseCategoryDef[] {
  const { categories, exercises } = exercisesFile();
  if (categories && categories.length > 0) {
    return categories;
  }
  // Fallback: Infer categories dynamically for backward compatibility
  return [...new Set(exercises.map(e => e.category))].map(c => ({ id: c, label: c }));
}

// Validate an answer against an exercise, for any exercise type.
// Shared by the group game sessions and the daily assignments.
export function checkExerciseAnswer(exercise: Exercise, answer: any): boolean {
  switch (exercise.type) {
    case 'multiple-choice':
      return answer === exercise.correctIndex;
    case 'true-false':
      return answer === exercise.correctValue;
    case 'match-pairs':
      // answer should be array of {left, right}
      if (Array.isArray(answer) && answer.length === exercise.pairs.length) {
        return answer.every(ansPair =>
          exercise.pairs.some(exPair => exPair.left === ansPair.left && exPair.right === ansPair.right)
        );
      }
      return false;
    case 'ordering':
      // answer should be array of ids in order
      if (Array.isArray(answer) && answer.length === exercise.items.length) {
        return answer.every((id, idx) => exercise.items[idx].id === id);
      }
      return false;
    case 'fill-blank':
      // answer should be array of strings
      if (Array.isArray(answer) && answer.length === exercise.correctAnswers.length) {
        return answer.every((ans, idx) => exercise.correctAnswers[idx] === ans);
      }
      return false;
    case 'number-input':
      return Number(answer) === exercise.correctValue;
    default:
      return false;
  }
}

export function activeExerciseSessions(): ExerciseSession[] {
  return store.exerciseSessions.all('completedAt IS NULL');
}

export function getExerciseSession(sessionId: string): ExerciseSession | undefined {
  return store.exerciseSessions.get(sessionId);
}

export function startExerciseSession(
  playerIds: string[],
  categories: string[],
  totalRounds: number,
  questionsPerRound: number
): ExerciseSession {
  // Filter exercises by categories
  let availableExercises = readExercises();
  if (categories.length > 0) {
    availableExercises = availableExercises.filter(e => categories.includes(e.category));
  }

  // An exercise is available if it has no userIds restriction,
  // OR if every player in the session is in the exercise's userIds list
  availableExercises = availableExercises.filter(e =>
    !e.userIds || e.userIds.length === 0 || playerIds.every(pid => e.userIds!.includes(pid))
  );

  if (availableExercises.length === 0) {
    throw new Error('No exercises found for these categories');
  }

  // Draw random exercises for the session (no repeats when possible)
  const totalQuestionsNeeded = totalRounds * questionsPerRound;
  const shuffled = [...availableExercises].sort(() => Math.random() - 0.5);
  const drawnExerciseIds: string[] = [];
  for (let i = 0; i < totalQuestionsNeeded; i++) {
    // Cycle through shuffled exercises, repeating only if pool is smaller than needed
    drawnExerciseIds.push(shuffled[i % shuffled.length].id);
  }

  const session: ExerciseSession = {
    id: randomUUID(),
    playerIds,
    categories,
    totalRounds,
    currentRound: 1,
    questionsPerRound,
    currentQuestionIndex: 0,
    exerciseIds: drawnExerciseIds,
    answers: Object.fromEntries(playerIds.map(pid => [pid, []])),
    startedAt: new Date().toISOString(),
    totalStarsEarned: Object.fromEntries(playerIds.map(pid => [pid, 0]))
  };
  store.exerciseSessions.put(session);

  logAction('EXERCISE_SESSION_START', { sessionId: session.id, players: playerIds, categories });
  broadcast({ type: 'EXERCISE_SESSION_START', payload: session });

  return session;
}

export function cancelExerciseSession(sessionId: string): void {
  if (store.exerciseSessions.deleteWhere('id = ?', sessionId) > 0) {
    broadcast({ type: 'SYNC_STATE', payload: { activeExerciseSessions: activeExerciseSessions() } });
  }
}

export function submitExerciseAnswer(
  sessionId: string,
  userId: string,
  exerciseId: string,
  answer: unknown // index, boolean, array of pairs, etc. — checked per exercise type
): { correct: boolean; earnedStars: number; session: ExerciseSession } {
  const session = store.exerciseSessions.get(sessionId);

  if (!session) throw new Error('Session not found');
  if (session.completedAt) throw new Error('Session already completed');
  if (!session.playerIds.includes(userId)) throw new Error('User not in this session');

  const exercise = readExercises().find(e => e.id === exerciseId);
  if (!exercise) throw new Error('Exercise not found');

  // Absolute question index (answers accumulate across rounds)
  const overallQuestionIndex = (session.currentRound - 1) * session.questionsPerRound + session.currentQuestionIndex;

  const isCorrect = checkExerciseAnswer(exercise, answer);
  const earnedStars = isCorrect ? exercise.stars : 0;

  const exerciseAnswer: ExerciseAnswer = {
    exerciseId,
    status: isCorrect ? 'correct' : 'incorrect',
    answeredAt: new Date().toISOString(),
    earnedStars
  };

  if (!session.answers[userId]) session.answers[userId] = [];
  session.answers[userId].push(exerciseAnswer);

  if (isCorrect) {
    session.totalStarsEarned[userId] = (session.totalStarsEarned[userId] || 0) + earnedStars;
  }

  // Advance question index if all players answered this overall question
  const existingUserIds = config().users.map(u => u.id);
  const relevantPlayerIds = session.playerIds.filter(pid => existingUserIds.includes(pid));

  const allAnsweredCurrent = relevantPlayerIds.every(pid =>
    session.answers[pid] && session.answers[pid].length > overallQuestionIndex
  );

  if (allAnsweredCurrent) {
    session.currentQuestionIndex++;

    if (session.currentQuestionIndex >= session.questionsPerRound) {
      if (session.currentRound >= session.totalRounds) {
        session.completedAt = new Date().toISOString();
        logAction('EXERCISE_SESSION_COMPLETE', { sessionId: session.id, totalStars: session.totalStarsEarned });
      } else {
        session.currentRound++;
        session.currentQuestionIndex = 0;
      }
    }
  }

  store.transaction(() => {
    store.exerciseSessions.put(session);
    // Award stars immediately to user balance
    if (isCorrect) awardStars(userId, earnedStars);
  });

  broadcast({
    type: 'EXERCISE_ANSWER',
    payload: { sessionId, userId, isCorrect, earnedStars, session }
  });

  if (session.completedAt) {
    broadcast({ type: 'EXERCISE_SESSION_COMPLETE', payload: session });
  }

  return { correct: isCorrect, earnedStars, session };
}

// ============================================
// DAILY EXERCISE ASSIGNMENTS (per-user, chore-like)
// ============================================

// Local date (YYYY-MM-DD) in the configured timezone
function localDateStr(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

// Draw `count` exercises from a pool, balancing across categories
// (round-robin over shuffled per-category buckets).
function drawBalanced(pool: Exercise[], count: number): Exercise[] {
  const byCategory = new Map<string, Exercise[]>();
  for (const ex of pool) {
    if (!byCategory.has(ex.category)) byCategory.set(ex.category, []);
    byCategory.get(ex.category)!.push(ex);
  }
  const buckets = [...byCategory.values()].map(b => [...b].sort(() => Math.random() - 0.5));
  // Shuffle bucket order too, so the first category varies day to day
  buckets.sort(() => Math.random() - 0.5);

  const drawn: Exercise[] = [];
  let i = 0;
  while (drawn.length < count && buckets.some(b => b.length > 0)) {
    const bucket = buckets[i % buckets.length];
    const ex = bucket.pop();
    if (ex) drawn.push(ex);
    i++;
  }
  return drawn;
}

// Make sure every user has today's assignments drawn from their pool.
// Lazy generation: called whenever assignments are fetched.
export async function ensureDailyAssignments(): Promise<boolean> {
  const today = localDateStr(config().settings?.timezone || 'Europe/Athens');
  let created = false;

  for (const user of config().users) {
    const hasToday = store.exerciseAssignments.all('userId = ? AND date = ?', user.id, today).length > 0;
    if (hasToday) continue;

    const pool = await exercisePoolProvider.getPoolForUser(user.id);
    if (pool.length === 0) continue;

    const drawn = drawBalanced(pool, ASSIGNMENTS_PER_DAY);
    // Re-check after the await: a concurrent request may have drawn already.
    store.transaction(() => {
      if (store.exerciseAssignments.all('userId = ? AND date = ?', user.id, today).length > 0) return;
      for (const exercise of drawn) {
        store.exerciseAssignments.put({
          id: randomUUID(),
          userId: user.id,
          exerciseId: exercise.id,
          date: today,
          status: 'pending',
          attempts: 0,
          assignedAt: new Date().toISOString()
        });
      }
      created = true;
      logAction('EXERCISE_ASSIGNMENTS_CREATED', { userId: user.id, date: today, exerciseIds: drawn.map(e => e.id) });
    });
  }

  return created;
}

// Today's assignments, enriched with their exercise definitions.
export async function getExerciseAssignments(userId?: string): Promise<ExerciseAssignmentWithExercise[]> {
  await ensureDailyAssignments();
  const today = localDateStr(config().settings?.timezone || 'Europe/Athens');

  const assignments = userId
    ? store.exerciseAssignments.all('date = ? AND userId = ?', today, userId)
    : store.exerciseAssignments.all('date = ?', today);

  const enriched: ExerciseAssignmentWithExercise[] = [];
  for (const a of assignments) {
    enriched.push({ ...a, exercise: await exercisePoolProvider.getExerciseById(a.exerciseId) });
  }
  return enriched;
}

export async function broadcastAssignmentState() {
  const assignments = await getExerciseAssignments();
  broadcast({
    type: 'SYNC_STATE',
    payload: { userStars: store.allStars(), exerciseAssignments: assignments }
  });
}

// Answer a daily assignment. Correct -> completed + stars. Wrong -> retry allowed.
export async function answerExerciseAssignment(
  assignmentId: string,
  answer: unknown
): Promise<{ correct: boolean; starsAwarded: number; assignment: ExerciseAssignment }> {
  const found = store.exerciseAssignments.get(assignmentId);
  if (!found) throw new Error('Assignment not found');
  if (found.status === 'completed') throw new Error('Assignment already completed');

  const exercise = await exercisePoolProvider.getExerciseById(found.exerciseId);
  if (!exercise) throw new Error('Exercise not found in pool');

  const isCorrect = checkExerciseAnswer(exercise, answer);

  // Re-read after the await so a concurrent answer can't be lost or double-paid.
  const { assignment, starsAwarded } = store.transaction(() => {
    const current = store.exerciseAssignments.get(assignmentId);
    if (!current || current.status === 'completed') throw new Error('Assignment already completed');
    const updated: ExerciseAssignment = { ...current, attempts: current.attempts + 1 };
    let stars = 0;
    if (isCorrect) {
      stars = exercise.stars;
      updated.status = 'completed';
      updated.completedAt = new Date().toISOString();
      updated.starsAwarded = stars;
    }
    store.exerciseAssignments.put(updated);
    if (stars > 0) awardStars(updated.userId, stars);
    return { assignment: updated, starsAwarded: stars };
  });

  logAction('EXERCISE_ASSIGNMENT_ANSWER', {
    assignmentId, userId: assignment.userId, exerciseId: assignment.exerciseId,
    correct: isCorrect, attempts: assignment.attempts, starsAwarded
  });

  broadcast({
    type: 'EXERCISE_ASSIGNMENT_ANSWER',
    payload: {
      assignmentId,
      userId: assignment.userId,
      exerciseId: assignment.exerciseId,
      exerciseTitle: exercise.title,
      correct: isCorrect,
      starsAwarded
    }
  });

  await broadcastAssignmentState();

  return { correct: isCorrect, starsAwarded, assignment };
}
