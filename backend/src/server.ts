import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import cron from 'node-cron';
import { pipeline } from 'stream';
import util from 'util';
import { createWriteStream } from 'fs';
import Ajv from 'ajv';
import { User, Routine, Task, Flow, Reward, Spending } from '../../shared/types';

const pump = util.promisify(pipeline);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cronParser = require('cron-parser');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DateTime } = require('luxon');

const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data.json');
const STATE_FILE = process.env.STATE_FILE || path.join(process.cwd(), 'state.json');
const SCHEMA_FILE = path.join(process.cwd(), 'data.schema.json');
const STATE_SCHEMA_FILE = path.join(process.cwd(), 'state.schema.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure uploads dir exists
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

console.log('Using data file:', DATA_FILE);
console.log('Using state file:', STATE_FILE);
console.log('Using schema file:', SCHEMA_FILE);
console.log('Using state schema file:', STATE_SCHEMA_FILE);
console.log('Using uploads dir:', UPLOADS_DIR);

// Initialize JSON schema validator
// Don't validate formats strictly since we don't have ajv-formats installed
const ajv = new Ajv({ allErrors: true, validateFormats: false });
let validateConfig: any = null;
let validateState: any = null;

// Track validation errors for client reporting
let lastConfigError: { message: string, errors: any[] } | null = null;
let lastStateError: { message: string, errors: any[] } | null = null;

// Load schemas at startup
async function loadSchema() {
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
let globalState: {
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

// Load state from disk at startup
async function loadState() {
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
async function persistState() {
  console.log('Persisting state to disk...');
  const tempFile = `${STATE_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(globalState, null, 2));
  await fs.rename(tempFile, STATE_FILE);
}

function scheduleSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    persistState().catch(err => console.error('Failed to save state:', err));
    saveTimeout = null;
  }, 10000); // 10 seconds debounce
}

interface Db {
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

async function readDb(): Promise<Db> {
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

async function writeDb(data: Db) {
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

const server = Fastify({ logger: true });

// WebSocket connections
const wsConnections = new Set<any>();

// Broadcast helper
function broadcast(message: any) {
  const payload = JSON.stringify(message);
  wsConnections.forEach(ws => {
    if (ws.readyState === 1) { // OPEN
      ws.send(payload);
    }
  });
}

// Helper to trigger an action (Routine or Flow)
async function triggerAction(id: string, db: Db) {
  // Try to find RoutineAssignment
  const assignment = db.routineAssignments.find(a => a.id === id);

  if (assignment) {
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
    broadcast({
      type: 'FLOW_START',
      payload: {
        flowId: flow.id,
        steps: flow.steps // Already object
      }
    });

    return { success: true, type: 'flow', id };
  }

  return null;
}

// Scheduler Logic
async function checkSchedules(date: Date) {
  const db = await readDb();
  const timezone = db.settings?.timezone || 'Europe/Athens';
  
  const localTime = DateTime.fromJSDate(date).setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss');
  console.log(`Checking schedules for: ${localTime} (${timezone})`);
  
  for (const schedule of db.schedules) {
    try {
      // Check if the schedule matches the current minute
      // We go back 1 second to ensure 'next' returns the current minute if it matches exactly
      const interval = cronParser.CronExpressionParser.parse(schedule.cron, {
        currentDate: new Date(date.getTime() - 1000),
        tz: timezone
      });
      
      const next = interval.next().toDate();
      
      // Check if 'next' is in the same minute as 'date'
      // We must compare in the same timezone or just compare timestamps if we trust the parser
      // But 'next' is a JS Date (absolute). 'date' is a JS Date (absolute).
      // If they are within the same minute, it's a match.
      const diff = Math.abs(next.getTime() - date.getTime());
      const isMatch = diff < 60000 && next.getMinutes() === date.getMinutes();

      if (isMatch) {
        console.log(`Triggering schedule ${schedule.id} for target ${schedule.targetId}`);
        await triggerAction(schedule.targetId, db);
      }
    } catch (err) {
      console.error(`Error checking schedule ${schedule.id}:`, err);
    }
  }
}

async function getEnrichedSpendings() {
  const db = await readDb();
  return db.spendings.map(s => {
    const user = db.users.find(u => u.id === s.userId);
    const reward = db.rewards.find(r => r.id === s.rewardId);
    return { ...s, user, reward };
  }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Enable CORS
server.register(cors, {
  origin: true,
});

// Enable WebSocket
server.register(websocket);

// Enable Multipart
server.register(multipart);

// Enable Static for Uploads
server.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: '/uploads/',
});

// Health check
server.get('/health', async () => {
  return { status: 'ok', time: new Date().toISOString() };
});

// Helper to convert simple cron to HH:mm for frontend display
function simpleCronToTime(cron: string): string | undefined {
  try {
    const parts = cron.split(' ');
    if (parts.length >= 2) {
      const min = parts[0];
      const hour = parts[1];
      // Only convert if they are simple numbers (not *, */5, etc)
      if (!isNaN(Number(min)) && !isNaN(Number(hour))) {
        return `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
      }
    }
  } catch (e) { return undefined; }
  return undefined;
}

// User routes
server.get('/api/users', async (request, reply) => {
  try {
    const db = await readDb();
    
    // Join data manually
    const users = db.users.map((user: any) => {
      const assignments = db.routineAssignments
        .filter((a: any) => a.userId === user.id)
        .map((assignment: any) => {
          const routine = db.routines.find((r: any) => r.id === assignment.routineId);
          if (!routine) return null;

          // Resolve schedule
          let cronExpression = null;
          
          // 1. Direct schedule
          const directSchedule = db.schedules.find((s: any) => s.type === 'routine' && s.targetId === assignment.id);
          if (directSchedule) {
            cronExpression = directSchedule.cron;
          } else {
            // 2. Flow schedule (simple lookup)
            // Find flows that trigger this assignment
            const triggeringFlow = db.flows.find((f: any) => {
              return f.steps.some((step: any) => {
                if (step.type === 'routine' && step.routineId === assignment.id) return true;
                if (step.type === 'parallel') {
                  return step.actions.some((action: any) => action.type === 'routine' && action.routineId === assignment.id);
                }
                return false;
              });
            });
            
            if (triggeringFlow) {
              const flowSchedule = db.schedules.find((s: any) => s.type === 'flow' && s.targetId === triggeringFlow.id);
              if (flowSchedule) {
                cronExpression = flowSchedule.cron;
              }
            }
          }

          const routineTasks = db.routineTasks
            .filter((rt: any) => rt.routineId === routine.id)
            .sort((a: any, b: any) => a.order - b.order)
            .map((rt: any) => {
              const task = db.tasks.find((t: any) => t.id === rt.taskId);
              return {
                ...rt,
                task: task
              };
            });

          return {
            ...assignment,
            cronExpression,
            scheduleTime: cronExpression ? simpleCronToTime(cronExpression) : null,
            routine: {
              ...routine,
              tasks: routineTasks
            }
          };
        })
        .filter((a: any) => a !== null);

      return {
        ...user,
        assignments
      };
    });

    // Transform to match the expected frontend structure
    return users.map((user: any) => ({
      ...user,
      routines: user.assignments.map((assignment: any) => ({
        id: assignment.id, // Use assignment ID as the Routine ID for the frontend
        title: assignment.routine.title,
        scheduleTime: assignment.scheduleTime,
        cronExpression: assignment.cronExpression,
        themeColor: assignment.themeColor || assignment.routine.themeColor,
        icon: assignment.routine.icon,
        tasks: assignment.routine.tasks.map((rt: any) => ({
          id: rt.task.id,
          title: rt.task.title,
          icon: rt.task.icon,
          durationSeconds: rt.durationSeconds,
          routineId: assignment.id
        }))
      })),
      assignments: undefined // Remove the raw assignments from the response
    }));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

// Flow routes
server.get('/api/flows', async (request, reply) => {
  try {
    const db = await readDb();
    return db.flows; // Steps are already objects in JSON
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

// Rewards routes
server.get('/api/rewards', async (request, reply) => {
  try {
    const db = await readDb();
    return db.rewards;
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

// Spendings routes
server.get('/api/spendings', async (request, reply) => {
  try {
    const enriched = await getEnrichedSpendings();
    return enriched;
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

server.post('/api/spendings', async (request, reply) => {
  const { userId, rewardId } = request.body as { userId: string, rewardId: string };
  
  const db = await readDb();
  const user = db.users.find(u => u.id === userId);
  const reward = db.rewards.find(r => r.id === rewardId);

  if (!user || !reward) {
    return reply.code(404).send({ error: 'User or Reward not found' });
  }

  if (user.stars < reward.cost) {
    return reply.code(400).send({ error: 'Not enough stars' });
  }

  // Deduct stars
  user.stars -= reward.cost;

  // Create spending record
  const spending: Spending = {
    id: randomUUID(),
    userId,
    rewardId,
    cost: reward.cost,
    createdAt: new Date().toISOString(),
    status: 'pending' // pending, done
  };

  db.spendings.push(spending);
  await writeDb(db);

  const enrichedSpendings = await getEnrichedSpendings();

  broadcast({
    type: 'SYNC_STATE',
    payload: {
      userStars: globalState.userStars,
      spendings: enrichedSpendings
    }
  });

  return spending;
});

server.put('/api/spendings/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: 'pending' | 'done' | 'revoked' };

  const db = await readDb();
  const spending = db.spendings.find(s => s.id === id);

  if (!spending) {
    return reply.code(404).send({ error: 'Spending not found' });
  }

  // If revoking, refund stars
  if (status === 'revoked' && spending.status !== 'revoked') {
    const user = db.users.find(u => u.id === spending.userId);
    if (user) {
      user.stars += spending.cost;
    }
  }

  spending.status = status;
  await writeDb(db);

  const enrichedSpendings = await getEnrichedSpendings();

  broadcast({
    type: 'SYNC_STATE',
    payload: {
      userStars: globalState.userStars,
      spendings: enrichedSpendings
    }
  });

  return spending;
});

// Admin: Upload file
server.post('/api/admin/upload', async (request, reply) => {
  const data = await request.file();
  if (!data) {
    return reply.code(400).send({ error: 'No file uploaded' });
  }

  const filename = `${Date.now()}-${data.filename}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  
  await pump(data.file, createWriteStream(filepath));

  // Return the URL
  const protocol = request.protocol;
  const host = request.hostname;
  const url = `${protocol}://${host}/uploads/${filename}`;

  return { success: true, url, filename };
});

// Push hook endpoint
server.post('/api/hooks/push', async (request, reply) => {
  try {
    const { id } = request.body as { id: string };

    if (!id) {
      return reply.code(400).send({ error: 'Missing id' });
    }

    const db = await readDb();

    // 1. Try to find a schedule for this ID
    const schedule = db.schedules.find(s => s.targetId === id);

    if (schedule) {
      // Found a schedule! Let's simulate the time.
      // Calculate next occurrence from now
      const timezone = db.settings?.timezone || 'Europe/Athens';
      const interval = cronParser.CronExpressionParser.parse(schedule.cron, {
        tz: timezone
      });
      const nextTime = interval.next().toDate();
      
      request.log.info(`[Hook] Found schedule for ${id}: ${schedule.cron}. Simulating time: ${nextTime.toISOString()}`);
      
      // Trigger the scheduler at that time
      await checkSchedules(nextTime);
      
      return { success: true, type: 'schedule_simulation', simulatedTime: nextTime, targetId: id };
    }

    // 2. Fallback: Special case for alarm (if not scheduled)
    if (id === 'alarm') {
      broadcast({ type: 'ALARM_START' });
      return { success: true, type: 'alarm' };
    }

    // 3. Fallback: Try to trigger directly if no schedule exists
    const result = await triggerAction(id, db);

    if (result) {
      return result;
    }

    // Not found
    return reply.code(404).send({ error: 'Entity not found' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

// Task completion endpoint
server.post('/api/executions/:executionId/tasks/:taskId/complete', async (request, reply) => {
  const { executionId, taskId } = request.params as { executionId: string, taskId: string };
  const { duration, isOnTime } = request.body as { duration: number, isOnTime: boolean };

  const db = await readDb();

  // Get the task to know how many stars it is worth
  const task = db.tasks.find(t => t.id === taskId);

  if (!task) {
    return reply.code(404).send({ error: 'Task not found' });
  }

  // Create TaskExecution
  db.taskExecutions.push({
    id: randomUUID(),
    executionId,
    taskId,
    duration,
    isOnTime,
    completedAt: new Date().toISOString()
  });

  // Update User stars
  // First find the execution to get the user
  const execution = db.routineExecutions.find(e => e.id === executionId);

  if (execution) {
    const starsToAdd = task.stars || 0; // Use the stars from the task definition
    
    // Update user
    const user = db.users.find(u => u.id === execution.userId);
    if (user) {
      user.stars = (user.stars || 0) + starsToAdd;
    }

    // Update routine execution total stars
    execution.totalStars = (execution.totalStars || 0) + starsToAdd;
    
    await writeDb(db);
    
    // Broadcast update
    if (user) {
      broadcast({
        type: 'STARS_AWARDED',
        payload: {
          userId: execution.userId,
          amount: starsToAdd,
          totalStars: user.stars
        }
      });
    }

    return { success: true, starsAwarded: starsToAdd };
  }

  return { success: false, error: 'Execution not found' };
});

// Debug endpoint to simulate time
server.post('/api/debug/time', async (request, reply) => {
  const { time } = request.body as { time: string };
  if (!time) return reply.code(400).send({ error: 'Missing time (ISO string or HH:mm)' });

  const db = await readDb();
  const timezone = db.settings?.timezone || 'Europe/Athens';

  let date: Date;
  if (time.includes('T')) {
    date = new Date(time);
  } else {
    // Handle HH:mm by using today's date in the target timezone
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create a date in the target timezone
    const now = DateTime.now().setZone(timezone);
    const target = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
    
    date = target.toJSDate();
  }

  if (isNaN(date.getTime())) return reply.code(400).send({ error: 'Invalid time format' });

  await checkSchedules(date);
  return { success: true, simulatedTime: date.toISOString() };
});

// Admin: Get raw data.json
server.get('/api/admin/data', async (request, reply) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return reply.code(500).send({ error: 'Failed to read data file' });
  }
});

// Admin: Validate config against schema
server.post('/api/admin/validate', async (request, reply) => {
  try {
    const data = request.body;
    
    if (!validateConfig) {
      return reply.code(503).send({ 
        valid: false, 
        error: 'Schema validation not available' 
      });
    }
    
    const valid = validateConfig(data);
    
    if (!valid) {
      return { 
        valid: false, 
        errors: validateConfig.errors 
      };
    }
    
    return { valid: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Validation failed', details: (error as Error).message });
  }
});

// Admin: Validate state against schema
server.post('/api/admin/validate-state', async (request, reply) => {
  try {
    const data = request.body;
    
    if (!validateState) {
      return reply.code(503).send({ 
        valid: false, 
        error: 'State schema validation not available' 
      });
    }
    
    const valid = validateState(data);
    
    if (!valid) {
      return { 
        valid: false, 
        errors: validateState.errors 
      };
    }
    
    return { valid: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Validation failed', details: (error as Error).message });
  }
});

// Admin: Update data.json
server.post('/api/admin/data', async (request, reply) => {
  try {
    const newData = request.body;
    
    // Validate against schema if available
    if (validateConfig) {
      const valid = validateConfig(newData);
      if (!valid) {
        return reply.code(400).send({ 
          error: 'Validation failed', 
          errors: validateConfig.errors 
        });
      }
    }
    
    await fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2));
    
    lastConfigError = null; // Clear error on successful save
    broadcast({ type: 'CONFIG_UPDATED' });
    
    return { success: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to save data file' });
  }
});

// Admin: Get validation status
server.get('/api/admin/validation-status', async (request, reply) => {
  return {
    config: lastConfigError,
    state: lastStateError
  };
});

// Admin: Get data schema
server.get('/api/admin/schema/data', async (request, reply) => {
  try {
    const schemaPath = path.join(__dirname, '../data.schema.json');
    const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
    return schema;
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to load data schema' });
  }
});

// Admin: Get state schema
server.get('/api/admin/schema/state', async (request, reply) => {
  try {
    const schemaPath = path.join(__dirname, '../state.schema.json');
    const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
    return schema;
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to load state schema' });
  }
});

// Admin: Get raw state
server.get('/api/admin/state', async (request, reply) => {
  return globalState;
});

// Admin: Update state
server.post('/api/admin/state', async (request, reply) => {
  try {
    const newState = request.body as any;
    
    // Validate against schema if available
    if (validateState) {
      const valid = validateState(newState);
      if (!valid) {
        return reply.code(400).send({ 
          error: 'State validation failed', 
          errors: validateState.errors 
        });
      }
    }
    
    globalState = newState;
    scheduleSave();
    
    lastStateError = null; // Clear error on successful save
    const enrichedSpendings = await getEnrichedSpendings();

    broadcast({
      type: 'SYNC_STATE',
      payload: {
        userStars: globalState.userStars,
        spendings: enrichedSpendings
      }
    });
    
    return { success: true };
  } catch (error) {
    return reply.code(500).send({ error: 'Failed to update state' });
  }
});

// WebSocket for real-time events
server.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (connection: any, req) => {
    fastify.log.info('Client connected via WebSocket');
    wsConnections.add(connection);

    const enrichedSpendings = await getEnrichedSpendings();

    // Send initial state sync
    connection.send(JSON.stringify({
      type: 'SYNC_STATE',
      payload: {
        userStars: globalState.userStars,
        spendings: enrichedSpendings
      }
    }));

    connection.on('message', (message: any) => {
      const data = JSON.parse(message.toString());
      fastify.log.info({ msg: 'Received', data });

      // Echo back for now
      connection.send(JSON.stringify({ type: 'ACK', data }));
    });

    connection.on('close', () => {
      fastify.log.info('Client disconnected');
      wsConnections.delete(connection);
    });
  });
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Stopping server...');
  if (saveTimeout) {
    console.log('Flushing pending state save...');
    clearTimeout(saveTimeout);
    await persistState();
  }
  process.exit(0);
});

const start = async () => {
  try {
    await loadSchema();
    await loadState();
    
    // Start the real scheduler (checks every minute)
    cron.schedule('* * * * *', () => {
      checkSchedules(new Date());
    });
    console.log('Scheduler started');

    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
