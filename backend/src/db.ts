import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import Ajv from 'ajv';
import { User, Routine, Task, Flow, Reward, Spending } from '../../shared/types';

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
} = {
  userStars: {},
  routineExecutions: [],
  taskExecutions: [],
  spendings: []
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
          spendings: []
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
      spendings: loaded.spendings || []
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
  settings?: { timezone: string };
  routineExecutions: any[];
  taskExecutions: any[];
  spendings: Spending[];
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
      schedules: data.schedules || [],
      settings: data.settings || { timezone: 'Europe/Athens' },
      routineExecutions: globalState.routineExecutions,
      taskExecutions: globalState.taskExecutions,
      spendings: globalState.spendings
    };
  } catch (error) {
    console.error("Error reading DB:", error);
    return {
      users: [], routines: [], tasks: [], routineTasks: [], 
      routineAssignments: [], flows: [], schedules: [], rewards: [],
      routineExecutions: [], taskExecutions: [], spendings: []
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
    spendings: data.spendings
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
export async function awardStars(userId: string, amount: number): Promise<{ success: boolean; newTotal: number }> {
  const db = await readDb();
  const user = db.users.find(u => u.id === userId);
  
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  
  user.stars = (user.stars || 0) + amount;
  await writeDb(db);
  
  logAction('AWARD_STARS', { userId, amount, newBalance: user.stars });
  
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
