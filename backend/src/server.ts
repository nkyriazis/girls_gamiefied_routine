import Fastify, { FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { promises as fs } from 'fs';
import path from 'path';
import cron from 'node-cron';
import { pipeline } from 'stream';
import util from 'util';
import { createWriteStream } from 'fs';
import { Spending, StateSnapshot } from '../../shared/types';

// Import shared database layer
import {
  store, sync, triggerAction, completeTask, closeRoutine, closeStaleRoutines, expireAlarms, dismissAlarm, history,
  readLastLogs, MAX_LOGS, awardStars, takeStars, buyReward, resolveSpending, createGift, resolveGift, StarsError, UPLOADS_DIR, getChoresWithInstances, claimChore,
  attemptChore, confirmChore, rejectChore, readExercises, readExerciseCategories, readRawExercises,
  writeRawExercises, readRawConfig, writeRawConfig, startExerciseSession, submitExerciseAnswer,
  closeExerciseSession, gameResultsLeaving, getExerciseSession, generateChoreInstances, expireChores, cleanupOldChoreInstances,
  logAction, getExerciseAssignments, answerExerciseAssignment, revealExerciseAssignment, startExtraProblem, usersView,
  stateSnapshot, replaceState, ensureDailyAssignments, markHelpSeen, resetHelp
} from './db';
import { config, configError, dataConfig, exercisesConfig, reloadConfig, watchConfig } from './config';
import { importLegacy } from './migrate';
import { HEARTBEAT_MS } from './sync';
import { BACKUP_CRON, BACKUP_DIR, BACKUP_TIMEOUT_MS, DB_FILE, LOGS_FILE, STATE_FILE } from './paths';
import { BackupJob, scheduleBackups } from './backupSchedule';
import { check, dataSchema, exercisesSchema, stateSchema } from './schemas';
import { cronMatchesAt, nextCronRun } from './cron';

const pump = util.promisify(pipeline);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DateTime } = require('luxon');

const server = Fastify({ logger: true });

// Scheduler Logic
async function checkSchedules(date: Date) {
  const { schedules, settings } = config();
  const timezone = settings?.timezone || 'Europe/Athens';
  
  const localTime = DateTime.fromJSDate(date).setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss');
  console.log(`Checking schedules for: ${localTime} (${timezone})`);
  
  // Check regular schedules (flows, routines)
  for (const schedule of schedules) {
    try {
      if (cronMatchesAt(schedule.cron, date, timezone)) {
        console.log(`Triggering schedule ${schedule.id} for target ${schedule.targetId}`);
        logAction('SCHEDULE_MATCH', { scheduleId: schedule.id, targetId: schedule.targetId, cron: schedule.cron, time: localTime });
        triggerAction(schedule.targetId, `schedule:${schedule.id}`);
      }
    } catch (err) {
      console.error(`Error checking schedule ${schedule.id}:`, err);
      logAction('SCHEDULE_ERROR', { scheduleId: schedule.id, error: (err as Error).message });
    }
  }
  
  // Generate new chore instances based on their cron schedules
  try {
    const newInstances = generateChoreInstances();
    if (newInstances.length > 0) {
      console.log(`Generated ${newInstances.length} new chore instance(s)`);
    }
  } catch (err) {
    console.error('Error generating chore instances:', err);
    logAction('CHORE_GENERATION_ERROR', { error: (err as Error).message });
  }
  
  // Expire overdue chores
  try {
    const { expired, notified } = expireChores();
    if (expired.length > 0) {
      console.log(`Expired ${expired.length} chore(s), notified ${notified.length} user(s)`);
    }
  } catch (err) {
    console.error('Error expiring chores:', err);
    logAction('CHORE_EXPIRATION_ERROR', { error: (err as Error).message });
  }
  
  // Stop alarms that rang too long, and close routines left open on an earlier day
  try {
    expireAlarms();
  } catch (err) {
    console.error('Error expiring alarms:', err);
  }
  try {
    closeStaleRoutines();
  } catch (err) {
    console.error('Error closing stale routines:', err);
  }

  // Draw today's exercise assignments once the day changes
  try {
    await ensureDailyAssignments();
  } catch (err) {
    console.error('Error drawing exercise assignments:', err);
  }

  // Cleanup old instances once per hour (at minute 0)
  if (new Date().getMinutes() === 0) {
    try {
      const removed = cleanupOldChoreInstances();
      if (removed > 0) {
        console.log(`Cleaned up ${removed} old chore instance(s)`);
      }
    } catch (err) {
      console.error('Error cleaning up chore instances:', err);
      logAction('CHORE_CLEANUP_ERROR', { error: (err as Error).message });
    }
  }
}

// Enable CORS
server.register(cors, {
  origin: true,
});

// Enable WebSocket. STATE is the whole world as JSON, sent to every screen on every change: deflated
// (permessage-deflate, when the browser offers it; Vite's proxy and nginx pass it through) it is a fifth.
server.register(websocket, { options: { perMessageDeflate: true } });

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

// User routes: users with their star balance and their assigned routines
server.get('/api/users', async () => usersView());

// Star operations refused with a reason (StarsError) answer with its status and text; the parent's toasts show it.
async function refusable<T>(reply: FastifyReply, operation: () => T) {
  try {
    return operation();
  } catch (err) {
    if (err instanceof StarsError) return reply.code(err.status).send({ error: err.message });
    throw err;
  }
}

// Parent: add (or, with a negative amount, take away) stars
server.post('/api/users/:id/stars', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { amount } = (request.body ?? {}) as { amount?: unknown };
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0) {
    return reply.code(400).send({ error: 'amount must be a non-zero integer' });
  }
  return refusable(reply, () => amount > 0 ? awardStars(id, amount) : takeStars(id, -amount));
});

// Flow routes
server.get('/api/flows', async (request, reply) => {
  try {
    return config().flows;
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

// Rewards routes
server.get('/api/rewards', async (request, reply) => {
  try {
    return config().rewards;
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

// Chores routes
server.get('/api/chores', async (request, reply) => {
  try {
    const { userId } = request.query as { userId?: string };
    const { chores, instances } = getChoresWithInstances(userId);
    return { chores, instances };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

server.post('/api/chores/:instanceId/claim', async (request, reply) => {
  try {
    const { instanceId } = request.params as { instanceId: string };
    const { userId } = request.body as { userId: string };
    
    if (!userId) {
      return reply.code(400).send({ error: 'userId is required' });
    }
    
    const instance = claimChore(instanceId, userId);
    return instance;
  } catch (error) {
    request.log.error(error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return reply.code(404).send({ error: message });
    }
    if (message.includes('not available') || message.includes('not eligible') || message.includes('expired')) {
      return reply.code(400).send({ error: message });
    }
    return reply.code(500).send({ error: 'Internal Server Error', details: message });
  }
});

server.post('/api/chores/:instanceId/attempt', async (request, reply) => {
  try {
    const { instanceId } = request.params as { instanceId: string };
    
    const instance = attemptChore(instanceId);
    return instance;
  } catch (error) {
    request.log.error(error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return reply.code(404).send({ error: message });
    }
    if (message.includes('must be claimed')) {
      return reply.code(400).send({ error: message });
    }
    return reply.code(500).send({ error: 'Internal Server Error', details: message });
  }
});

server.post('/api/chores/:instanceId/confirm', async (request, reply) => {
  try {
    const { instanceId } = request.params as { instanceId: string };
    const { stars } = request.body as { stars?: number };
    
    const instance = confirmChore(instanceId, stars);
    return instance;
  } catch (error) {
    request.log.error(error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return reply.code(404).send({ error: message });
    }
    if (message.includes('must be attempted') || message.includes('no claimer')) {
      return reply.code(400).send({ error: message });
    }
    return reply.code(500).send({ error: 'Internal Server Error', details: message });
  }
});

server.post('/api/chores/:instanceId/reject', async (request, reply) => {
  try {
    const { instanceId } = request.params as { instanceId: string };
    
    const instance = rejectChore(instanceId);
    return instance;
  } catch (error) {
    request.log.error(error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return reply.code(404).send({ error: message });
    }
    if (message.includes('must be attempted')) {
      return reply.code(400).send({ error: message });
    }
    return reply.code(500).send({ error: 'Internal Server Error', details: message });
  }
});

// What was decided, a page at a time, newest first (Ιστορικό): ?before=<the previous page's next>&limit=&userId=
server.get('/api/history', async (request, reply) => {
  const { before, limit, userId } = request.query as { before?: string; limit?: string; userId?: string };
  const n = limit === undefined ? undefined : Number(limit);
  if (n !== undefined && !(Number.isInteger(n) && n >= 1 && n <= 100)) return reply.code(400).send({ error: 'limit must be 1-100' });
  if (before !== undefined && !/^[^|]+\|[^|]+$/.test(before)) return reply.code(400).send({ error: 'before must be a page\'s next' });
  return history({ before, limit: n, userId: userId || undefined });
});

// Spendings routes
server.post('/api/spendings', async (request, reply) => {
  const { userId, rewardId } = request.body as { userId: string, rewardId: string };
  return refusable(reply, () => buyReward(userId, rewardId));
});

server.put('/api/spendings/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: Spending['status'] };
  return refusable(reply, () => resolveSpending(id, status));
});

// Star Transfers routes
server.post('/api/transfers', async (request, reply) => {
  const { fromUserId, toUserId, amount } = request.body as { fromUserId: string, toUserId: string, amount: number };
  return refusable(reply, () => createGift(fromUserId, toUserId, amount));
});

server.put('/api/transfers/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { action } = request.body as { action: 'approve' | 'reject' | 'cancel' };
  return refusable(reply, () => resolveGift(id, action));
});

// Admin: Upload file
server.post('/api/admin/upload', async (request, reply) => {
  try {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const filename = `${Date.now()}-${data.filename}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    
    await pump(data.file, createWriteStream(filepath));

    const protocol = request.protocol;
    const host = request.hostname;
    const url = `${protocol}://${host}/uploads/${filename}`;

    return reply.code(200).send({ success: true, url, filename });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Upload failed' });
  }
});

// Push hook endpoint
server.post('/api/hooks/push', async (request, reply) => {
  try {
    const { id } = request.body as { id: string };

    if (!id) {
      return reply.code(400).send({ error: 'Missing id' });
    }

    logAction('PUSH_HOOK', { id });

    const { schedules, settings } = config();

    const schedule = schedules.find(s => s.targetId === id);

    if (schedule) {
      const timezone = settings?.timezone || 'Europe/Athens';
      const nextTime = nextCronRun(schedule.cron, timezone);
      
      request.log.info(`[Hook] Found schedule for ${id}: ${schedule.cron}. Simulating time: ${nextTime.toISOString()}`);
      
      await checkSchedules(nextTime);
      
      return { success: true, type: 'schedule_simulation', simulatedTime: nextTime, targetId: id };
    }

    const result = triggerAction(id, 'push_hook');

    if (result) {
      return result;
    }

    return reply.code(404).send({ error: 'Entity not found' });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

// What kids do on a running routine or flow (see "ROUTINES AND FLOWS ON SCREEN" in db.ts).
// Each is idempotent, so two devices reporting the same action is harmless.
server.post('/api/executions/:executionId/tasks/:taskId/complete', async (request, reply) => {
  const { executionId, taskId } = request.params as { executionId: string, taskId: string };
  const result = completeTask(executionId, taskId);
  return result.success ? result : reply.code(409).send(result);
});

server.post('/api/executions/:executionId/close', async (request) => {
  const { executionId } = request.params as { executionId: string };
  return { success: closeRoutine(executionId) };
});

server.post('/api/flow-runs/:runId/steps/:stepIndex/dismiss', async (request) => {
  const { runId, stepIndex } = request.params as { runId: string, stepIndex: string };
  return { success: dismissAlarm(runId, Number(stepIndex)) };
});

// Debug endpoint to simulate time
// Debug: take a backup now, the way the daily one runs (a child process; see the action log)
let backups: BackupJob | null = null;
server.post('/api/debug/backup', async (request, reply) => {
  if (!backups) return reply.code(503).send({ error: 'The backup schedule is not running yet' });
  return { started: backups.run('debug') };
});

server.post('/api/debug/time', async (request, reply) => {
  const { time } = request.body as { time: string };
  if (!time) return reply.code(400).send({ error: 'Missing time (ISO string or HH:mm)' });

  const timezone = config().settings?.timezone || 'Europe/Athens';

  let date: Date;
  if (time.includes('T')) {
    date = new Date(time);
  } else {
    const [hours, minutes] = time.split(':').map(Number);
    const now = DateTime.now().setZone(timezone);
    const target = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
    date = target.toJSDate();
  }

  if (isNaN(date.getTime())) return reply.code(400).send({ error: 'Invalid time format' });

  await checkSchedules(date);
  return { success: true, simulatedTime: date.toISOString() };
});

// Debug endpoint to check schedule status
server.get('/api/debug/schedule', async (request, reply) => {
  const { schedules: configuredSchedules, settings } = config();
  const timezone = settings?.timezone || 'Europe/Athens';
  const now = new Date();
  
  const localTime = DateTime.fromJSDate(now).setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss');
  
  const schedules = configuredSchedules.map(s => {
    try {
      const next = nextCronRun(s.cron, timezone, now);
      const nextLocal = DateTime.fromJSDate(next).setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss');
      
      return {
        id: s.id,
        cron: s.cron,
        targetId: s.targetId,
        nextRun: next.toISOString(),
        nextRunLocal: nextLocal
      };
    } catch (e) {
      return {
        id: s.id,
        cron: s.cron,
        error: (e as Error).message
      };
    }
  });

  return {
    serverTime: now.toISOString(),
    timezone,
    serverTimeLocal: localTime,
    schedules
  };
});

// Admin: Get raw data.json
server.get('/api/admin/data', async () => {
  return readRawConfig();
});

// Admin: Validate config against schema
server.post('/api/admin/validate', async (request, reply) => {
  try {
    const error = check(dataSchema, request.body, 'Invalid config');
    return error ? { valid: false, errors: error.errors } : { valid: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Validation failed', details: (error as Error).message });
  }
});

// Admin: Validate state against schema
server.post('/api/admin/validate-state', async (request, reply) => {
  try {
    const error = check(stateSchema, request.body, 'Invalid state');
    return error ? { valid: false, errors: error.errors } : { valid: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Validation failed', details: (error as Error).message });
  }
});

// `?replace=1`: replace the file even though it is invalid on disk (the Advanced
// JSON editor only; the invalid file is kept beside). See ConfigFile.save.
const replacing = (request: { query: unknown }) => (request.query as { replace?: string }).replace === '1';

// Admin: data.json's text as it is on disk, to fix a file the server couldn't read
server.get('/api/admin/data/text', async (request, reply) => {
  const text = dataConfig.text();
  return text === null ? reply.code(404).send({ error: 'data.json not found' }) : { text };
});

// Admin: Update data.json
server.post('/api/admin/data', async (request, reply) => {
  const error = check(dataSchema, request.body, 'Validation failed');
  if (error) {
    return reply.code(400).send({ error: error.message, errors: error.errors });
  }
  try {
    writeRawConfig(request.body, { replace: replacing(request) });
    return { success: true };
  } catch (error) {
    // Refused while data.json on disk is invalid (or the write failed)
    request.log.error(error);
    return reply.code(400).send({ error: (error as Error).message });
  }
});

// Admin: Get validation status
server.get('/api/admin/validation-status', async (request, reply) => {
  // State lives in the database now, so there is no state file to be invalid.
  return {
    config: configError(),
    state: null
  };
});

// Admin: Get action logs
server.get('/api/debug/logs', async (request, reply) => {
  return readLastLogs(MAX_LOGS);
});

// Admin: Get data schema
server.get('/api/admin/schema/data', async (request, reply) => {
  return dataSchema.schema;
});

// Admin: Get state schema
server.get('/api/admin/schema/state', async (request, reply) => {
  return stateSchema.schema;
});

// Admin: List uploaded files
server.get('/api/admin/uploads/list', async (request, reply) => {
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    return files.filter(f => !f.startsWith('.'));
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to list uploads' });
  }
});

// ============================================
// SCHOOL EXERCISES SYSTEM
// ============================================

server.get('/api/exercises', async (request, reply) => {
  const { category } = request.query as { category?: string };
  const exercises = readExercises();
  return category ? exercises.filter(e => e.category === category) : exercises;
});

server.get('/api/exercises/categories', async (request, reply) => {
  return readExerciseCategories();
});

server.get('/api/exercises/schema', async (request, reply) => {
  return exercisesSchema.schema;
});

// Admin: Raw exercises CRUD
server.get('/api/admin/exercises', async (request, reply) => {
  return readRawExercises();
});

server.get('/api/admin/exercises/text', async (request, reply) => {
  const text = exercisesConfig.text();
  return text === null ? reply.code(404).send({ error: 'exercises.json not found' }) : { text };
});

server.post('/api/admin/exercises', async (request, reply) => {
  try {
    writeRawExercises(request.body, { replace: replacing(request) });
    return { success: true };
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

server.post('/api/exercises/sessions', async (request, reply) => {
  try {
    const { playerIds, categories, totalRounds, questionsPerRound } = request.body as any;
    const session = startExerciseSession(playerIds, categories, totalRounds, questionsPerRound);
    return session;
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

server.get('/api/exercises/sessions/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const session = getExerciseSession(id);
  if (!session) return reply.code(404).send({ error: 'Session not found' });
  return session;
});

server.post('/api/exercises/sessions/:id/answer', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const { userId, exerciseId, answer } = request.body as any;
    const result = submitExerciseAnswer(id, userId, exerciseId, answer);
    return result;
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

server.delete('/api/exercises/sessions/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    closeExerciseSession(id);
    return { success: true };
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

// ============================================
// DAILY EXERCISE ASSIGNMENTS (per-user)
// ============================================

// Today's assignments (lazily generated), enriched with exercise definitions
server.get('/api/exercise-assignments', async (request, reply) => {
  try {
    const { userId } = request.query as { userId?: string };
    return await getExerciseAssignments(userId);
  } catch (error) {
    return reply.code(500).send({ error: (error as Error).message });
  }
});

// A kid asks for one more problem (see startExtraProblem)
server.post('/api/exercise-assignments/extra', async (request, reply) => {
  try {
    const { userId } = request.body as { userId: string };
    return await startExtraProblem(userId);
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

// Answer an assignment
server.post('/api/exercise-assignments/:id/answer', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const { answer } = request.body as any;
    const result = await answerExerciseAssignment(id, answer);
    return result;
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

// «Δείξε μου» on a plain exercise after a wrong try: closes it, paying nothing (see revealExerciseAssignment)
server.post('/api/exercise-assignments/:id/reveal', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    return await revealExerciseAssignment(id);
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

// Help tours played on the kids' screens (the owl stops offering them), and a reset
server.post('/api/help/seen', async (request, reply) => {
  try {
    markHelpSeen((request.body as { tourIds?: unknown })?.tourIds);
    return { ok: true };
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

server.post('/api/help/reset', async (request) => {
  const { userId } = (request.body ?? {}) as { userId?: string };
  return { reset: resetHelp(userId || undefined) };
});

// Admin: Get the full runtime state (from the database, in state.json shape)
server.get('/api/admin/state', async () => {
  return stateSnapshot();
});

// Admin: Replace the full runtime state
server.post('/api/admin/state', async (request, reply) => {
  const error = check(stateSchema, request.body, 'State validation failed');
  if (error) {
    return reply.code(400).send({ error: error.message, errors: error.errors });
  }
  try {
    replaceState(request.body as StateSnapshot);
    return { success: true };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: 'Failed to update state' });
  }
});

// WebSocket for real-time events
server.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (connection) => {
    fastify.log.info('Client connected via WebSocket');
    sync.connect(connection); // sends it the current state

    connection.on('close', () => {
      fastify.log.info('Client disconnected');
      sync.disconnect(connection);
    });
  });
});

const start = async () => {
  try {
    // First start on a database: import the legacy JSON files (read-only).
    const legacy = importLegacy(store, { stateFile: STATE_FILE, logsFile: LOGS_FILE });
    console.log(legacy.imported
      ? `Imported legacy ${STATE_FILE} and ${LOGS_FILE} into the database`
      : `Legacy files already imported at ${legacy.importedAt}`);

    const change = reloadConfig();
    // An alarm left ringing while the server was down doesn't come back late
    expireAlarms();
    if (change?.type === 'invalid') {
      console.error('Config is invalid; running with an empty config until it is fixed:', change.error);
    }
    await ensureDailyAssignments();
    watchConfig(change => {
      if (change.type === 'updated') {
        console.log('Config changed on disk; reloaded');
      } else {
        console.error('Config changed on disk but is invalid; keeping the last valid config:', change.error);
      }
      sync.changed(); // clients get the new config, or the error
    });
    
    setInterval(() => sync.heartbeat(), HEARTBEAT_MS);

    // Start the real scheduler (checks every minute)
    let gamesCheckedAt = new Date();
    cron.schedule('* * * * *', () => {
      const now = new Date();
      checkSchedules(now);
      // A finished game's results leave the screens when their window ends: nothing is written, so say so
      if (gameResultsLeaving(gamesCheckedAt, now).length > 0) sync.changed();
      gamesCheckedAt = now;
    });
    console.log('Scheduler started');
    // The daily backup, in a child process (backupSchedule.ts)
    backups = scheduleBackups({ cron: BACKUP_CRON, dir: BACKUP_DIR, dbFile: DB_FILE, timeoutMs: BACKUP_TIMEOUT_MS, log: logAction });

    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// The routes are importable (the tests call them with server.inject against their own data); only
// running this file (nodemon in dev, `node dist/backend/src/server.js` in the image) starts the server.
export { server };

if (require.main === module) {
  // Graceful shutdown (SIGTERM from `docker stop`, SIGINT from Ctrl-C). Every
  // change is already committed; closing checkpoints the WAL into routine.db.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      console.log(`${signal}: stopping server...`);
      await server.close();
      store.close();
      process.exit(0);
    });
  }
  start();
}
