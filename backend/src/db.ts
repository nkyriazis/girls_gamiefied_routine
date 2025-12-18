import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Ajv from 'ajv';
import { User, Routine, Task, Flow, Reward, Spending, StarTransfer, Chore, ChoreInstance, ChoreInstanceStatus, Exercise, ExerciseInstance } from '../../shared/types';

// File paths
export const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
export const STATE_FILE = process.env.STATE_FILE || path.join(process.cwd(), 'state.json');
export const LOGS_FILE = process.env.LOGS_FILE || path.join(process.cwd(), 'logs.jsonl');
export const SCHEMA_FILE = path.join(process.cwd(), 'data.schema.json');
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
console.log('Using state file:', STATE_FILE);
console.log('Using logs file:', LOGS_FILE);
console.log('Using schema file:', SCHEMA_FILE);
console.log('Using state schema file:', STATE_SCHEMA_FILE);
console.log('Using uploads dir:', UPLOADS_DIR);

// Initialize JSON schema validator
const ajv = new Ajv({ allErrors: true, validateFormats: false });
export let validateConfig: any = null;
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
  exerciseInstances: ExerciseInstance[];
} = {
  userStars: {},
  routineExecutions: [],
  taskExecutions: [],
  spendings: [],
  starTransfers: [],
  choreInstances: [],
  exerciseInstances: []
};

// WebSocket connections
export const wsConnections = new Set<any>();

// Broadcast helper
export function broadcast(message: any) {
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
          exerciseInstances: []
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
      exerciseInstances: loaded.exerciseInstances || []
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
  settings?: { timezone: string };
  routineExecutions: any[];
  taskExecutions: any[];
  spendings: Spending[];
  starTransfers: StarTransfer[];
  choreInstances: ChoreInstance[];
  exerciseInstances: ExerciseInstance[];
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

    // Merge with in-memory state
    const users = data.users.map((u: any) => ({
      ...u,
      stars: globalState.userStars[u.id] || 0
    })) as User[];

    return {
      ...data,
      users,
      rewards: (data.rewards || []) as Reward[],
      chores: (data.chores || []) as Chore[],
      exercises: (data.exercises || []) as Exercise[],
      schedules: data.schedules || [],
      settings: data.settings || { timezone: 'Europe/Athens' },
      routineExecutions: globalState.routineExecutions,
      taskExecutions: globalState.taskExecutions,
      spendings: globalState.spendings,
      starTransfers: globalState.starTransfers,
      choreInstances: globalState.choreInstances,
      exerciseInstances: globalState.exerciseInstances
    };
  } catch (error) {
    console.error("Error reading DB:", error);
    return {
      users: [], routines: [], tasks: [], routineTasks: [], 
      routineAssignments: [], flows: [], schedules: [], rewards: [],
      chores: [],
      routineExecutions: [], taskExecutions: [], spendings: [],
      starTransfers: [],
      choreInstances: []
    };
  }
}

export async function writeDb(data: Db) {
  // Update in-memory state
  const userStars = data.users.reduce((acc: any, user: any) => {
    acc[user.id] = user.stars;
    return acc;
  }, {});

  globalState = {
    userStars,
    routineExecutions: data.routineExecutions,
    taskExecutions: data.taskExecutions,
    spendings: data.spendings,
    starTransfers: data.starTransfers,
    choreInstances: data.choreInstances
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
    await writeDb(db);

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

// Award stars to a user
export async function awardStars(userId: string, amount: number, skipBroadcast = false): Promise<{ success: boolean; newTotal: number }> {
  const db = await readDb();
  const user = db.users.find(u => u.id === userId);
  
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  
  user.stars = (user.stars || 0) + amount;
  await writeDb(db);
  
  logAction('AWARD_STARS', { userId, amount, newBalance: user.stars });
  
  if (!skipBroadcast) {
    broadcast({
      type: 'STARS_AWARDED',
      payload: {
        userId,
        amount,
        totalStars: user.stars
      }
    });
    
    // Also broadcast sync state
    const enrichedSpendings = await getEnrichedSpendings();
    broadcast({
      type: 'SYNC_STATE',
      payload: {
        userStars: globalState.userStars,
        spendings: enrichedSpendings
      }
    });
  }
  
  return { success: true, newTotal: user.stars };
}

// Set stars for a user (absolute value)
export async function setUserStars(userId: string, amount: number): Promise<{ success: boolean; newTotal: number }> {
  const db = await readDb();
  const user = db.users.find(u => u.id === userId);
  
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  
  const oldStars = user.stars || 0;
  user.stars = amount;
  await writeDb(db);
  
  logAction('SET_STARS', { userId, oldBalance: oldStars, newBalance: amount });
  
  // Broadcast sync state
  const enrichedSpendings = await getEnrichedSpendings();
  broadcast({
    type: 'SYNC_STATE',
    payload: {
      userStars: globalState.userStars,
      spendings: enrichedSpendings
    }
  });
  
  return { success: true, newTotal: user.stars };
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
  
  const matchField = (expr: string, value: number, max: number): boolean => {
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
    await writeDb(db);
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
    await writeDb(db);
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
    await writeDb(db);
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
    await writeDb(db);
    throw new Error('Chore has expired');
  }
  
  instance.status = 'claimed';
  instance.claimedBy = userId;
  instance.claimedAt = new Date().toISOString();
  
  await writeDb(db);
  
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
  
  await writeDb(db);
  
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
  
  await writeDb(db);
  
  // Award stars to the user (skip broadcast, we'll do it below)
  if (stars > 0) {
    await awardStars(instance.claimedBy, stars, true);
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
  
  await writeDb(db);
  
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

// ========== Exercise Management ==========

/**
 * Get all exercises with optional filtering by user eligibility
 */
export async function getExercises(userId?: string): Promise<{ exercises: Exercise[], instances: ExerciseInstance[] }> {
  const db = await readDb();
  
  let exercises = db.exercises;
  
  // Filter by eligibility if userId provided
  if (userId) {
    exercises = exercises.filter(ex => 
      !ex.eligibleUsers || ex.eligibleUsers.length === 0 || ex.eligibleUsers.includes(userId)
    );
  }
  
  return {
    exercises,
    instances: globalState.exerciseInstances
  };
}

/**
 * Start an exercise for a user
 */
export async function startExercise(exerciseId: string, userId: string): Promise<ExerciseInstance> {
  const db = await readDb();
  
  // Find the exercise
  const exercise = db.exercises.find(ex => ex.id === exerciseId);
  if (!exercise) {
    throw new Error(`Exercise ${exerciseId} not found`);
  }
  
  // Check eligibility
  if (exercise.eligibleUsers && exercise.eligibleUsers.length > 0 && !exercise.eligibleUsers.includes(userId)) {
    throw new Error(`User ${userId} is not eligible for this exercise`);
  }
  
  // Check if user already has an active instance of this exercise
  const existingActive = globalState.exerciseInstances.find(
    inst => inst.exerciseId === exerciseId && inst.userId === userId && inst.status === 'active'
  );
  
  if (existingActive) {
    // Return existing active instance
    return existingActive;
  }
  
  // Create new instance
  const instance: ExerciseInstance = {
    id: randomUUID(),
    exerciseId,
    userId,
    status: 'active',
    startedAt: new Date().toISOString(),
    attempts: 0,
    errors: 0
  };
  
  globalState.exerciseInstances.push(instance);
  scheduleSave();
  
  logAction('EXERCISE_START', { instance });
  
  // Broadcast state update
  broadcast({
    type: 'EXERCISE_STARTED',
    payload: { instance }
  });
  
  return instance;
}

/**
 * Submit an answer for an exercise
 */
export async function submitExercise(instanceId: string, answer: any): Promise<{ instance: ExerciseInstance, correct: boolean }> {
  const db = await readDb();
  
  // Find the instance
  const instance = globalState.exerciseInstances.find(inst => inst.id === instanceId);
  if (!instance) {
    throw new Error(`Exercise instance ${instanceId} not found`);
  }
  
  if (instance.status !== 'active') {
    throw new Error(`Exercise instance ${instanceId} is not active`);
  }
  
  // Find the exercise
  const exercise = db.exercises.find(ex => ex.id === instance.exerciseId);
  if (!exercise) {
    throw new Error(`Exercise ${instance.exerciseId} not found`);
  }
  
  // Increment attempts
  instance.attempts++;
  
  // Validate answer based on exercise type
  let correct = false;
  
  switch (exercise.content.type) {
    case 'spell-fill': {
      const expected = exercise.content.word.toUpperCase();
      const provided = (answer as string || '').toUpperCase();
      correct = expected === provided;
      break;
    }
    
    case 'grammar-choice': {
      correct = (answer as number) === exercise.content.correctIndex;
      break;
    }
    
    case 'math-simple':
    case 'math-vertical': {
      let expectedAnswer: number;
      const { operation, num1, num2 } = exercise.content;
      
      switch (operation) {
        case '+':
          expectedAnswer = num1 + num2;
          break;
        case '-':
          expectedAnswer = num1 - num2;
          break;
        case '*':
          expectedAnswer = num1 * num2;
          break;
        case '/':
          expectedAnswer = Math.floor(num1 / num2); // Integer division (quotient)
          break;
        default:
          expectedAnswer = 0;
      }
      
      correct = Math.abs((answer as number) - expectedAnswer) < 0.01;
      break;
    }
    
    case 'comprehension': {
      correct = (answer as number) === exercise.content.correctIndex;
      break;
    }
  }
  
  // Update instance based on result
  if (correct) {
    instance.status = 'completed';
    instance.completedAt = new Date().toISOString();
    instance.starsAwarded = exercise.stars;
    
    // Award stars
    if (!globalState.userStars[instance.userId]) {
      globalState.userStars[instance.userId] = 0;
    }
    globalState.userStars[instance.userId] += exercise.stars;
    
    logAction('EXERCISE_COMPLETED', { instance, starsAwarded: exercise.stars });
    
    // Broadcast success
    broadcast({
      type: 'EXERCISE_COMPLETED',
      payload: { instance, starsAwarded: exercise.stars }
    });
  } else {
    // Increment error count
    instance.errors++;
    
    // Determine max errors based on exercise settings
    const maxErrors = exercise.maxErrors || 3;
    const challengeMode = exercise.challengeMode || 'untimed';
    
    // For untimed mode: fail after maxErrors
    // For timed mode: keep trying until timeout (handled by frontend timer)
    if (challengeMode === 'untimed' && instance.errors >= maxErrors) {
      instance.status = 'failed';
      instance.completedAt = new Date().toISOString();
      
      logAction('EXERCISE_FAILED', { instance });
      
      broadcast({
        type: 'EXERCISE_FAILED',
        payload: { instance }
      });
    } else {
      // Still active, can try again
      const errorsRemaining = challengeMode === 'untimed' ? maxErrors - instance.errors : null;
      logAction('EXERCISE_ATTEMPT', { instance, correct: false, errorsRemaining });
    }
  }
  
  scheduleSave();
  
  return { instance, correct };
}

/**
 * Abandon an active exercise
 */
export async function abandonExercise(instanceId: string): Promise<ExerciseInstance> {
  const instance = globalState.exerciseInstances.find(inst => inst.id === instanceId);
  if (!instance) {
    throw new Error(`Exercise instance ${instanceId} not found`);
  }
  
  if (instance.status !== 'active') {
    throw new Error(`Exercise instance ${instanceId} is not active`);
  }
  
  instance.status = 'failed';
  instance.completedAt = new Date().toISOString();
  
  scheduleSave();
  
  logAction('EXERCISE_ABANDONED', { instance });
  
  broadcast({
    type: 'EXERCISE_ABANDONED',
    payload: { instance }
  });
  
  return instance;
}
