import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Ajv from 'ajv';
import { User, Routine, Task, Flow, Reward, Spending, StarTransfer, Chore, ChoreInstance, Exercise, ExerciseSession, ExerciseAnswer, ExerciseAssignment, ExerciseAssignmentWithExercise, ServerMessage } from '../../shared/types';
import { exercisePoolProvider, ASSIGNMENTS_PER_DAY } from './exercisePool';

// File paths
export const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
export const EXERCISES_FILE = process.env.EXERCISES_FILE || path.join(process.cwd(), 'exercises.json');
export const STATE_FILE = process.env.STATE_FILE || path.join(process.cwd(), 'state.json');
export const LOGS_FILE = process.env.LOGS_FILE || path.join(process.cwd(), 'logs.jsonl');
export const SCHEMA_FILE = path.join(process.cwd(), 'data.schema.json');
export const EXERCISES_SCHEMA_FILE = path.join(process.cwd(), 'exercises.schema.json');
export const STATE_SCHEMA_FILE = path.join(process.cwd(), 'state.schema.json');
export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads dir exists
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

// Action Logging
export const MAX_LOGS = 200;

export function logAction(type: string, details: any) {
  const log = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    details
  };
  
  console.log(`[ACTION:${type}]`, JSON.stringify(details));
  
  // Append to file (Oldest -> Newest)
  fs.appendFile(LOGS_FILE, JSON.stringify(log) + '\n').catch(err => 
    console.error('Failed to write log to disk:', err)
  );
}

console.log('Using data file:', DATA_FILE);
console.log('Using exercises file:', EXERCISES_FILE);
console.log('Using state file:', STATE_FILE);
console.log('Using logs file:', LOGS_FILE);
console.log('Using schema file:', SCHEMA_FILE);
console.log('Using exercises schema file:', EXERCISES_SCHEMA_FILE);
console.log('Using state schema file:', STATE_SCHEMA_FILE);
console.log('Using uploads dir:', UPLOADS_DIR);

// Initialize JSON schema validator
const ajv = new Ajv({ allErrors: true, validateFormats: false });
export let validateConfig: any = null;
export let validateExercises: any = null;
export let validateState: any = null;

// Track validation errors for client reporting
export let lastConfigError: { message: string, errors: any[] } | null = null;
export let lastStateError: { message: string, errors: any[] } | null = null;

export function setLastConfigError(err: { message: string, errors: any[] } | null) {
  lastConfigError = err;
}

export function setLastStateError(err: { message: string, errors: any[] } | null) {
  lastStateError = err;
}

// Load schemas at startup
export async function loadSchema() {
  try {
    const schemaStr = await fs.readFile(SCHEMA_FILE, 'utf-8');
    const schema = JSON.parse(schemaStr);
    validateConfig = ajv.compile(schema);
    console.log('Config schema loaded successfully');
  } catch (error) {
    console.error('Failed to load config schema:', error);
    console.log('Config validation will be disabled');
  }

  try {
    const schemaStr = await fs.readFile(EXERCISES_SCHEMA_FILE, 'utf-8');
    const schema = JSON.parse(schemaStr);
    validateExercises = ajv.compile(schema);
    console.log('Exercises schema loaded successfully');
  } catch (error) {
    console.error('Failed to load exercises schema:', error);
    console.log('Exercises validation will be disabled');
  }
  
  try {
    const stateSchemaStr = await fs.readFile(STATE_SCHEMA_FILE, 'utf-8');
    const stateSchema = JSON.parse(stateSchemaStr);
    validateState = ajv.compile(stateSchema);
    console.log('State schema loaded successfully');
  } catch (error) {
    console.error('Failed to load state schema:', error);
    console.log('State validation will be disabled');
  }
}

// In-memory state cache
export let globalState: {
  userStars: Record<string, number>;
  routineExecutions: any[];
  taskExecutions: any[];
  spendings: Spending[];
  starTransfers: StarTransfer[];
  choreInstances: ChoreInstance[];
  exerciseSessions: ExerciseSession[];
  exerciseAssignments: ExerciseAssignment[];
} = {
  userStars: {},
  routineExecutions: [],
  taskExecutions: [],
  spendings: [],
  starTransfers: [],
  choreInstances: [],
  exerciseSessions: [],
  exerciseAssignments: []
};

// WebSocket connections
export const wsConnections = new Set<any>();

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

// Load state from disk at startup
export async function loadState() {
  try {
    const str = await fs.readFile(STATE_FILE, 'utf-8');
    const loaded = JSON.parse(str);
    
    // Validate state if validator is available
    if (validateState) {
      const valid = validateState(loaded);
      if (!valid) {
        console.error('State file validation failed:', validateState.errors);
        console.log('Starting with empty state due to validation errors');
        lastStateError = {
          message: 'State file validation failed on load',
          errors: validateState.errors
        };
        broadcast({
          type: 'STATE_ERROR',
          payload: lastStateError
        });
        globalState = {
          userStars: {},
          routineExecutions: [],
          taskExecutions: [],
          spendings: [],
          starTransfers: [],
          choreInstances: [],
          exerciseSessions: [],
          exerciseAssignments: []
        };
        return;
      } else {
        lastStateError = null; // Clear error on successful load
      }
    }
    
    globalState = {
      userStars: loaded.userStars || {},
      routineExecutions: loaded.routineExecutions || [],
      taskExecutions: loaded.taskExecutions || [],
      spendings: loaded.spendings || [],
      starTransfers: loaded.starTransfers || [],
      choreInstances: loaded.choreInstances || [],
      exerciseSessions: loaded.exerciseSessions || [],
      exerciseAssignments: loaded.exerciseAssignments || []
    };
    console.log('State loaded into memory');
  } catch (error) {
    console.log('No state file found or invalid, starting with empty state');
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

// Atomic write helper
export async function persistState() {
  console.log('Persisting state to disk...');
  const tempFile = `${STATE_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(globalState, null, 2));
  await fs.rename(tempFile, STATE_FILE);
}

export function scheduleSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    persistState().catch(err => console.error('Failed to save state:', err));
    saveTimeout = null;
  }, 10000); // 10 seconds debounce
}

export async function flushPendingSave() {
  if (saveTimeout) {
    console.log('Flushing pending state save...');
    clearTimeout(saveTimeout);
    saveTimeout = null;
    await persistState();
  }
}

// Db is a merged VIEW handed to request handlers, with two very different halves:
//
//  - CONFIG sections (users, routines, tasks, flows, rewards, chores, exercises, ...)
//    are fresh read-only copies parsed from data.json/exercises.json on every readDb().
//    Mutating them changes nothing durable — config edits go through writeRawConfig/
//    writeRawExercises, and star balances through adjustUserStars/awardStars/
//    setUserStars (user objects are frozen so a stray `user.stars = ...` throws).
//
//  - LIVE STATE sections (routineExecutions, taskExecutions, spendings, starTransfers,
//    choreInstances, exerciseSessions, exerciseAssignments) are the actual in-memory
//    arrays (globalState.*). Mutate them in place, then call commitState(db) to
//    schedule persistence to state.json.
export interface Db {
  users: User[];
  routines: Routine[];
  tasks: Task[];
  routineTasks: any[];
  routineAssignments: any[];
  flows: Flow[];
  schedules: any[];
  rewards: Reward[];
  chores: Chore[];
  exercises: Exercise[];
  exerciseCategories?: any[];
  settings?: { timezone: string };
  routineExecutions: any[];
  taskExecutions: any[];
  spendings: Spending[];
  starTransfers: StarTransfer[];
  choreInstances: ChoreInstance[];
  exerciseSessions: ExerciseSession[];
  exerciseAssignments: ExerciseAssignment[];
}

export async function readDb(): Promise<Db> {
  try {
    // Read static config fresh every time (allows hot-reloading config)
    const dataStr = await fs.readFile(DATA_FILE, 'utf-8');
    const data = JSON.parse(dataStr);

    // Validate config if validator is available
    if (validateConfig) {
      const valid = validateConfig(data);
      if (!valid) {
        console.error('Config file validation failed:', validateConfig.errors);
        broadcast({
          type: 'CONFIG_ERROR',
          payload: {
            message: 'Configuration file validation failed',
            errors: validateConfig.errors
          }
        });
        throw new Error('Invalid configuration file');
      }
    }

    // Merge with in-memory state. Frozen: these are per-call snapshots, so writes
    // to them would be silently lost — freezing turns that mistake into a loud
    // TypeError. Star balances change only via adjustUserStars/awardStars/setUserStars.
    const users = data.users.map((u: any) => Object.freeze({
      ...u,
      stars: globalState.userStars[u.id] || 0
    })) as User[];

    // Read exercises fresh
    let exercises: Exercise[] = [];
    let exerciseCategories: any[] = [];
    try {
      const exercisesStr = await fs.readFile(EXERCISES_FILE, 'utf-8');
      const exercisesData = JSON.parse(exercisesStr);
      if (validateExercises) {
        const valid = validateExercises(exercisesData);
        if (valid) {
          exercises = exercisesData.exercises;
          exerciseCategories = exercisesData.categories || [];
        } else {
          console.error('Exercises validation failed:', validateExercises.errors);
        }
      } else {
        exercises = exercisesData.exercises;
        exerciseCategories = exercisesData.categories || [];
      }
    } catch (e) {
      console.warn('Could not read exercises file, starting with empty exercises');
    }

    return {
      ...data,
      users,
      rewards: (data.rewards || []) as Reward[],
      chores: (data.chores || []) as Chore[],
      exercises,
      exerciseCategories,
      schedules: data.schedules || [],
      settings: data.settings || { timezone: 'Europe/Athens' },
      routineExecutions: globalState.routineExecutions,
      taskExecutions: globalState.taskExecutions,
      spendings: globalState.spendings,
      starTransfers: globalState.starTransfers,
      choreInstances: globalState.choreInstances,
      exerciseSessions: globalState.exerciseSessions,
      exerciseAssignments: globalState.exerciseAssignments
    };
  } catch (error) {
    console.error("Error reading DB:", error);
    return {
      users: [], routines: [], tasks: [], routineTasks: [],
      routineAssignments: [], flows: [], schedules: [], rewards: [],
      chores: [], exercises: [],
      routineExecutions: [], taskExecutions: [], spendings: [],
      starTransfers: [],
      choreInstances: [], exerciseSessions: [], exerciseAssignments: []
    };
  }
}

// Commit the live-state half of a Db view (see the Db interface docs) and schedule
// persistence. Config sections are ignored — they don't live in state.json.
export async function commitState(data: Db) {
  // userStars is NOT derived here — it's owned directly by adjustUserStars/
  // awardStars/setUserStars, since db.users.stars is only a readDb()-time snapshot
  // and rebuilding the map from it would clobber concurrent star updates that
  // happened after that snapshot was taken.
  globalState = {
    userStars: globalState.userStars,
    routineExecutions: data.routineExecutions,
    taskExecutions: data.taskExecutions,
    spendings: data.spendings,
    starTransfers: data.starTransfers,
    choreInstances: data.choreInstances,
    exerciseSessions: data.exerciseSessions,
    exerciseAssignments: data.exerciseAssignments
  };

  // Schedule persist
  scheduleSave();
}

// Read raw config (data.json) without state merge
export async function readRawConfig(): Promise<any> {
  const dataStr = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(dataStr);
}

// Write raw config (data.json)
export async function writeRawConfig(data: any): Promise<void> {
  // Validate against schema if available
  if (validateConfig) {
    const valid = validateConfig(data);
    if (!valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validateConfig.errors)}`);
    }
  }
  
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  setLastConfigError(null);
  broadcast({ type: 'CONFIG_UPDATED' });
}

// Helper to trigger an action (Routine or Flow)
export async function triggerAction(id: string, db: Db, source: string = 'unknown') {
  // Try to find RoutineAssignment
  const assignment = db.routineAssignments.find(a => a.id === id);

  if (assignment) {
    // Check for existing active execution for this user (idempotency)
    // A user can only be in one routine at a time
    const existingExecution = db.routineExecutions.find(e => 
      e.userId === assignment.userId && 
      !e.completedAt
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
        payload: {
          userId: assignment.userId,
          routineId: assignment.id,
          executionId: existingExecution.id
        }
      });
      return { success: true, skipped: true, existingExecutionId: existingExecution.id };
    }

    logAction('TRIGGER_ROUTINE', { id, userId: assignment.userId, routineId: assignment.routineId, source });
    // Create execution record
    const execution = {
      id: randomUUID(),
      userId: assignment.userId,
      routineId: assignment.routineId,
      startedAt: new Date().toISOString(),
      totalStars: 0
    };
    
    db.routineExecutions.push(execution);
    await commitState(db);

    // Broadcast to frontend
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

  // Try to find Flow
  const flow = db.flows.find(f => f.id === id);

  if (flow) {
    logAction('TRIGGER_FLOW', { id, flowId: flow.id, source });
    broadcast({
      type: 'FLOW_START',
      payload: {
        flowId: flow.id,
        steps: flow.steps // Already object
      }
    });

    return { success: true, type: 'flow', id };
  }

  logAction('TRIGGER_FAILED', { id, source, reason: 'Not found' });
  return null;
}

// Helper to get enriched spendings
export async function getEnrichedSpendings() {
  const db = await readDb();
  return db.spendings.map(s => {
    const user = db.users.find(u => u.id === s.userId);
    const reward = db.rewards.find(r => r.id === s.rewardId);
    return { ...s, user, reward };
  }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Helper to get enriched star transfers
export async function getEnrichedTransfers() {
  const db = await readDb();
  return db.starTransfers.map(t => {
    const fromUser = db.users.find(u => u.id === t.fromUserId);
    const toUser = db.users.find(u => u.id === t.toUserId);
    return { ...t, fromUser, toUser };
  }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Helper to calculate pending outgoing transfer amount for a user
export function getPendingOutgoingTransfers(userId: string): number {
  return globalState.starTransfers
    .filter(t => t.fromUserId === userId && t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);
}

// Helper to calculate available balance (total - pending outgoing transfers)
export function getAvailableBalance(userId: string): number {
  const totalStars = globalState.userStars[userId] || 0;
  const pendingOutgoing = getPendingOutgoingTransfers(userId);
  return totalStars - pendingOutgoing;
}

// Helper to read last N lines from logs file
export async function readLastLogs(maxLines: number): Promise<any[]> {
  try {
    try {
      await fs.access(LOGS_FILE);
    } catch {
      return [];
    }

    const stats = await fs.stat(LOGS_FILE);
    const fileSize = stats.size;
    // Read last 100KB (approx 200-500 lines depending on size)
    const bufferSize = Math.min(fileSize, 100 * 1024);
    
    if (bufferSize <= 0) return [];
    
    const start = fileSize - bufferSize;
    const fileHandle = await fs.open(LOGS_FILE, 'r');
    const buffer = Buffer.alloc(bufferSize);
    await fileHandle.read(buffer, 0, bufferSize, start);
    await fileHandle.close();
    
    const content = buffer.toString('utf-8');
    const lines = content.split('\n');
    
    // If we started from the middle of the file, the first line is likely partial
    if (start > 0) {
      lines.shift();
    }
    
    return lines
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(l => l !== null)
      .slice(-maxLines)
      .reverse();
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
}

// Commit a new star balance: mutate the single in-memory source of truth
// (globalState.userStars), schedule persistence, and notify all clients.
// The broadcast is intrinsic to the mutation — a balance can never change
// without every client hearing about it, so callers have nothing to remember.
function commitUserStars(userId: string, newTotal: number): number {
  globalState.userStars[userId] = newTotal;
  scheduleSave();
  broadcast({
    type: 'SYNC_STATE',
    payload: {
      userStars: globalState.userStars
    }
  });
  return newTotal;
}

// Atomically adjust a user's star balance by a delta. All star-mutating code
// paths must go through this (or setUserStars) — never mutate `.stars` on a
// readDb() snapshot, since commitState() does not persist it.
export function adjustUserStars(userId: string, delta: number): number {
  return commitUserStars(userId, (globalState.userStars[userId] || 0) + delta);
}

// Atomically spend stars: balance check and deduction happen in one synchronous
// step, so concurrent spends can never overdraw. Returns the new total, or null
// if the balance is insufficient (nothing is deducted).
export function trySpendStars(userId: string, cost: number): number | null {
  const balance = globalState.userStars[userId] || 0;
  if (balance < cost) return null;
  return commitUserStars(userId, balance - cost);
}

// Award stars to a user
export async function awardStars(userId: string, amount: number): Promise<{ success: boolean; newTotal: number }> {
  const db = await readDb();
  const user = db.users.find(u => u.id === userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const newTotal = adjustUserStars(userId, amount);

  logAction('AWARD_STARS', { userId, amount, newBalance: newTotal });

  // Semantic notification on top of the balance sync (which adjustUserStars
  // already broadcast) — lets the UI celebrate the award if it wants to.
  broadcast({
    type: 'STARS_AWARDED',
    payload: {
      userId,
      amount,
      totalStars: newTotal
    }
  });

  return { success: true, newTotal };
}

// Set stars for a user (absolute value)
export async function setUserStars(userId: string, amount: number): Promise<{ success: boolean; newTotal: number }> {
  const db = await readDb();
  const user = db.users.find(u => u.id === userId);

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const oldStars = globalState.userStars[userId] || 0;
  commitUserStars(userId, amount);

  logAction('SET_STARS', { userId, oldBalance: oldStars, newBalance: amount });

  return { success: true, newTotal: amount };
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
export async function generateChoreInstances(): Promise<ChoreInstance[]> {
  const db = await readDb();
  const now = new Date();
  const newInstances: ChoreInstance[] = [];
  
  for (const chore of db.chores) {
    // Check if cron matches current time
    if (!cronMatches(chore.availabilityCron, now)) continue;
    
    // Check if there's ANY instance for this chore within the current window
    // (window = from availableAt to expiresAt, regardless of status)
    // This prevents respawning after claim/reject/confirm/expire
    const existingInWindow = db.choreInstances.find(ci => {
      if (ci.choreId !== chore.id) return false;
      // If expiration hasn't passed, this instance is still in its window
      return new Date(ci.expiresAt) > now;
    });
    
    if (existingInWindow) continue;
    
    // Create new instance
    const expiresAt = new Date(now.getTime() + chore.expirationHours * 60 * 60 * 1000);
    const instance: ChoreInstance = {
      id: randomUUID(),
      choreId: chore.id,
      status: 'available',
      availableAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
    
    newInstances.push(instance);
    db.choreInstances.push(instance);
    
    logAction('CHORE_AVAILABLE', { choreId: chore.id, instanceId: instance.id, expiresAt: instance.expiresAt });
  }
  
  if (newInstances.length > 0) {
    await commitState(db);
    await broadcastChoreState();
    
    // Broadcast availability event for each new instance
    for (const instance of newInstances) {
      const chore = db.chores.find(c => c.id === instance.choreId);
      broadcast({
        type: 'CHORE_AVAILABLE',
        payload: {
          instanceId: instance.id,
          choreId: instance.choreId,
          choreTitle: chore?.title,
          expiresAt: instance.expiresAt
        }
      });
    }
  }
  
  return newInstances;
}

// Expire chores that are past their expiration time
export async function expireChores(): Promise<{ expired: ChoreInstance[], notified: { userId: string, choreTitle: string }[] }> {
  const db = await readDb();
  const now = new Date();
  const expiredInstances: ChoreInstance[] = [];
  const notified: { userId: string, choreTitle: string }[] = [];
  
  for (const instance of db.choreInstances) {
    // Only expire available or claimed instances
    if (!['available', 'claimed'].includes(instance.status)) continue;
    
    const expiresAt = new Date(instance.expiresAt);
    if (now < expiresAt) continue;
    
    const chore = db.chores.find(c => c.id === instance.choreId);
    const oldStatus = instance.status;
    instance.status = 'expired';
    expiredInstances.push(instance);
    
    logAction('CHORE_EXPIRED', { instanceId: instance.id, choreId: instance.choreId, previousStatus: oldStatus, claimedBy: instance.claimedBy });
    
    // If it was claimed, notify that user
    if (oldStatus === 'claimed' && instance.claimedBy) {
      notified.push({
        userId: instance.claimedBy,
        choreTitle: chore?.title || 'Unknown chore'
      });
      
      broadcast({
        type: 'CHORE_EXPIRED',
        payload: {
          instanceId: instance.id,
          choreId: instance.choreId,
          choreTitle: chore?.title,
          userId: instance.claimedBy
        }
      });
    }
  }
  
  if (expiredInstances.length > 0) {
    await commitState(db);
    await broadcastChoreState();
  }
  
  return { expired: expiredInstances, notified };
}

// Clean up old chore instances to prevent unbounded growth
export async function cleanupOldChoreInstances(): Promise<number> {
  const db = await readDb();
  const now = new Date();
  // Keep instances for 7 days after their window closes
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const before = db.choreInstances.length;
  db.choreInstances = db.choreInstances.filter(ci => {
    // Always keep active instances
    if (['available', 'claimed', 'attempted'].includes(ci.status)) return true;
    // Keep closed instances if their expiresAt is after cutoff
    return new Date(ci.expiresAt) > cutoff;
  });
  
  const removed = before - db.choreInstances.length;
  if (removed > 0) {
    await commitState(db);
    logAction('CHORE_CLEANUP', { removed, remaining: db.choreInstances.length });
  }
  
  return removed;
}

// Get chores with their active instances, optionally filtered by user eligibility
export async function getChoresWithInstances(userId?: string): Promise<{ chores: Chore[], instances: ChoreInstance[] }> {
  const db = await readDb();
  
  // Filter chores by eligibility if userId provided
  let chores = db.chores;
  if (userId) {
    chores = chores.filter(c => 
      !c.eligibleUsers || c.eligibleUsers.length === 0 || c.eligibleUsers.includes(userId)
    );
  }
  
  // Get active instances (not expired/confirmed/rejected more than 24h ago)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const instances = db.choreInstances.filter(ci => {
    // Include all active instances
    if (['available', 'claimed', 'attempted'].includes(ci.status)) return true;
    
    // Include recently completed/rejected/expired for display
    const completedAt = ci.confirmedAt || ci.rejectedAt || ci.expiresAt;
    return completedAt && completedAt > oneDayAgo;
  });
  
  return { chores, instances };
}

// Claim a chore instance
export async function claimChore(instanceId: string, userId: string): Promise<ChoreInstance> {
  const db = await readDb();
  const instance = db.choreInstances.find(ci => ci.id === instanceId);
  
  if (!instance) {
    throw new Error(`Chore instance not found: ${instanceId}`);
  }
  
  if (instance.status !== 'available') {
    throw new Error(`Chore is not available (status: ${instance.status})`);
  }
  
  // Check eligibility
  const chore = db.chores.find(c => c.id === instance.choreId);
  if (chore?.eligibleUsers && chore.eligibleUsers.length > 0 && !chore.eligibleUsers.includes(userId)) {
    throw new Error(`User ${userId} is not eligible for this chore`);
  }
  
  // Check expiration
  if (new Date(instance.expiresAt) < new Date()) {
    instance.status = 'expired';
    await commitState(db);
    throw new Error('Chore has expired');
  }
  
  instance.status = 'claimed';
  instance.claimedBy = userId;
  instance.claimedAt = new Date().toISOString();
  
  await commitState(db);
  
  logAction('CHORE_CLAIMED', { instanceId, choreId: instance.choreId, userId });
  
  broadcast({
    type: 'CHORE_CLAIMED',
    payload: {
      instanceId,
      choreId: instance.choreId,
      choreTitle: chore?.title,
      userId
    }
  });
  
  await broadcastChoreState();
  
  return instance;
}

// Mark chore as attempted (user says "I did it!")
export async function attemptChore(instanceId: string): Promise<ChoreInstance> {
  const db = await readDb();
  const instance = db.choreInstances.find(ci => ci.id === instanceId);
  
  if (!instance) {
    throw new Error(`Chore instance not found: ${instanceId}`);
  }
  
  if (instance.status !== 'claimed') {
    throw new Error(`Chore must be claimed first (status: ${instance.status})`);
  }
  
  const chore = db.chores.find(c => c.id === instance.choreId);
  
  instance.status = 'attempted';
  instance.attemptedAt = new Date().toISOString();
  
  await commitState(db);
  
  logAction('CHORE_ATTEMPTED', { instanceId, choreId: instance.choreId, userId: instance.claimedBy });
  
  broadcast({
    type: 'CHORE_ATTEMPTED',
    payload: {
      instanceId,
      choreId: instance.choreId,
      choreTitle: chore?.title,
      userId: instance.claimedBy
    }
  });
  
  await broadcastChoreState();
  
  return instance;
}

// Confirm chore completion (parent approves)
export async function confirmChore(instanceId: string, starsOverride?: number): Promise<ChoreInstance> {
  const db = await readDb();
  const instance = db.choreInstances.find(ci => ci.id === instanceId);
  
  if (!instance) {
    throw new Error(`Chore instance not found: ${instanceId}`);
  }
  
  if (instance.status !== 'attempted') {
    throw new Error(`Chore must be attempted first (status: ${instance.status})`);
  }
  
  if (!instance.claimedBy) {
    throw new Error('Chore has no claimer');
  }
  
  const chore = db.chores.find(c => c.id === instance.choreId);
  const stars = starsOverride ?? chore?.defaultStars ?? 0;
  
  instance.status = 'confirmed';
  instance.confirmedAt = new Date().toISOString();
  instance.starsAwarded = stars;
  
  await commitState(db);
  
  if (stars > 0) {
    await awardStars(instance.claimedBy, stars);
  }
  
  logAction('CHORE_CONFIRMED', { instanceId, choreId: instance.choreId, userId: instance.claimedBy, starsAwarded: stars });
  
  // Single broadcast with all updated state
  broadcast({
    type: 'CHORE_CONFIRMED',
    payload: {
      instanceId,
      choreId: instance.choreId,
      choreTitle: chore?.title,
      userId: instance.claimedBy,
      starsAwarded: stars
    }
  });
  
  await broadcastChoreState();
  
  return instance;
}

// Reject chore attempt (parent disapproves)
export async function rejectChore(instanceId: string): Promise<ChoreInstance> {
  const db = await readDb();
  const instance = db.choreInstances.find(ci => ci.id === instanceId);
  
  if (!instance) {
    throw new Error(`Chore instance not found: ${instanceId}`);
  }
  
  if (instance.status !== 'attempted') {
    throw new Error(`Chore must be attempted first (status: ${instance.status})`);
  }
  
  const chore = db.chores.find(c => c.id === instance.choreId);
  
  instance.status = 'rejected';
  instance.rejectedAt = new Date().toISOString();
  
  await commitState(db);
  
  logAction('CHORE_REJECTED', { instanceId, choreId: instance.choreId, userId: instance.claimedBy });
  
  broadcast({
    type: 'CHORE_REJECTED',
    payload: {
      instanceId,
      choreId: instance.choreId,
      choreTitle: chore?.title,
      userId: instance.claimedBy
    }
  });
  
  await broadcastChoreState();
  
  return instance;
}

// Broadcast current chore state to all clients
export async function broadcastChoreState() {
  const enrichedSpendings = await getEnrichedSpendings();
  const { instances } = await getChoresWithInstances();
  
  broadcast({
    type: 'SYNC_STATE',
    payload: {
      userStars: globalState.userStars,
      spendings: enrichedSpendings,
      choreInstances: instances
    }
  });
}

// ============================================
// SCHOOL EXERCISES SYSTEM
// ============================================

export async function readExercises(): Promise<Exercise[]> {
  const db = await readDb();
  return db.exercises;
}

export async function readExerciseCategories(): Promise<any[]> {
  const db = await readDb();
  if (db.exerciseCategories && db.exerciseCategories.length > 0) {
    return db.exerciseCategories;
  }
  
  // Fallback: Infer categories dynamically for backward compatibility
  const categories = [...new Set(db.exercises.map((e: any) => e.category))];
  return categories.map(c => ({ id: c, label: c }));
}

export async function readRawExercises(): Promise<any> {
  try {
    const exercisesStr = await fs.readFile(EXERCISES_FILE, 'utf-8');
    return JSON.parse(exercisesStr);
  } catch (error) {
    return { categories: [], exercises: [] };
  }
}

export async function writeRawExercises(data: any): Promise<void> {
  if (validateExercises) {
    const valid = validateExercises(data);
    if (!valid) {
      throw new Error(`Exercises validation failed: ${JSON.stringify(validateExercises.errors)}`);
    }
  }
  await fs.writeFile(EXERCISES_FILE, JSON.stringify(data, null, 2));
  broadcast({ type: 'CONFIG_UPDATED' }); // Trigger a reload on all clients
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

export async function startExerciseSession(
  playerIds: string[], 
  categories: string[], 
  totalRounds: number, 
  questionsPerRound: number
): Promise<ExerciseSession> {
  const db = await readDb();
  
  // Filter exercises by categories
  let availableExercises = db.exercises;
  if (categories.length > 0) {
    availableExercises = availableExercises.filter(e => categories.includes(e.category));
  }
  
  // Filter exercises by user eligibility:
  // An exercise is available if it has no userIds restriction, 
  // OR if every player in the session is in the exercise's userIds list
  availableExercises = availableExercises.filter(e => 
    !e.userIds || e.userIds.length === 0 || playerIds.every(pid => e.userIds!.includes(pid))
  );
  
  if (availableExercises.length === 0) {
    throw new Error('No exercises found for these categories');
  }
  
  // Draw random exercises for the session (shuffle, no repeats when possible)
  const totalQuestionsNeeded = totalRounds * questionsPerRound;
  const drawnExerciseIds: string[] = [];
  
  // Shuffle available exercises using Fisher-Yates
  const shuffled = [...availableExercises].sort(() => Math.random() - 0.5);
  
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
    answers: playerIds.reduce((acc, pid) => ({ ...acc, [pid]: [] }), {}),
    startedAt: new Date().toISOString(),
    totalStarsEarned: playerIds.reduce((acc, pid) => ({ ...acc, [pid]: 0 }), {})
  };
  
  globalState.exerciseSessions.push(session);
  await persistState();
  
  logAction('EXERCISE_SESSION_START', { sessionId: session.id, players: playerIds, categories });
  broadcast({ type: 'EXERCISE_SESSION_START', payload: session });
  
  return session;
}

export async function cancelExerciseSession(sessionId: string): Promise<void> {
  const sessionIndex = globalState.exerciseSessions.findIndex(s => s.id === sessionId);
  if (sessionIndex !== -1) {
    globalState.exerciseSessions.splice(sessionIndex, 1);
    
    broadcast({ 
      type: 'SYNC_STATE', 
      payload: { 
        activeExerciseSessions: globalState.exerciseSessions.filter(s => !s.completedAt) 
      } 
    });
    
    scheduleSave();
  }
}

export async function submitExerciseAnswer(
  sessionId: string,
  userId: string,
  exerciseId: string,
  answer: any // Can be index, boolean, array of pairs, etc.
): Promise<{ correct: boolean; earnedStars: number; session: ExerciseSession }> {
  const db = await readDb();
  const session = globalState.exerciseSessions.find(s => s.id === sessionId);
  
  if (!session) throw new Error('Session not found');
  if (session.completedAt) throw new Error('Session already completed');
  if (!session.playerIds.includes(userId)) throw new Error('User not in this session');
  
  const exercise = db.exercises.find(e => e.id === exerciseId);
  if (!exercise) throw new Error('Exercise not found');
  
  // Calculate the overall question index for this session
  // (answers accumulate across rounds, so we need an absolute index)
  const overallQuestionIndex = (session.currentRound - 1) * session.questionsPerRound + session.currentQuestionIndex;
  
  // Validate answer based on exercise type
  const isCorrect = checkExerciseAnswer(exercise, answer);

  const earnedStars = isCorrect ? exercise.stars : 0;
  
  // Record answer
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
    // Award stars immediately to user balance
    await awardStars(userId, earnedStars);
  }
  
  // Advance question index if all players answered this overall question
  const existingUserIds = db.users.map(u => u.id);
  const relevantPlayerIds = session.playerIds.filter(pid => existingUserIds.includes(pid));
  
  const allAnsweredCurrent = relevantPlayerIds.every(pid => 
    session.answers[pid] && session.answers[pid].length > overallQuestionIndex
  );
  
  if (allAnsweredCurrent) {
    session.currentQuestionIndex++;
    
    // Check if round or session complete
    if (session.currentQuestionIndex >= session.questionsPerRound) {
      if (session.currentRound >= session.totalRounds) {
        // Session complete
        session.completedAt = new Date().toISOString();
        logAction('EXERCISE_SESSION_COMPLETE', { sessionId: session.id, totalStars: session.totalStarsEarned });
      } else {
        // Next round
        session.currentRound++;
        session.currentQuestionIndex = 0;
      }
    }
  }
  
  await persistState();

  broadcast({
    type: 'EXERCISE_ANSWER',
    payload: {
      sessionId,
      userId,
      isCorrect,
      earnedStars,
      session // Broadcast updated session state
    }
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
  const db = await readDb();
  const today = localDateStr(db.settings?.timezone || 'Europe/Athens');
  let created = false;

  for (const user of db.users) {
    const hasToday = globalState.exerciseAssignments.some(
      a => a.userId === user.id && a.date === today
    );
    if (hasToday) continue;

    const pool = await exercisePoolProvider.getPoolForUser(user.id);
    if (pool.length === 0) continue;

    const drawn = drawBalanced(pool, ASSIGNMENTS_PER_DAY);
    for (const exercise of drawn) {
      globalState.exerciseAssignments.push({
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
  }

  if (created) {
    await persistState();
  }
  return created;
}

// Today's assignments, enriched with their exercise definitions.
export async function getExerciseAssignments(userId?: string): Promise<ExerciseAssignmentWithExercise[]> {
  await ensureDailyAssignments();
  const db = await readDb();
  const today = localDateStr(db.settings?.timezone || 'Europe/Athens');

  let assignments = globalState.exerciseAssignments.filter(a => a.date === today);
  if (userId) {
    assignments = assignments.filter(a => a.userId === userId);
  }

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
    payload: {
      userStars: globalState.userStars,
      exerciseAssignments: assignments
    }
  });
}

// Answer a daily assignment. Correct -> completed + stars. Wrong -> retry allowed.
export async function answerExerciseAssignment(
  assignmentId: string,
  answer: any
): Promise<{ correct: boolean; starsAwarded: number; assignment: ExerciseAssignment }> {
  const assignment = globalState.exerciseAssignments.find(a => a.id === assignmentId);
  if (!assignment) throw new Error('Assignment not found');
  if (assignment.status === 'completed') throw new Error('Assignment already completed');

  const exercise = await exercisePoolProvider.getExerciseById(assignment.exerciseId);
  if (!exercise) throw new Error('Exercise not found in pool');

  const isCorrect = checkExerciseAnswer(exercise, answer);
  assignment.attempts += 1;

  let starsAwarded = 0;
  if (isCorrect) {
    assignment.status = 'completed';
    assignment.completedAt = new Date().toISOString();
    starsAwarded = exercise.stars;
    assignment.starsAwarded = starsAwarded;
    await persistState();
    if (starsAwarded > 0) {
      await awardStars(assignment.userId, starsAwarded);
    }
  } else {
    await persistState();
  }

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
