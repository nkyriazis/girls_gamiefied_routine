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
import { CONFIG_SAVE_SOURCES, StateSnapshot } from '../../shared/types';
import { UPLOAD_MAX_BYTES, uploadBroke, uploadNoFile, uploadTooBig } from '../../shared/uploads';

// Import shared database layer
import {
  store, sync, triggerAction, completeTask, closeRoutine, closeStaleRoutines, expireAlarms, dismissAlarm, history,
  readLastLogs, MAX_LOGS, awardStars, takeStars, buyReward, resolveSpending, createGift, resolveGift, StarsError, UPLOADS_DIR, getChoresWithInstances, claimChore,
  attemptChore, confirmChore, rejectChore, readExercises, readExerciseCategories,
  writeRawExercises, writeRawConfig, ConfigConflict, type ConfigSave, startExerciseSession, submitExerciseAnswer,
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
import {
  answerBody, AnswerBody, claimBody, ClaimBody, closeBody, CloseBody, confirmBody, ConfirmBody, gameAnswerBody, GameAnswerBody, gameBody, GameBody,
  helpResetBody, HelpResetBody, helpSeenBody, HelpSeenBody, pushBody, PushBody, spendingBody, SpendingBody, spendingStatusBody,
  SpendingStatusBody, starsBody, StarsBody, timeBody, TimeBody, transferActionBody, TransferActionBody, transferBody, TransferBody,
  userBody, UserBody
} from './bodies';

const pump = util.promisify(pipeline);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DateTime } = require('luxon');

// Request bodies are checked against their schema (bodies.ts) with strict types: "5" is not taken for 5
// (Fastify's default would coerce it). Only bodies have schemas, so params and query strings are untouched.
const server = Fastify({ logger: true, ajv: { customOptions: { coerceTypes: false } } });

type Id = { id: string };
type InstanceId = { instanceId: string };

// A body that doesn't match its schema is a 400 { error: 'body/amount must be integer' } (the shape api.ts
// reads), before the handler runs, so it changes nothing. Every other error goes on to Fastify's own handler.
server.setErrorHandler((error, request, reply) => {
  if ((error as { validation?: unknown }).validation) return reply.code(400).send({ error: (error as Error).message });
  throw error;
});

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

// Multipart, for /api/admin/upload: a file stops at UPLOAD_MAX_BYTES (shared/uploads.ts, #107). Left unset it
// would stop at Fastify's bodyLimit (1 MiB), and the route would keep the cut file as if it were whole.
server.register(multipart, { limits: { fileSize: UPLOAD_MAX_BYTES } });

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
server.post<{ Params: Id; Body: StarsBody }>('/api/users/:id/stars', { schema: { body: starsBody } }, async (request, reply) => {
  const { id } = request.params;
  const { amount } = request.body;
  if (amount === 0) return reply.code(400).send({ error: 'amount must be a non-zero integer' });
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

server.post<{ Params: InstanceId; Body: ClaimBody }>('/api/chores/:instanceId/claim', { schema: { body: claimBody } }, async (request, reply) => {
  try {
    const { instanceId } = request.params;
    const { userId } = request.body;

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

server.post<{ Params: InstanceId; Body: ConfirmBody }>('/api/chores/:instanceId/confirm', { schema: { body: confirmBody } }, async (request, reply) => {
  try {
    const { instanceId } = request.params;
    const { stars } = request.body;

    const instance = confirmChore(instanceId, stars);
    return instance;
  } catch (error) {
    request.log.error(error);
    if (error instanceof StarsError) return reply.code(error.status).send({ error: error.message });
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
server.post<{ Body: SpendingBody }>('/api/spendings', { schema: { body: spendingBody } }, async (request, reply) => {
  const { userId, rewardId } = request.body;
  return refusable(reply, () => buyReward(userId, rewardId));
});

server.put<{ Params: Id; Body: SpendingStatusBody }>('/api/spendings/:id', { schema: { body: spendingStatusBody } }, async (request, reply) => {
  const { id } = request.params;
  const { status } = request.body;
  return refusable(reply, () => resolveSpending(id, status));
});

// Star Transfers routes
server.post<{ Body: TransferBody }>('/api/transfers', { schema: { body: transferBody } }, async (request, reply) => {
  const { fromUserId, toUserId, amount } = request.body;
  return refusable(reply, () => createGift(fromUserId, toUserId, amount));
});

server.put<{ Params: Id; Body: TransferActionBody }>('/api/transfers/:id', { schema: { body: transferActionBody } }, async (request, reply) => {
  const { id } = request.params;
  const { action } = request.body;
  return refusable(reply, () => resolveGift(id, action));
});

// Admin: Upload file. Every answer but the 200 is { error } in Greek, naming the file (shared/uploads.ts),
// and a file that didn't arrive whole is never kept (#107).
server.post('/api/admin/upload', async (request, reply) => {
  let name: string | undefined;
  let filepath: string | undefined;
  try {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: uploadNoFile });
    }
    name = data.filename;

    const filename = `${Date.now()}-${data.filename}`;
    filepath = path.join(UPLOADS_DIR, filename);

    await pump(data.file, createWriteStream(filepath));
    // Over the limit, busboy stops the stream there and marks it truncated: what was written is a cut
    // file (a song that stops short), so it goes, and the page shows why.
    if (data.file.truncated) {
      await fs.unlink(filepath).catch(() => {});
      return reply.code(413).send({ error: uploadTooBig(data.filename) });
    }

    const protocol = request.protocol;
    const host = request.hostname;
    const url = `${protocol}://${host}/uploads/${filename}`;

    return reply.code(200).send({ success: true, url, filename });
  } catch (error) {
    // The body stopped mid-file (connection dropped) or the write failed (disk full): what was written is cut
    request.log.error(error);
    if (filepath) await fs.unlink(filepath).catch(() => {});
    return reply.code(500).send({ error: uploadBroke(name) });
  }
});

// Push hook («Ξεκίνα τώρα», /?push=<id>): start exactly this routine assignment, flow or 'alarm', now.
// It answers triggerAction's result ({ skipped, runningId } when the kid is already in a routine).
// Simulating a minute, every schedule due in it, is POST /api/debug/time.
server.post<{ Body: PushBody }>('/api/hooks/push', { schema: { body: pushBody } }, async (request, reply) => {
  const { id } = request.body;
  logAction('PUSH_HOOK', { id });
  return triggerAction(id, 'push_hook') ?? reply.code(404).send({ error: 'Entity not found' });
});

// What kids do on a running routine or flow (see "ROUTINES AND FLOWS ON SCREEN" in db.ts).
// Each is idempotent, so two devices reporting the same action is harmless.
server.post('/api/executions/:executionId/tasks/:taskId/complete', async (request, reply) => {
  const { executionId, taskId } = request.params as { executionId: string, taskId: string };
  const result = completeTask(executionId, taskId);
  return result.success ? result : reply.code(409).send(result);
});

// A parent's «Τέλος» on /parent sends { by: 'parent' } (#63): the same close, and her lane says so.
server.post<{ Body: CloseBody }>('/api/executions/:executionId/close', {
  schema: { body: closeBody },
  preValidation: async (request) => { request.body ??= {}; }, // no body at all: the kids' close, as before
}, async (request) => {
  const { executionId } = request.params as { executionId: string };
  return { success: closeRoutine(executionId, request.body.by) };
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

server.post<{ Body: TimeBody }>('/api/debug/time', { schema: { body: timeBody } }, async (request, reply) => {
  const { time } = request.body;

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
server.get('/api/admin/data', async (request, reply) => {
  const { value, version } = dataConfig.current();
  reply.header('X-Config-Version', version);
  return value;
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

// Admin: Validate exercises.json against schema
server.post('/api/admin/validate-exercises', async (request, reply) => {
  try {
    const error = check(exercisesSchema, request.body, 'Invalid exercises');
    return error ? { valid: false, errors: error.errors } : { valid: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Validation failed', details: (error as Error).message });
  }
});

// How a screen saves a config file (ConfigSave in db.ts):
// `?replace=1`: replace the file even though it is invalid on disk (the Advanced
// JSON editor only; the invalid file is kept beside). See ConfigFile.save.
// `?version=`: the version it edited (AppState.configVersion, or the GET's
// X-Config-Version); a newer live one makes it a 409 that writes nothing (#33).
// `?source=`: which screen (form, advanced, advanced-fix), for the log; else 'api'.
function configSave(request: { query: unknown }, route: string): ConfigSave {
  const { replace, version, source } = request.query as { replace?: string; version?: string; source?: string };
  return {
    replace: replace === '1',
    version: version || undefined,
    source: CONFIG_SAVE_SOURCES.find(s => s === source) ?? 'api',
    route,
  };
}

/** A refused config save: 409 { error, conflict } when another save came first, else 400 { error }. */
function refusedSave(reply: FastifyReply, error: unknown) {
  return error instanceof ConfigConflict
    ? reply.code(409).send({ error: error.message, conflict: true })
    : reply.code(400).send({ error: (error as Error).message });
}

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
    return { success: true, version: writeRawConfig(request.body, configSave(request, 'POST /api/admin/data')) };
  } catch (error) {
    // Stale (another save came first: logged as CONFIG_SAVE_STALE), refused while data.json on disk
    // is invalid, or the write failed
    if (!(error instanceof ConfigConflict)) request.log.error(error);
    return refusedSave(reply, error);
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
// The document and, in X-Config-Version, the version it is: the one to send back with ?version=
server.get('/api/admin/exercises', async (request, reply) => {
  const { value, version } = exercisesConfig.current();
  reply.header('X-Config-Version', version);
  return value;
});

server.get('/api/admin/exercises/text', async (request, reply) => {
  const text = exercisesConfig.text();
  return text === null ? reply.code(404).send({ error: 'exercises.json not found' }) : { text };
});

server.post('/api/admin/exercises', async (request, reply) => {
  try {
    return { success: true, version: writeRawExercises(request.body, configSave(request, 'POST /api/admin/exercises')) };
  } catch (error) {
    return refusedSave(reply, error);
  }
});

server.post<{ Body: GameBody }>('/api/exercises/sessions', { schema: { body: gameBody } }, async (request, reply) => {
  try {
    const { playerIds, categories, totalRounds, questionsPerRound } = request.body;
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

server.post<{ Params: Id; Body: GameAnswerBody }>('/api/exercises/sessions/:id/answer', { schema: { body: gameAnswerBody } }, async (request, reply) => {
  try {
    const { id } = request.params;
    const { userId, exerciseId, answer } = request.body;
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
server.post<{ Body: UserBody }>('/api/exercise-assignments/extra', { schema: { body: userBody } }, async (request, reply) => {
  try {
    const { userId } = request.body;
    return await startExtraProblem(userId);
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

// Answer an assignment
server.post<{ Params: Id; Body: AnswerBody }>('/api/exercise-assignments/:id/answer', { schema: { body: answerBody } }, async (request, reply) => {
  try {
    const { id } = request.params;
    const { answer } = request.body;
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
server.post<{ Body: HelpSeenBody }>('/api/help/seen', { schema: { body: helpSeenBody } }, async (request, reply) => {
  try {
    markHelpSeen(request.body.tourIds);
    return { ok: true };
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }
});

server.post<{ Body: HelpResetBody }>('/api/help/reset', {
  schema: { body: helpResetBody },
  preValidation: async (request) => { request.body ??= {}; }, // no body at all: every tour, as before
}, async (request) => {
  const { userId } = request.body;
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
