import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  AppState, Chore, ChoreInstance, ConfigSaveSource, ConfigTask, ConfigUser, DataConfig, FlowRun, FlowStep, RoutineExecution, RoutineRun, Exercise, ExerciseAnswer, ExerciseAssignment,
  ExerciseAssignmentWithExercise, ExerciseCategoryDef, ExerciseSession, HISTORY_DAYS, HistoryEntry, HistoryPage, LAST_REWARDS_GIVEN,
  ProblemExercise, ProblemReading, ProblemStepAnswer, Spending, StarTransfer, StateSnapshot, ActionLog, TriggerResult, User
} from '../../shared/types';
import { drawDailySet, exercisePoolProvider, exercisesPerDay, freshLast, storyMarks } from './exercisePool';
import { calcSlip, checkCalc, checkPaint, storyWords, targetsFromMarks, type CalcLine } from '../../shared/problems';
import { DEFAULT_FORGIVENESS, plainStars, plainTries, problemStars, wrongTryCounts } from '../../shared/forgiveness';
import { currentQuestion, playerOnTurn } from '../../shared/groupGame';
import { MAX_SET_ASIDE, extraRefusals } from '../../shared/extraProblems';
import { cronMatchesAt } from './cron';
import { changedKeys, config, ConfigChange, ConfigFile, versionOf, configError, configWarnings, dataConfig, exercisesConfig, exercisesFile, ExercisesConfig } from './config';
import { DB_FILE, UPLOADS_DIR } from './paths';
import { summarize } from './schemas';
import { Store, Table } from './store';
import { Sync } from './sync';

// ============================================================================
// Domain operations. Config comes from the in-memory cache (config.ts); all
// runtime state and history is read from and written straight to the
// database (store.ts). Clients follow along through `sync`: every store write
// and config change sends them a fresh appState().
// ============================================================================

export { UPLOADS_DIR };

// Ensure uploads dir exists
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

export const sync = new Sync(appState);
export const store = new Store(DB_FILE, () => sync.changed());

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

// Everything clients render (see AppState in shared/types.ts).
export async function appState(): Promise<AppState> {
  // The config and its version from one read, before any await: a STATE never pairs a config with
  // the version of another save (a writer sends back the version it edited, #33).
  const data = dataConfig.current();
  return {
    config: data.value,
    configVersion: { data: data.version, exercises: exercisesConfig.version() },
    configError: configError(),
    configWarnings: configWarnings(),
    users: usersView(),
    spendings: recentSpendings(),
    starTransfers: recentTransfers(),
    choreInstances: getChoresWithInstances().instances,
    exerciseSessions: exerciseSessionsOnScreen(),
    exerciseAssignments: await todaysAssignments(),
    flowRuns: flowRunsView(),
    routineRuns: routineRunsView(),
    helpSeen: store.helpSeen.all().map(h => h.id)
  };
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

// Helper to convert simple cron to HH:mm for frontend display
function simpleCronToTime(cron: string): string | undefined {
  try {
    const parts = cron.split(' ');
    if (parts.length >= 2) {
      const min = parts[0];
      const hour = parts[1];
      if (!isNaN(Number(min)) && !isNaN(Number(hour))) {
        return `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
      }
    }
  } catch (e) { return undefined; }
  return undefined;
}

// Cron of the schedule that starts a routine assignment: directly, or via a flow that runs it.
function assignmentCron(assignmentId: string): string | null {
  const { schedules, flows } = config();
  const direct = schedules.find(s => s.type === 'routine' && s.targetId === assignmentId);
  if (direct) return direct.cron;

  const triggeringFlow = flows.find(f => f.steps.some(step =>
    (step.type === 'routine' && step.routineId === assignmentId) ||
    (step.type === 'parallel' && step.actions.some(a => a.type === 'routine' && a.routineId === assignmentId))
  ));
  if (!triggeringFlow) return null;
  return schedules.find(s => s.type === 'flow' && s.targetId === triggeringFlow.id)?.cron ?? null;
}

/** The tasks of a routine assignment, in order, with their durations. */
function assignmentTasks(assignmentId: string): (ConfigTask & { durationSeconds: number })[] {
  const { routineAssignments, routineTasks, tasks } = config();
  const assignment = routineAssignments.find(a => a.id === assignmentId);
  if (!assignment) return [];
  return routineTasks
    .filter(rt => rt.routineId === assignment.routineId)
    .sort((a, b) => a.order - b.order)
    .flatMap(rt => {
      const task = tasks.find(t => t.id === rt.taskId);
      return task ? [{ ...task, durationSeconds: rt.durationSeconds }] : [];
    });
}

/** Config users with their balance, what of it is available, and their assigned routines, as clients render them. */
export function usersView(): User[] {
  const { routineAssignments, routines } = config();

  return usersWithStars().map(user => ({
    ...user,
    available: getAvailableBalance(user.id),
    routines: routineAssignments
      .filter(a => a.userId === user.id)
      .flatMap(assignment => {
        const routine = routines.find(r => r.id === assignment.routineId);
        if (!routine) return [];
        const cronExpression = assignmentCron(assignment.id) ?? undefined;
        return [{
          id: assignment.id,
          title: routine.title,
          scheduleTime: cronExpression ? simpleCronToTime(cronExpression) : undefined,
          cronExpression,
          themeColor: assignment.themeColor || routine.themeColor,
          icon: routine.icon,
          tasks: assignmentTasks(assignment.id)
            .map(t => ({ id: t.id, title: t.title, icon: t.icon, durationSeconds: t.durationSeconds }))
        }];
      })
  }));
}

function findUser(userId: string): UserWithStars | undefined {
  return usersWithStars().find(u => u.id === userId);
}

/** Mutable copy of data.json (for editors that change it and save it back). */
export function readRawConfig(): DataConfig {
  return dataConfig.raw();
}

/** A config save that names a version older than the live one (another screen saved, or the file changed on disk). */
export class ConfigConflict extends Error {}

/** How a screen saves a config file: what it edited and who it is (see ConfigFile.save, ConfigSaveSource). */
export interface ConfigSave {
  replace?: boolean; // only the Advanced JSON editor: may replace an invalid file (#45)
  version?: string; // the version it edited; none: not checked
  source?: ConfigSaveSource;
  route?: string; // for the log: 'POST /api/admin/data'
}

/**
 * Validate and save a config file; returns the new version. Throws ConfigConflict when `version` is
 * older than the live one, and an Error when the data is invalid or the file on disk is (see
 * ConfigFile.save). Every save is logged as CONFIG_SAVED with the top-level keys it changed, and every
 * refused stale one as CONFIG_SAVE_STALE.
 */
function saveConfigFile<T extends object>(file: ConfigFile<T>, data: unknown, options: ConfigSave, invalid: string): string {
  const { source = 'api', route, version } = options;
  const name = path.basename(file.file);
  const before = file.get();
  const current = file.version();
  const error = file.save(data, options);
  if (error?.conflict) {
    logAction('CONFIG_SAVE_STALE', { file: name, source, route, version, current });
    throw new ConfigConflict(error.message);
  }
  if (error) throw new Error(error.errors.length ? `${invalid}: ${summarize(error.errors)}` : error.message);
  logAction('CONFIG_SAVED', { file: name, source, route, changed: changedKeys(before, file.get()) });
  sync.changed();
  return file.version();
}

/** Validate and save data.json (see saveConfigFile); returns its new version. */
export function writeRawConfig(data: unknown, options: ConfigSave = {}): string {
  return saveConfigFile(dataConfig, data, options, 'Validation failed');
}

export function readRawExercises(): ExercisesConfig {
  return exercisesConfig.raw();
}

/** Validate and save exercises.json (see saveConfigFile); returns its new version. */
export function writeRawExercises(data: unknown, options: ConfigSave = {}): string {
  return saveConfigFile(exercisesConfig, data, options, 'Exercises validation failed');
}

/**
 * Log what the watcher's reload found new on disk (#98): CONFIG_RELOADED { file, changed } for each file
 * that changed (a hand edit; `restored: true` when a broken edit went back to the live text), CONFIG_INVALID
 * { file, message } once per bad text. The server's own saves never reach it (the reload after one finds
 * the text it wrote), and the reload at startup isn't logged.
 */
export function logConfigReload(change: ConfigChange | null): void {
  for (const report of change?.files ?? []) {
    const { type, ...details } = report;
    logAction(type === 'updated' ? 'CONFIG_RELOADED' : 'CONFIG_INVALID', details);
  }
}

// ============================================
// ROUTINES AND FLOWS ON SCREEN
// ============================================
// The server runs flows and routines; clients render flowRuns/routineRuns and
// report what the kids do: dismiss an alarm, finish a task, close a routine.
// A flow step is an alarm (it waits to be dismissed) or starts routines and
// sub-flows (it waits until they have all closed). After the last step the run
// ends and, if a parallel step of another run started it, that run moves on.

const ALARM_ONLY: FlowStep[] = [{ type: 'alarm', props: { sound: 'melody' } }];

/**
 * Start a routine assignment or a flow (schedule, push hook); 'alarm' shows
 * a plain alarm, always, even with an assignment or a flow of that id (#121;
 * the config checks warn about one). A user already in a routine keeps it; a
 * running flow restarts. A flow that ended at once started nothing on screen
 * (its routines busy or done today, or a cycle refused: `cycle`).
 */
export function triggerAction(id: string, source: string = 'unknown'): TriggerResult | null {
  const { routineAssignments, flows } = config();
  return store.transaction(() => {
    if (id !== 'alarm' && routineAssignments.some(a => a.id === id)) {
      const run = startRoutine(id);
      logAction(run.started ? 'TRIGGER_ROUTINE' : 'TRIGGER_ROUTINE_SKIPPED', { id, source, runId: run.id });
      return run.started
        ? { success: true, type: 'assignment', id }
        : { success: true, skipped: true, type: 'assignment', id, runningId: run.id };
    }
    const steps = id === 'alarm' ? ALARM_ONLY : flows.find(f => f.id === id)?.steps;
    if (steps) {
      const refused = cyclesRefused;
      const runId = startFlow(id, steps);
      logAction('TRIGGER_FLOW', { id, source, runId });
      return store.flowRuns.get(runId)
        ? { success: true, type: 'flow', id }
        : { success: true, type: 'flow', id, nothingStarted: true, cycle: cyclesRefused > refused };
    }
    logAction('TRIGGER_FAILED', { id, source, reason: 'Not found' });
    return null;
  });
}

// A user has at most one routine on screen. A flow doesn't start a routine she
// already finished today (#58); started by itself (push, its own schedule,
// «Ξεκίνα τώρα» on the routine), it starts again.
function startRoutine(assignmentId: string, flowRunId?: string): { started: boolean; id: string } {
  const assignment = config().routineAssignments.find(a => a.id === assignmentId);
  if (!assignment) return { started: false, id: '' };
  closeStaleRoutines(assignment.userId);
  const [running] = store.routineRuns.all('userId = ?', assignment.userId);
  if (running) return { started: false, id: running.id };
  if (flowRunId) {
    const done = finishedToday(assignment.userId, assignment.routineId);
    if (done) {
      logAction('FLOW_ROUTINE_SKIPPED', { assignmentId, userId: assignment.userId, flowRunId, reason: 'done-today', executionId: done.id });
      return { started: false, id: done.id };
    }
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  store.routineExecutions.put({ id, userId: assignment.userId, routineId: assignment.routineId, startedAt: now, totalStars: 0 });
  store.routineRuns.put({ id, userId: assignment.userId, routineId: assignmentId, taskIndex: 0, taskStartedAt: now, flowRunId });
  return { started: true, id };
}

// Her execution of a routine (the routine's id, not the assignment's) started today
// in settings.timezone, as closeStaleRoutines counts days, and finished (every task done).
// A start she left with ✕ doesn't count. The latest, if she did it more than once.
function finishedToday(userId: string, routineId: string): RoutineExecution | undefined {
  const timezone = config().settings?.timezone || 'Europe/Athens';
  const done = store.routineExecutions.all(
    'userId = ? AND routineId = ? AND completedAt IS NOT NULL AND startedAt >= ?',
    userId, routineId, dayStart(timezone));
  return done[done.length - 1];
}

// Triggering a flow that is already running restarts it, so an alarm nobody
// dismissed can't block tomorrow's schedule.
function startFlow(flowId: string, steps: readonly FlowStep[], parentRunId?: string): string {
  for (const old of store.flowRuns.all('flowId = ?', flowId)) {
    dropFlow(old.id);
    if (old.parentRunId) childClosed(old.parentRunId);
  }
  const run: FlowRun = { id: randomUUID(), flowId, steps: structuredClone(steps) as FlowStep[], stepIndex: 0, parentRunId, startedAt: new Date().toISOString() };
  startingFlows.push(flowId);
  try {
    enterStep(run, 0);
  } finally {
    startingFlows.pop();
  }
  return run.id;
}

// The flows whose start is under way, outermost first: everything a flow starts before it first waits
// (an alarm, a routine, a sub-flow that waits) happens inside its startFlow. A flow action naming one of
// them would start it again from inside itself, for ever (A → A, A → B → A: the stack overflowed, #121),
// so it starts nothing and the step goes on with its other actions. A flow started again later, after an
// alarm or a routine (A: alarm, then A), isn't among them: it restarts, as from a schedule.
const startingFlows: string[] = [];
let cyclesRefused = 0; // how many actions were refused so, for triggerAction's answer

// Runs whose step is still starting its routines and sub-flows: a sub-flow that
// ends at once must not move the parent on before its siblings have started.
const starting = new Set<string>();

function enterStep(run: FlowRun, stepIndex: number): void {
  const step = run.steps[stepIndex];
  if (!step) return endFlow(run);
  store.flowRuns.put({ ...run, stepIndex, stepStartedAt: new Date().toISOString() });
  if (step.type === 'alarm') return; // waits for dismissAlarm

  const actions = step.type === 'routine' ? [{ type: 'routine' as const, routineId: step.routineId }] : step.actions;
  starting.add(run.id);
  try {
    for (const action of actions) {
      if (action.type === 'routine') startRoutine(action.routineId, run.id);
      else if (startingFlows.includes(action.flowId)) {
        cyclesRefused++;
        const chain = [...startingFlows.slice(startingFlows.indexOf(action.flowId)), action.flowId];
        logAction('FLOW_CYCLE', { flowId: action.flowId, runId: run.id, stepIndex, chain });
      } else {
        const flow = config().flows.find(f => f.id === action.flowId);
        if (flow) startFlow(flow.id, flow.steps, run.id);
      }
    }
  } finally {
    starting.delete(run.id);
  }
  childClosed(run.id); // moves on right away if nothing was started (all busy or missing)
}

// Remove a run and its sub-flows. Their routines stay on screen.
function dropFlow(runId: string): void {
  for (const child of store.flowRuns.all('parentRunId = ?', runId)) dropFlow(child.id);
  store.flowRuns.deleteWhere('id = ?', runId);
}

function endFlow(run: FlowRun): void {
  store.flowRuns.deleteWhere('id = ?', run.id);
  if (run.parentRunId) childClosed(run.parentRunId);
}

// A routine or sub-flow of this run closed: move on once none is left.
function childClosed(runId: string): void {
  const run = store.flowRuns.get(runId);
  if (!run || starting.has(runId) || run.steps[run.stepIndex]?.type === 'alarm') return;
  const waiting = store.routineRuns.all('flowRunId = ?', runId).length + store.flowRuns.all('parentRunId = ?', runId).length;
  if (waiting === 0) enterStep(run, run.stepIndex + 1);
}

/**
 * Alarms nobody dismissed within `settings.alarmMinutes` (default 60) stop, and their
 * flow with them: the moment has passed, so a screen opened later doesn't wake anyone,
 * and the routines after it don't start late. A parent flow waiting for it moves on.
 * Runs every minute and at startup.
 */
export function expireAlarms(now: Date = new Date()): number {
  return store.transaction(() => {
    const limit = (config().settings?.alarmMinutes ?? 60) * 60_000;
    const expired = store.flowRuns.all().filter(run =>
      run.steps[run.stepIndex]?.type === 'alarm' &&
      now.getTime() - new Date(run.stepStartedAt ?? run.startedAt).getTime() >= limit);
    for (const run of expired) {
      if (!store.flowRuns.get(run.id)) continue; // gone with a parent that expired first
      logAction('ALARM_EXPIRED', { runId: run.id, flowId: run.flowId, stepIndex: run.stepIndex });
      dropFlow(run.id);
      if (run.parentRunId) childClosed(run.parentRunId);
    }
    return expired.length;
  });
}

/** A kid dismissed the alarm at `stepIndex` of a run. Repeats (a second device) are no-ops. */
export function dismissAlarm(runId: string, stepIndex: number): boolean {
  return store.transaction(() => {
    const run = store.flowRuns.get(runId);
    if (!run || run.stepIndex !== stepIndex || run.steps[stepIndex]?.type !== 'alarm') return false;
    logAction('ALARM_DISMISSED', { runId, flowId: run.flowId, stepIndex });
    enterStep(run, stepIndex + 1);
    return true;
  });
}

/**
 * A routine left the screen (reward shown, or the kid pressed ✕), or a parent ended it from
 * /parent («Τέλος», #63): the same close, and the kids' screens hear it was a parent's, so her
 * lane says so instead of just vanishing. Repeats are no-ops.
 */
export function closeRoutine(runId: string, by: 'kid' | 'parent' = 'kid'): boolean {
  const run = store.transaction(() => {
    const run = store.routineRuns.get(runId);
    if (run) endRoutine(run, 'ROUTINE_CLOSED');
    return run;
  });
  if (run && by === 'parent' && !run.finishedAt) sync.notify({ type: 'ROUTINE_ENDED_BY_PARENT', payload: { runId, userId: run.userId, routineId: run.routineId } });
  return !!run;
}

function endRoutine(run: Omit<RoutineRun, 'totalStars'>, logType: string): void {
  store.routineRuns.deleteWhere('id = ?', run.id);
  logAction(logType, { runId: run.id, userId: run.userId, finished: !!run.finishedAt });
  if (run.flowRunId) childClosed(run.flowRunId);
}

/**
 * Close routines started before today (local time): left open when the kid
 * walked away or the kiosk was off. Runs when a routine is triggered for the
 * user and every minute, so an old run never blocks or lingers.
 */
export function closeStaleRoutines(userId?: string): number {
  return store.transaction(() => {
    const timezone = config().settings?.timezone || 'Europe/Athens';
    const today = localDateStr(timezone);
    const runs = userId ? store.routineRuns.all('userId = ?', userId) : store.routineRuns.all();
    const stale = runs.filter(run => {
      const startedAt = store.routineExecutions.get(run.id)?.startedAt ?? run.taskStartedAt;
      return localDateStr(timezone, new Date(startedAt)) < today;
    });
    stale.forEach(run => endRoutine(run, 'ROUTINE_CLOSED_STALE'));
    return stale.length;
  });
}

/** Flow runs as clients render them: a run waiting at an alarm says whom the alarm is for. */
function flowRunsView(): FlowRun[] {
  return store.flowRuns.all().map(run =>
    run.steps[run.stepIndex]?.type === 'alarm' ? { ...run, userIds: alarmUserIds(run.steps, run.stepIndex + 1) } : run);
}

/**
 * The kids an alarm is for: those of the routines the steps after it start, through
 * sub-flows, up to the next alarm (it has its own), in config order. Empty: everyone.
 */
function alarmUserIds(steps: readonly FlowStep[], from: number): string[] {
  const { users, routineAssignments, flows } = config();
  const kids = new Set<string>();
  const seen = new Set<string>(); // sub-flows walked, so a flow that starts itself ends
  const walk = (steps: readonly FlowStep[], from: number): void => {
    for (const step of steps.slice(from)) {
      if (step.type === 'alarm') return;
      const actions = step.type === 'routine' ? [{ type: 'routine' as const, routineId: step.routineId }] : step.actions;
      for (const action of actions) {
        if (action.type === 'routine') {
          const userId = routineAssignments.find(a => a.id === action.routineId)?.userId;
          if (userId) kids.add(userId);
        } else if (!seen.has(action.flowId)) {
          seen.add(action.flowId);
          const flow = flows.find(f => f.id === action.flowId);
          if (flow) walk(flow.steps, 0);
        }
      }
    }
  };
  walk(steps, from);
  return users.map(u => u.id).filter(id => kids.has(id));
}

/** Routine runs as clients render them, with the stars earned so far. */
function routineRunsView(): RoutineRun[] {
  return store.routineRuns.all().map(run => ({ ...run, totalStars: store.routineExecutions.get(run.id)?.totalStars ?? 0 }));
}

export type TaskCompletion =
  | { success: true; starsAwarded: number }
  | { success: false; error: string };

/**
 * A kid finished the current task of a routine run. The server times it and
 * awards the stars; `taskId` must be the current task, so a second device (or
 * a double tap) can't complete the next one too.
 */
export function completeTask(runId: string, taskId: string): TaskCompletion {
  return store.transaction(() => {
    const run = store.routineRuns.get(runId);
    const execution = store.routineExecutions.get(runId);
    if (!run || !execution || run.finishedAt) return { success: false, error: 'Routine is not running' };
    const tasks = assignmentTasks(run.routineId);
    const task = tasks[run.taskIndex];
    if (!task || task.id !== taskId) return { success: false, error: 'Not the current task' };

    const now = new Date();
    const duration = Math.round((now.getTime() - new Date(run.taskStartedAt).getTime()) / 1000);
    const isOnTime = duration <= task.durationSeconds;
    const stars = isOnTime ? (task.stars || 0) : (task.lateStars ?? 0);
    store.taskExecutions.put({ id: randomUUID(), executionId: runId, taskId, duration, isOnTime, completedAt: now.toISOString() });
    const last = run.taskIndex + 1 >= tasks.length;
    store.routineExecutions.put({
      ...execution, totalStars: (execution.totalStars || 0) + stars, ...(last ? { completedAt: now.toISOString() } : {})
    });
    store.routineRuns.put(last
      ? { ...run, finishedAt: now.toISOString() }
      : { ...run, taskIndex: run.taskIndex + 1, taskStartedAt: now.toISOString() });
    if (stars > 0) awardStars(execution.userId, stars);
    logAction('TASK_COMPLETE', { executionId: runId, taskId, starsAwarded: stars, userId: execution.userId, duration, isOnTime });
    return { success: true, starsAwarded: stars };
  });
}

// ============================================
// STARS, SPENDINGS, TRANSFERS
// ============================================

function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

// STATE carries the current world, never the archive (see AppState): what is pending whatever its age,
// what was decided in the last HISTORY_DAYS, and each kid's last rewards given. Records name kids and
// rewards by id. Both read their whole table (no index on the time): fine at a family's rate.
const historyCutoff = () => new Date(Date.now() - HISTORY_DAYS * 864e5).toISOString();

export function recentSpendings(): Spending[] {
  return store.spendings.all(`status = 'pending' OR COALESCE(resolvedAt, createdAt) > ? OR id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY userId ORDER BY COALESCE(resolvedAt, createdAt) DESC, id DESC) AS n
        FROM spendings WHERE status = 'done'
      ) WHERE n <= ?)`, historyCutoff(), LAST_REWARDS_GIVEN).sort(byNewest);
}

export function recentTransfers(): StarTransfer[] {
  return store.starTransfers.all(`status = 'pending' OR COALESCE(resolvedAt, createdAt) > ?`, historyCutoff()).sort(byNewest);
}

export const HISTORY_PAGE = 30;

// The cursor of a page: the last entry's time and id ("<at>|<id>"); the next page starts below it.
const cursorOf = (e: HistoryEntry) => `${e.at}|${entryId(e)}`;
const entryId = (e: HistoryEntry) => (e.kind === 'spending' ? e.spending : e.kind === 'transfer' ? e.transfer : e.instance).id;
const newestFirst = (a: HistoryEntry, b: HistoryEntry) =>
  a.at !== b.at ? (a.at < b.at ? 1 : -1) : entryId(a) < entryId(b) ? 1 : entryId(a) > entryId(b) ? -1 : 0;

/**
 * What was decided, newest first, a page at a time (Ιστορικό, GET /api/history): purchases given or
 * revoked, gifts approved, rejected or cancelled, and chores confirmed or rejected, each at the time it
 * was decided. `before` is the previous page's `next`; `userId` keeps what names that kid.
 */
export function history({ before, limit = HISTORY_PAGE, userId }: { before?: string; limit?: number; userId?: string } = {}): HistoryPage {
  const [at, id] = before ? before.split('|') : [];
  // Each table's newest `limit + 1` below the cursor (`kid` takes the one parameter userId); the page is
  // the newest `limit` of them all
  const page = <T extends { id: string }>(table: Table<T>, decided: string, time: string, kid: string): T[] => {
    const where = [decided, ...(before ? [`(${time}, id) < (?, ?)`] : []), ...(userId ? [kid] : [])].join(' AND ');
    const params = [...(before ? [at, id] : []), ...(userId ? [userId] : []), limit + 1];
    return table.all(`id IN (SELECT id FROM ${table.name} WHERE ${where} ORDER BY ${time} DESC, id DESC LIMIT ?)`, ...params);
  };
  const entries: HistoryEntry[] = [
    ...page(store.spendings, "status != 'pending'", 'COALESCE(resolvedAt, createdAt)', 'userId = ?')
      .map(spending => ({ kind: 'spending' as const, at: spending.resolvedAt ?? spending.createdAt, spending })),
    ...page(store.starTransfers, "status != 'pending'", 'COALESCE(resolvedAt, createdAt)', '? IN (fromUserId, toUserId)')
      .map(transfer => ({ kind: 'transfer' as const, at: transfer.resolvedAt ?? transfer.createdAt, transfer })),
    ...page(store.choreInstances, "status IN ('confirmed', 'rejected')", 'COALESCE(confirmedAt, rejectedAt, availableAt)', 'claimedBy = ?')
      .map(instance => ({ kind: 'chore' as const, at: instance.confirmedAt ?? instance.rejectedAt ?? instance.availableAt, instance })),
  ].sort(newestFirst);
  const shown = entries.slice(0, limit);
  return { entries: shown, next: entries.length > limit ? cursorOf(shown[shown.length - 1]) : null };
}

export function readLastLogs(limit: number): ActionLog[] {
  return store.recentLogs(limit);
}

// The stars invariant: a kid's available stars are her balance minus the stars
// promised in her pending outgoing gifts (getAvailableBalance), and no balance
// goes below zero. Every star change goes through the functions below, each in
// one transaction: buying a reward, a parent's take-away and a new gift check
// the available stars; approving a gift re-checks the sender's balance. Stars
// are added only by awardStars (positive amounts), a refund and an approved
// gift. Only the whole-state writers set balances directly: replaceState (the
// admin state editor) and the one-time legacy import (migrate.ts).

/** A refused star operation: the routes send `status` with `message` (shown to the parent as a toast). */
export class StarsError extends Error {
  constructor(public status: 400 | 404, message: string) { super(message); }
}

function promisedStars(userId: string): number {
  return store.starTransfers
    .all("fromUserId = ? AND status = 'pending'", userId)
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Stars a kid can spend or give now: her balance minus what pending gifts promise. */
export function getAvailableBalance(userId: string): number {
  return store.getStars(userId) - promisedStars(userId);
}

function knownUser(userId: string): UserWithStars {
  const user = findUser(userId);
  if (!user) throw new StarsError(404, 'User not found');
  return user;
}

// Takes `amount` from the kid's available stars, or refuses with the reason.
// Call it inside the transaction that records what the stars paid for.
function spendAvailable(user: UserWithStars, amount: number): number {
  const available = getAvailableBalance(user.id);
  if (available < amount) {
    const promised = promisedStars(user.id);
    throw new StarsError(400, promised > 0
      ? `${user.name}: διαθέσιμα ⭐ ${available} · ⭐ ${promised} περιμένουν σε δώρο. Απορρίψτε πρώτα το δώρο.`
      : `${user.name}: διαθέσιμα ⭐ ${available}, χρειάζονται ⭐ ${amount}`);
  }
  return addStars(user.id, -amount);
}

function addStars(userId: string, delta: number): number {
  const total = store.getStars(userId) + delta;
  store.setStars(userId, total);
  return total;
}

/** Stars earned or given by a parent (a positive whole number). */
export function awardStars(userId: string, amount: number): { success: boolean; newTotal: number } {
  if (!Number.isInteger(amount) || amount <= 0) throw new StarsError(400, 'amount must be a positive integer');
  knownUser(userId);
  const newTotal = store.transaction(() => addStars(userId, amount));
  logAction('AWARD_STARS', { userId, amount, newBalance: newTotal });
  return { success: true, newTotal };
}

/** A parent takes stars away: only what isn't promised in a gift. Logged as an award of −amount, as before. */
export function takeStars(userId: string, amount: number): { success: boolean; newTotal: number } {
  if (!Number.isInteger(amount) || amount <= 0) throw new StarsError(400, 'amount must be a positive integer');
  const user = knownUser(userId);
  const newTotal = store.transaction(() => spendAvailable(user, amount));
  logAction('AWARD_STARS', { userId, amount: -amount, newBalance: newTotal });
  return { success: true, newTotal };
}

/** A kid buys a reward: it waits for a parent (pending) and is paid now from her available stars. */
export function buyReward(userId: string, rewardId: string): Spending {
  const user = findUser(userId);
  const reward = config().rewards.find(r => r.id === rewardId);
  if (!user || !reward) throw new StarsError(404, 'User or Reward not found');
  const spending: Spending = {
    id: randomUUID(), userId, rewardId, cost: reward.cost, createdAt: new Date().toISOString(), status: 'pending'
  };
  const newBalance = store.transaction(() => {
    const balance = spendAvailable(user, reward.cost);
    store.spendings.put(spending);
    return balance;
  });
  logAction('SPEND_STARS', { userId, rewardId, cost: reward.cost, newBalance });
  return spending;
}

/** A parent marks a reward given (done) or revokes it, which refunds its stars. */
export function resolveSpending(id: string, status: Spending['status']): Spending {
  const spending = store.spendings.get(id);
  if (!spending) throw new StarsError(404, 'Spending not found');
  if (status !== 'done' && status !== 'revoked') throw new StarsError(400, 'Invalid status');
  if (spending.status === 'revoked') throw new StarsError(400, 'Spending is already revoked');
  const updated: Spending = { ...spending, status, resolvedAt: new Date().toISOString() };
  store.transaction(() => {
    if (status === 'revoked' && findUser(spending.userId)) addStars(spending.userId, spending.cost);
    store.spendings.put(updated);
  });
  logAction(`SPENDING_${status.toUpperCase()}`, { spendingId: id, userId: spending.userId, rewardId: spending.rewardId, cost: spending.cost });
  return updated;
}

/** A kid gives stars to another: they stay hers, promised, until a parent approves or rejects. */
export function createGift(fromUserId: string, toUserId: string, amount: number): StarTransfer {
  const from = findUser(fromUserId);
  if (!from || !findUser(toUserId)) throw new StarsError(404, 'User not found');
  if (fromUserId === toUserId) throw new StarsError(400, 'Cannot transfer stars to yourself');
  if (!Number.isInteger(amount) || amount <= 0) throw new StarsError(400, 'Amount must be positive');
  const transfer: StarTransfer = {
    id: randomUUID(), fromUserId, toUserId, amount, createdAt: new Date().toISOString(), status: 'pending'
  };
  store.transaction(() => {
    const available = getAvailableBalance(fromUserId);
    if (available < amount) throw new StarsError(400, `${from.name}: διαθέσιμα ⭐ ${available}, χρειάζονται ⭐ ${amount}`);
    store.starTransfers.put(transfer);
  });
  logAction('TRANSFER_REQUEST', { fromUserId, toUserId, amount, transferId: transfer.id });
  return transfer;
}

/** A parent approves or rejects a gift, or the kid cancels it. Approving moves the stars, if the sender still has them. */
export function resolveGift(id: string, action: 'approve' | 'reject' | 'cancel'): StarTransfer {
  const transfer = store.starTransfers.get(id);
  if (!transfer) throw new StarsError(404, 'Transfer not found');
  if (transfer.status !== 'pending') throw new StarsError(400, 'Transfer is already resolved');
  const outcomes = { approve: 'approved', reject: 'rejected', cancel: 'cancelled' } as const;
  const status = outcomes[action];
  if (!status) throw new StarsError(400, 'Invalid action');
  // Approving moves the stars, so both kids must still be in the config. Cancelling or rejecting
  // moves none and only releases the promise: it works for a kid who has left the config too (#47).
  const from = findUser(transfer.fromUserId);
  if (status === 'approved' && (!from || !findUser(transfer.toUserId))) throw new StarsError(404, 'User not found');

  const resolved: StarTransfer = { ...transfer, status, resolvedAt: new Date().toISOString() };
  store.transaction(() => {
    if (status === 'approved' && from) {
      // The promise was checked when the gift was made; only a whole-state write can have broken it since.
      if (store.getStars(from.id) < transfer.amount) {
        throw new StarsError(400, `${from.name}: δεν υπάρχουν πια ⭐ ${transfer.amount} για αυτό το δώρο`);
      }
      addStars(transfer.fromUserId, -transfer.amount);
      addStars(transfer.toUserId, transfer.amount);
    }
    store.starTransfers.put(resolved);
  });
  logAction(`TRANSFER_${status.toUpperCase()}`, { transferId: id, fromUserId: transfer.fromUserId, toUserId: transfer.toUserId, amount: transfer.amount });
  return resolved;
}

// ============================================
// ADMIN STATE EDITOR
// ============================================

// The Κατάσταση (JSON) editor replaces the whole runtime state, so a save from an editor opened before
// something else changed it (a chore confirmed on a phone, a task done) would undo that. Like a config
// save (#33), it names the version it edited (#98): the hash of the snapshot's JSON, exactly as
// GET /api/admin/state returned it (X-State-Version). The snapshot reads every table in insertion order
// (ORDER BY rowid; an update keeps a record's rowid), so an untouched state always hashes the same, and
// the hash is taken only when the editor opens or saves, never per STATE. Strict on purpose: while the
// kids are busy a save is often refused, and the editor is a last resort.

export function stateSnapshot(): StateSnapshot {
  return store.snapshot();
}

/** The snapshot as GET /api/admin/state sends it, and its version (the hash of exactly that text). */
export function stateText(): { text: string; version: string } {
  const text = JSON.stringify(store.snapshot());
  return { text, version: versionOf(text) };
}

const stateVersion = (snapshot: StateSnapshot) => versionOf(JSON.stringify(snapshot));

/** A state save that names a version other than the live one: something changed the state since the editor opened. */
export class StateConflict extends Error {}

export const STATE_STALE = 'Η κατάσταση άλλαξε στο μεταξύ (από άλλη οθόνη ή από τα παιδιά). Φόρτωσε ξανά και κάνε την αλλαγή σου πάλι.';

export type StateSaveSource = 'advanced' | 'api';

/**
 * Replace the whole runtime state (validated by the caller); returns its new version. With `version`, the
 * live state must still be that one, checked in the same transaction as the replace: otherwise nothing is
 * written, STATE_REPLACE_STALE is logged and StateConflict thrown. Without one it is not checked (scripts,
 * curl). Every save is logged as STATE_REPLACED: each balance it moved as [before, after] (a kid missing on
 * one side counts 0), the snapshot's collections that differ, and the flows and routines on screen it ended.
 */
export function replaceState(state: StateSnapshot, { version, source = 'api' }: { version?: string; source?: StateSaveSource } = {}): string {
  const saved = store.transaction(() => {
    const before = store.snapshot();
    const current = stateVersion(before);
    if (version !== undefined && version !== current) {
      // Nothing written; logged after the transaction (a throw in it would roll the entry back too)
      return { stale: current };
    }
    const cleared = { flowRuns: store.flowRuns.count(), routineRuns: store.routineRuns.count() };
    store.replaceState(state);
    const after = store.snapshot();
    const kids = [...new Set([...Object.keys(before.userStars), ...Object.keys(after.userStars)])];
    const stars = Object.fromEntries(kids
      .map(kid => [kid, [before.userStars[kid] ?? 0, after.userStars[kid] ?? 0]])
      .filter(([, [was, now]]) => was !== now));
    logAction('STATE_REPLACED', { source, stars, changed: changedKeys(before, after), cleared });
    return { version: stateVersion(after) };
  });
  if ('stale' in saved) {
    logAction('STATE_REPLACE_STALE', { source, version, current: saved.stale });
    throw new StateConflict(STATE_STALE);
  }
  return saved.version;
}

// ============================================
// CHORES SYSTEM
// ============================================

// A cron the scheduler can't read (a file on disk can still have one: it loads with a warning, #89) is
// logged once per schedule or chore and cron (again after it changes or the server restarts), not every
// minute: the action log isn't pruned.
const cronErrorsLogged = new Map<string, string>();

/**
 * Whether `cron` names this minute (cron.ts, in `timezone`). One it can't read is false, logged as
 * `unreadable.type` with `unreadable.details`, the cron and the reason, once per `unreadable.key` and cron.
 */
export function cronDue(cron: string, now: Date, timezone: string,
  unreadable: { key: string; type: 'SCHEDULE_CRON_ERROR' | 'CHORE_CRON_ERROR'; details: Record<string, unknown> }): boolean {
  try {
    const due = cronMatchesAt(cron, now, timezone);
    cronErrorsLogged.delete(unreadable.key);
    return due;
  } catch (err) {
    const error = (err as Error).message;
    const memo = `${cron}\n${error}`;
    if (cronErrorsLogged.get(unreadable.key) !== memo) {
      cronErrorsLogged.set(unreadable.key, memo);
      logAction(unreadable.type, { ...unreadable.details, cron, error });
    }
    return false;
  }
}

const choreDue = (chore: Chore, now: Date, timezone: string) => cronDue(chore.availabilityCron, now, timezone,
  { key: `chore:${chore.id}`, type: 'CHORE_CRON_ERROR', details: { choreId: chore.id } });

// Generate chore instances when their cron names this minute (cron.ts, settings.timezone). Always the real
// clock: /api/debug/time doesn't make chores.
export function generateChoreInstances(): ChoreInstance[] {
  const { chores = [], settings } = config();
  const timezone = settings?.timezone || 'Europe/Athens';
  const now = new Date();
  const newInstances: ChoreInstance[] = [];

  for (const chore of chores) {
    if (!choreDue(chore, now, timezone)) continue;

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
      sync.notify({
        type: 'CHORE_EXPIRED',
        payload: { instanceId: instance.id, choreId: instance.choreId, choreTitle: chore?.title, userId: instance.claimedBy }
      });
    }
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
  if (!findUser(userId)) throw new Error(`User not found: ${userId}`);

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

  return claimed;
}

// Mark chore as attempted (user says "I did it!")
export function attemptChore(instanceId: string): ChoreInstance {
  const instance = getChoreInstance(instanceId);

  if (instance.status !== 'claimed') {
    throw new Error(`Chore must be claimed first (status: ${instance.status})`);
  }

  const attempted: ChoreInstance = { ...instance, status: 'attempted', attemptedAt: new Date().toISOString() };
  store.choreInstances.put(attempted);

  logAction('CHORE_ATTEMPTED', { instanceId, choreId: instance.choreId, userId: instance.claimedBy });

  return attempted;
}

// Confirm chore completion (parent approves)
export function confirmChore(instanceId: string, starsOverride?: number): ChoreInstance {
  // What it pays is stored as starsAwarded, so a parent's override is a whole number, 0 or more (state.schema.json)
  if (starsOverride !== undefined && !(Number.isInteger(starsOverride) && starsOverride >= 0)) {
    throw new StarsError(400, 'stars must be a whole number, 0 or more');
  }
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
  sync.notify({
    type: 'CHORE_CONFIRMED',
    payload: { instanceId, choreId: instance.choreId, choreTitle: chore?.title, userId, starsAwarded: stars }
  });

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
  sync.notify({
    type: 'CHORE_REJECTED',
    payload: { instanceId, choreId: instance.choreId, choreTitle: chore?.title, userId: instance.claimedBy }
  });

  return rejected;
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
      // Problems are answered step by step (checkProblemStep)
      return false;
  }
}

// Check one step of a problem. `wrong` names the parts to look at again: the
// marked phrases (tag), the rows (numbers) or the positions (order) that are off.
export function checkProblemStep(
  exercise: ProblemExercise,
  stepIndex: number,
  value: any,
  reading: ProblemReading = 'marked'
): { correct: boolean; wrong?: number[] } {
  const step = exercise.steps[stepIndex];
  if (!step) return { correct: false };
  const compare = (expected: unknown[]) => {
    if (!Array.isArray(value) || value.length !== expected.length) return { correct: false };
    const wrong = expected.flatMap((e, i) => (value[i] === e ? [] : [i]));
    return wrong.length ? { correct: false, wrong } : { correct: true };
  };
  switch (step.kind) {
    // Reading the story, on the kid's rung: roles for the marked phrases, or a painting
    case 'tag':
    case 'paint':
      if (Array.isArray(value)) return compare(storyMarks(exercise.story).map(m => m.role));
      return checkPaint(step.kind === 'paint' ? step.targets : targetsFromMarks(exercise.story),
        storyWords(exercise.story), value, { unneeded: reading === 'paint-all' });
    case 'choice':
      return { correct: value === step.correctIndex };
    case 'numbers':
      return compare(step.rows.map(r => r.answer));
    case 'order':
      return compare(step.items);
    case 'calc':
      return checkCalc(step, value?.lines);
  }
}

/** How long a finished group game stays on the screens with its results, unless «Επιστροφή» closes it first. */
export const GAME_RESULTS_MINUTES = 30;
const resultsSince = (now: Date) => new Date(now.getTime() - GAME_RESULTS_MINUTES * 60_000).toISOString();

/**
 * The group games on screen: the running ones, then those finished in the last GAME_RESULTS_MINUTES
 * and not closed, newest first. Older finished games are kept but never shown again.
 */
export function exerciseSessionsOnScreen(now = new Date()): ExerciseSession[] {
  const finished = store.exerciseSessions.all('completedAt > ? AND dismissedAt IS NULL', resultsSince(now));
  return [
    ...store.exerciseSessions.all('completedAt IS NULL'),
    ...finished.sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
  ];
}

/**
 * The finished games whose results window ended in (since, now]: the minute check sends a STATE
 * when there are any, so the results leave the screens on time.
 */
export function gameResultsLeaving(since: Date, now: Date): ExerciseSession[] {
  return store.exerciseSessions.all('completedAt > ? AND completedAt <= ? AND dismissedAt IS NULL',
    resultsSince(since), resultsSince(now));
}

export function getExerciseSession(sessionId: string): ExerciseSession | undefined {
  return store.exerciseSessions.get(sessionId);
}

/** A group game's size: what the setup screen offers (ExerciseSetup), and the route's schema (bodies.ts). */
export const GAME_LIMITS = { players: 10, rounds: 5, questionsPerRound: 10 } as const;
const oneTo = (n: number, max: number) => Number.isInteger(n) && n >= 1 && n <= max;

export function startExerciseSession(
  playerIds: string[],
  categories: string[],
  totalRounds: number,
  questionsPerRound: number
): ExerciseSession {
  const { players, rounds, questionsPerRound: perRound } = GAME_LIMITS;
  if (!oneTo(playerIds.length, players) || !oneTo(totalRounds, rounds) || !oneTo(questionsPerRound, perRound)) {
    throw new Error(`A game is 1-${players} players, 1-${rounds} rounds of 1-${perRound} questions`);
  }
  const unknown = playerIds.find(id => !findUser(id));
  if (unknown) throw new Error(`Unknown player: ${unknown}`);

  // Filter exercises by categories
  let availableExercises = readExercises();
  // Problems are solved alone, step by step, not raced in a group game
  availableExercises = availableExercises.filter(e => e.type !== 'problem');
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

  return session;
}

/**
 * «Έξοδος» / «Επιστροφή στο Ταμπλό»: a running game is cancelled (deleted); a finished one is only
 * taken off the screens (dismissedAt), so its record stays.
 */
export function closeExerciseSession(sessionId: string): void {
  const session = store.exerciseSessions.get(sessionId);
  if (!session) return;
  if (!session.completedAt) store.exerciseSessions.deleteWhere('id = ?', sessionId);
  else if (!session.dismissedAt) store.exerciseSessions.put({ ...session, dismissedAt: new Date().toISOString() });
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

  // An answer counts once, for the question on screen, from the player on turn. Anything else (the
  // same answer again from a second screen or a repeated request) is refused: nothing paid or stored.
  const overallQuestionIndex = currentQuestion(session);
  const existingUserIds = config().users.map(u => u.id);
  const relevantPlayerIds = session.playerIds.filter(pid => existingUserIds.includes(pid));
  if (exerciseId !== session.exerciseIds[overallQuestionIndex]) throw new Error('Not the current question');
  if (userId !== playerOnTurn(session, relevantPlayerIds)) throw new Error("Not this player's turn");

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

  return { correct: isCorrect, earnedStars, session };
}

// ============================================
// DAILY EXERCISE ASSIGNMENTS (per-user, chore-like)
// ============================================

// Local date (YYYY-MM-DD) in the configured timezone
function localDateStr(timezone: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

// The instant (ISO, UTC, as the tables store times) the local day of `date` began in `timezone`
export function dayStart(timezone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
  });
  // How far ahead of UTC the local clock is at instant t
  const offset = (t: number) => {
    const p = Object.fromEntries(parts.formatToParts(t).map(x => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
  };
  const midnight = Date.parse(`${localDateStr(timezone, date)}T00:00:00Z`); // local midnight read as UTC
  const guess = midnight - offset(midnight);
  return new Date(midnight - offset(guess)).toISOString();
}

// When a kid last had each exercise (daily or extra), for drawing ones they haven't seen.
function lastSeen(userId: string): Map<string, string> {
  const seen = new Map<string, string>();
  for (const a of store.exerciseAssignments.all('userId = ?', userId)) {
    if ((seen.get(a.exerciseId) ?? '') < a.assignedAt) seen.set(a.exerciseId, a.assignedAt);
  }
  return seen;
}

// The daily set, as opposed to the extra problems a kid asks for.
const DAILY = '(extra IS NULL OR extra = 0)';

/** How many daily sets a kid has had: where her round of the mix starts when she has no problems (drawDailySet). */
function dailySetsSoFar(userId: string): number {
  return new Set(store.exerciseAssignments.all(`userId = ? AND ${DAILY}`, userId).map(a => a.date)).size;
}

// How many extra problems a kid may ask for in a day unless settings.extraProblemsPerDay says otherwise.
export const DEFAULT_EXTRA_PROBLEMS_PER_DAY = 10;

/** Extra problems today: how many the kid has started (finished or set aside), and the day's limit. */
export function extraProblemsToday(userId: string): { used: number; limit: number } {
  const today = localDateStr(config().settings?.timezone || 'Europe/Athens');
  return {
    used: store.exerciseAssignments.all('userId = ? AND date = ? AND extra = 1', userId, today).length,
    limit: config().settings?.extraProblemsPerDay ?? DEFAULT_EXTRA_PROBLEMS_PER_DAY
  };
}

// A kid asks for one more problem from the dashboard: one she hasn't had yet (or had longest
// ago), paid like any other. One she left with ✕ stays hers for the day, a card she can
// reopen where she left it (#67), so asking always draws a new one: never one she has pending
// today, daily or extra. The day's limit counts every extra she started, finished or not, so
// setting one aside earns nothing; at most MAX_SET_ASIDE wait at once.
export async function startExtraProblem(userId: string): Promise<ExerciseAssignmentWithExercise> {
  if (!config().users.some(u => u.id === userId)) throw new Error('Unknown user');
  // Problems of her own grade (revision pools hold none)
  const problems = (await exercisePoolProvider.getPoolsForUser(userId)).own.filter(e => e.type === 'problem');
  if (problems.length === 0) throw new Error('No problems for this kid (is their class set?)');

  const today = localDateStr(config().settings?.timezone || 'Europe/Athens');
  const assignment = store.transaction(() => {
    const { used, limit } = extraProblemsToday(userId);
    if (used >= limit) throw new Error('No more extra problems today');
    const todays = store.exerciseAssignments.all('userId = ? AND date = ?', userId, today);
    const setAside = todays.filter(a => a.extra && a.status === 'pending').length;
    if (setAside >= MAX_SET_ASIDE) throw new Error(extraRefusals.setAside);
    // Not one of today's own, whether daily or extra; once all were, one she finished today
    const had = new Set(todays.map(a => a.exerciseId));
    const pending = new Set(todays.filter(a => a.status === 'pending').map(a => a.exerciseId));
    const fresh = problems.filter(p => !had.has(p.id));
    const candidates = fresh.length ? fresh : problems.filter(p => !pending.has(p.id));
    if (candidates.length === 0) throw new Error(extraRefusals.noneLeft);
    const [problem] = freshLast(candidates, lastSeen(userId)).slice(-1);
    const created: ExerciseAssignment = {
      id: randomUUID(), userId, exerciseId: problem.id, date: today, status: 'pending', attempts: 0,
      assignedAt: new Date().toISOString(), extra: true
    };
    store.exerciseAssignments.put(created);
    logAction('EXERCISE_EXTRA_PROBLEM', { userId, exerciseId: problem.id, number: used + 1, limit, setAside });
    return created;
  });
  const exercise = await exercisePoolProvider.getExerciseById(assignment.exerciseId);
  return { ...fitProgress(assignment, exercise), exercise };
}

// Make sure every user has today's assignments drawn from their pool, in the
// daily mix (drawDailySet, exercisePool.ts). They are stored in that order, and
// read back in it (rowid), so the problem comes first on her screens.
// Lazy generation: called whenever assignments are fetched.
export async function ensureDailyAssignments(): Promise<boolean> {
  const today = localDateStr(config().settings?.timezone || 'Europe/Athens');
  let created = false;

  for (const user of config().users) {
    const hasToday = store.exerciseAssignments.all(`userId = ? AND date = ? AND ${DAILY}`, user.id, today).length > 0;
    if (hasToday) continue;

    const pools = await exercisePoolProvider.getPoolsForUser(user.id);
    const { drawn, revision } = drawDailySet(pools, exercisesPerDay(), lastSeen(user.id), dailySetsSoFar(user.id));
    if (drawn.length === 0) continue;

    // Re-check after the await: a concurrent request may have drawn already.
    store.transaction(() => {
      if (store.exerciseAssignments.all(`userId = ? AND date = ? AND ${DAILY}`, user.id, today).length > 0) return;
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
      logAction('EXERCISE_ASSIGNMENTS_CREATED', {
        userId: user.id, date: today, exerciseIds: drawn.map(e => e.id), ...(revision.length ? { revision } : {})
      });
    });
  }

  return created;
}

// Today's assignments (drawn first if needed), enriched with their exercise definitions.
export async function getExerciseAssignments(userId?: string): Promise<ExerciseAssignmentWithExercise[]> {
  await ensureDailyAssignments();
  return todaysAssignments(userId);
}

async function todaysAssignments(userId?: string): Promise<ExerciseAssignmentWithExercise[]> {
  const today = localDateStr(config().settings?.timezone || 'Europe/Athens');

  const assignments = userId
    ? store.exerciseAssignments.all('date = ? AND userId = ?', today, userId)
    : store.exerciseAssignments.all('date = ?', today);

  // Revision items (from a lower grade's pool) are marked on her card
  const revisionOf = new Map<string, Set<string>>();
  const isRevision = async (a: ExerciseAssignment) => {
    if (!revisionOf.has(a.userId)) {
      const { own, revision } = await exercisePoolProvider.getPoolsForUser(a.userId);
      const ownIds = new Set(own.map(e => e.id));
      revisionOf.set(a.userId, new Set(revision.map(e => e.id).filter(id => !ownIds.has(id))));
    }
    return revisionOf.get(a.userId)!.has(a.exerciseId);
  };
  const enriched: ExerciseAssignmentWithExercise[] = [];
  for (const a of assignments) {
    const exercise = await exercisePoolProvider.getExerciseById(a.exerciseId);
    enriched.push({ ...fitProgress(a, exercise), exercise, ...(await isRevision(a) ? { revision: true } : {}) });
  }
  return enriched;
}

/**
 * A problem's progress, if it still fits the problem. The pools are regenerated under the
 * same ids (#50), so an open assignment may hold a step or mistakes of an older version:
 * a step past the last one, or mistakes counted for another number of steps. Such progress
 * starts again at step 0 (shown so, and stored so on her next answer).
 */
export function fitProgress<A extends ExerciseAssignment>(a: A, exercise: Exercise | undefined): A {
  if (exercise?.type !== 'problem' || a.status === 'completed') return a;
  const step = a.stepIndex ?? 0;
  if (step < exercise.steps.length && (!a.mistakes || a.mistakes.length === exercise.steps.length)) return a;
  const { stepIndex: _step, mistakes: _mistakes, ...rest } = a;
  return { ...rest, stepIndex: 0 } as A;
}

// The kid's rung on the forgiveness ladder (shared/forgiveness.ts)
const forgivenessOf = (userId: string) => config().users.find(u => u.id === userId)?.forgiveness ?? DEFAULT_FORGIVENESS;

// Answer a daily assignment. Correct -> completed, paying its stars less one per wrong
// try before it (shared/forgiveness.ts). Wrong -> another try, unless the kid is on the
// unforgiving rung and has used her tries: then it is closed, paying nothing.
// A problem is answered one step at a time ({ step, value }): a correct step moves
// on to the next, the last one completes it; a wrong one counts in `mistakes`.
export async function answerExerciseAssignment(
  assignmentId: string,
  answer: unknown
): Promise<{ correct: boolean; starsAwarded: number; assignment: ExerciseAssignment; wrong?: number[] }> {
  const found = store.exerciseAssignments.get(assignmentId);
  if (!found) throw new Error('Assignment not found');
  if (found.status === 'completed') throw new Error('Assignment already completed');

  const exercise = await exercisePoolProvider.getExerciseById(found.exerciseId);
  if (!exercise) throw new Error('Exercise not found in pool');

  if (exercise.type === 'problem') return answerProblemStep(assignmentId, exercise, answer as ProblemStepAnswer);

  const isCorrect = checkExerciseAnswer(exercise, answer);

  // Re-read after the await so a concurrent answer can't be lost or double-paid.
  const { assignment, starsAwarded } = store.transaction(() => {
    const current = store.exerciseAssignments.get(assignmentId);
    if (!current || current.status === 'completed') throw new Error('Assignment already completed');
    const updated: ExerciseAssignment = { ...current, attempts: current.attempts + 1 };
    let stars = 0;
    if (isCorrect || updated.attempts >= plainTries(forgivenessOf(current.userId), exercise.type)) {
      stars = isCorrect ? plainStars(exercise.stars, current.attempts) : 0;
      updated.status = 'completed';
      updated.completedAt = new Date().toISOString();
      updated.starsAwarded = stars;
    }
    store.exerciseAssignments.put(updated);
    if (stars > 0) awardStars(updated.userId, stars);
    return { assignment: updated, starsAwarded: stars };
  });

  logAction('EXERCISE_ASSIGNMENT_ANSWER', {
    assignmentId, userId: assignment.userId, exerciseId: assignment.exerciseId, forgiveness: forgivenessOf(assignment.userId),
    correct: isCorrect, attempts: assignment.attempts, starsAwarded, completed: assignment.status === 'completed'
  });

  return { correct: isCorrect, starsAwarded, assignment };
}

// «Δείξε μου» on a plain exercise, on the forgiving rung: after a wrong try (so it pays
// nothing already), she may see the right answer. That closes it, paying nothing.
export async function revealExerciseAssignment(assignmentId: string): Promise<ExerciseAssignment> {
  const found = store.exerciseAssignments.get(assignmentId);
  if (!found) throw new Error('Assignment not found');
  const exercise = await exercisePoolProvider.getExerciseById(found.exerciseId);
  if (!exercise) throw new Error('Exercise not found in pool');
  if (exercise.type === 'problem') throw new Error('A problem is shown step by step');
  const assignment = store.transaction(() => {
    const current = store.exerciseAssignments.get(assignmentId);
    if (!current || current.status === 'completed') throw new Error('Assignment already completed');
    if (current.attempts < 1) throw new Error('The answer is shown after a wrong try first');
    const updated: ExerciseAssignment = { ...current, status: 'completed', completedAt: new Date().toISOString(), starsAwarded: 0 };
    store.exerciseAssignments.put(updated);
    return updated;
  });
  logAction('EXERCISE_ASSIGNMENT_REVEAL', { assignmentId, userId: assignment.userId, exerciseId: assignment.exerciseId, attempts: assignment.attempts });
  return assignment;
}

function answerProblemStep(
  assignmentId: string,
  exercise: ProblemExercise,
  answer: ProblemStepAnswer
): { correct: boolean; starsAwarded: number; assignment: ExerciseAssignment; wrong?: number[] } {
  const result = store.transaction(() => {
    const stored = store.exerciseAssignments.get(assignmentId);
    if (!stored || stored.status === 'completed') throw new Error('Assignment already completed');
    const current = fitProgress(stored, exercise);
    if (current !== stored) logAction('EXERCISE_PROBLEM_RESTARTED', { assignmentId, exerciseId: exercise.id, stepIndex: stored.stepIndex, mistakes: stored.mistakes, steps: exercise.steps.length });
    const stepIndex = current.stepIndex ?? 0;
    const rung = forgivenessOf(current.userId);
    // An answer to a step already solved (a second device, a double tap) changes nothing.
    if (answer?.step !== stepIndex) return { correct: answer?.step < stepIndex, starsAwarded: 0, assignment: current, stale: true, rung };

    const mistakes = exercise.steps.map((_, i) => current.mistakes?.[i] ?? 0);
    const updated: ExerciseAssignment = { ...current, attempts: current.attempts + 1, mistakes };
    // Working it out, the screen reads each calculation back as she goes and sends the one she
    // got wrong as it happens: a mistake of the step if it is one that counts (a wrong result,
    // the smaller number first), read back here. It is not an answer: the step stays hers.
    const step = exercise.steps[stepIndex];
    const value = answer.value as { lines?: unknown; slip?: unknown } | null;
    if (step.kind === 'calc' && value && typeof value === 'object' && 'slip' in value) {
      const line = value.slip as CalcLine;
      const slip = line && ['+', '−', '×', ':'].includes(line.op) && [line.x, line.y, line.result].every(Number.isFinite)
        ? calcSlip(step, value.lines, line) : null;
      if (slip && wrongTryCounts(step, slip)) mistakes[stepIndex]++;
      store.exerciseAssignments.put(updated);
      return { correct: false, starsAwarded: 0, assignment: updated, stale: false, rung, slip: slip ?? 'none' };
    }
    const reading = config().users.find(u => u.id === current.userId)?.problemReading;
    const { correct, wrong } = checkProblemStep(exercise, stepIndex, answer.value, reading);
    let stars = 0;
    if (!correct) {
      // The same rule as the slips above decides whether this wrong try costs (shared/forgiveness.ts)
      if (wrongTryCounts(step)) mistakes[stepIndex]++;
    } else if (stepIndex + 1 < exercise.steps.length) {
      updated.stepIndex = stepIndex + 1;
    } else {
      // A star less for each step gone wrong (the worked steps too: they had their wrong tries)
      stars = problemStars(exercise, mistakes, rung);
      updated.stepIndex = exercise.steps.length;
      updated.status = 'completed';
      updated.completedAt = new Date().toISOString();
      updated.starsAwarded = stars;
    }
    store.exerciseAssignments.put(updated);
    if (stars > 0) awardStars(updated.userId, stars);
    return { correct, wrong, starsAwarded: stars, assignment: updated, stale: false, rung };
  });

  const { stale, rung, slip, ...reply } = result as typeof result & { slip?: string };
  if (!stale) {
    logAction('EXERCISE_PROBLEM_STEP', {
      assignmentId, userId: reply.assignment.userId, exerciseId: exercise.id, step: answer.step, forgiveness: rung,
      kind: exercise.steps[answer.step]?.kind, correct: reply.correct, wrong: reply.wrong, ...(slip ? { slip, mistakes: reply.assignment.mistakes } : {}),
      completed: reply.assignment.status === 'completed', starsAwarded: reply.starsAwarded
    });
  }
  return reply;
}

// ============================================
// HELP
// ============================================

const HELP_ID = /^[\w.-]{1,80}(@[\w-]{1,40})?$/;

/** Help tours played on the kids' screens: the owl stops offering them. */
export function markHelpSeen(ids: unknown): void {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20 || !ids.every(id => typeof id === 'string' && HELP_ID.test(id))) {
    throw new Error('tourIds: 1 to 20 tour ids');
  }
  const seenAt = new Date().toISOString();
  store.transaction(() => ids.forEach(id => store.helpSeen.insertNew({ id, seenAt })));
}

/** The owl offers again: one kid's own tours (her screen, her exercises), or every tour. */
export function resetHelp(userId?: string): number {
  const n = store.forgetHelp(userId);
  logAction('HELP_RESET', { userId: userId ?? null, tours: n });
  return n;
}
