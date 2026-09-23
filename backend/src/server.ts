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
import { Spending, StarTransfer, StateSnapshot } from '../../shared/types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StreamableHTTPServerTransport } = require('./sdk-proxy');

// Import shared database layer
import {
  store, sync, triggerAction, completeTask, getEnrichedSpendings, getEnrichedTransfers,
  readLastLogs, MAX_LOGS, adjustUserStars, trySpendStars, UPLOADS_DIR, getChoresWithInstances, claimChore,
  attemptChore, confirmChore, rejectChore, readExercises, readExerciseCategories, readRawExercises,
  writeRawExercises, readRawConfig, writeRawConfig, startExerciseSession, submitExerciseAnswer,
  cancelExerciseSession, getExerciseSession, generateChoreInstances, expireChores, cleanupOldChoreInstances,
  logAction, getAvailableBalance, getExerciseAssignments, answerExerciseAssignment, usersView,
  stateSnapshot, replaceState, ensureDailyAssignments
} from './db';
import { config, configError, reloadConfig, watchConfig } from './config';
import { importLegacy } from './migrate';
import { LOGS_FILE, STATE_FILE } from './paths';
import { check, dataSchema, exercisesSchema, stateSchema } from './schemas';

// Import MCP server
import { mcpServer } from './mcp';

const pump = util.promisify(pipeline);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cronParser = require('cron-parser');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DateTime } = require('luxon');

const server = Fastify({ logger: true });

// Initialize MCP Transport (Singleton)
const mcpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless mode for now, or use randomUUID for stateful
  enableJsonResponse: true
});

// Connect MCP server to transport once
mcpServer.connect(mcpTransport).catch((err: any) => {
  console.error('Failed to connect MCP server to transport:', err);
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
      const interval = cronParser.CronExpressionParser.parse(schedule.cron, {
        currentDate: new Date(date.getTime() - 1000),
        tz: timezone
      });
      
      const next = interval.next().toDate();
      const diff = Math.abs(next.getTime() - date.getTime());
      const isMatch = diff < 60000 && next.getMinutes() === date.getMinutes();

      if (isMatch) {
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

// User routes: users with their star balance and their assigned routines
server.get('/api/users', async () => usersView());

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

// Spendings routes
server.get('/api/spendings', async (request, reply) => {
  try {
    return getEnrichedSpendings();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

server.post('/api/spendings', async (request, reply) => {
  const { userId, rewardId } = request.body as { userId: string, rewardId: string };
  
  const user = config().users.find(u => u.id === userId);
  const reward = config().rewards.find(r => r.id === rewardId);

  if (!user || !reward) {
    return reply.code(404).send({ error: 'User or Reward not found' });
  }

  const spending: Spending = {
    id: randomUUID(),
    userId,
    rewardId,
    cost: reward.cost,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  // Deduction and record are one transaction: stars can't vanish without a spending.
  const newBalance = store.transaction(() => {
    const balance = trySpendStars(userId, reward.cost);
    if (balance !== null) store.spendings.put(spending);
    return balance;
  });
  if (newBalance === null) {
    return reply.code(400).send({ error: 'Not enough stars' });
  }
  logAction('SPEND_STARS', { userId, rewardId, cost: reward.cost, newBalance });

  return spending;
});

server.put('/api/spendings/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { status } = request.body as { status: 'pending' | 'done' | 'revoked' };

  const spending = store.spendings.get(id);

  if (!spending) {
    return reply.code(404).send({ error: 'Spending not found' });
  }

  const updated = { ...spending, status };
  store.transaction(() => {
    // Revoking refunds the stars
    if (status === 'revoked' && spending.status !== 'revoked' && config().users.some(u => u.id === spending.userId)) {
      adjustUserStars(spending.userId, spending.cost);
    }
    store.spendings.put(updated);
  });

  return updated;
});

// Star Transfers routes
server.get('/api/transfers', async (request, reply) => {
  try {
    return getEnrichedTransfers();
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

server.post('/api/transfers', async (request, reply) => {
  const { fromUserId, toUserId, amount } = request.body as { fromUserId: string, toUserId: string, amount: number };
  
  const fromUser = config().users.find(u => u.id === fromUserId);
  const toUser = config().users.find(u => u.id === toUserId);

  if (!fromUser || !toUser) {
    return reply.code(404).send({ error: 'User not found' });
  }

  if (fromUserId === toUserId) {
    return reply.code(400).send({ error: 'Cannot transfer stars to yourself' });
  }

  if (amount <= 0) {
    return reply.code(400).send({ error: 'Amount must be positive' });
  }

  // Check available balance (total - pending outgoing transfers)
  const availableBalance = getAvailableBalance(fromUserId);
  if (availableBalance < amount) {
    return reply.code(400).send({ error: 'Not enough available stars', availableBalance });
  }

  const transfer: StarTransfer = {
    id: randomUUID(),
    fromUserId,
    toUserId,
    amount,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  store.starTransfers.put(transfer);

  logAction('TRANSFER_REQUEST', { fromUserId, toUserId, amount, transferId: transfer.id });

  return transfer;
});

server.put('/api/transfers/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { action } = request.body as { action: 'approve' | 'reject' | 'cancel' };

  const transfer = store.starTransfers.get(id);

  if (!transfer) {
    return reply.code(404).send({ error: 'Transfer not found' });
  }

  if (transfer.status !== 'pending') {
    return reply.code(400).send({ error: 'Transfer is already resolved' });
  }

  const users = config().users;
  if (!users.some(u => u.id === transfer.fromUserId) || !users.some(u => u.id === transfer.toUserId)) {
    return reply.code(404).send({ error: 'User not found' });
  }

  // Reject/cancel: stars stay with the sender (they were locked, now unlocked)
  const outcomes = { approve: 'approved', reject: 'rejected', cancel: 'cancelled' } as const;
  const status = outcomes[action];
  if (!status) {
    return reply.code(400).send({ error: 'Invalid action' });
  }

  const resolved: StarTransfer = { ...transfer, status, resolvedAt: new Date().toISOString() };
  store.transaction(() => {
    if (status === 'approved') {
      // Deduct from sender and add to receiver
      adjustUserStars(transfer.fromUserId, -transfer.amount);
      adjustUserStars(transfer.toUserId, transfer.amount);
    }
    store.starTransfers.put(resolved);
  });
  logAction(`TRANSFER_${status.toUpperCase()}`, { transferId: id, fromUserId: transfer.fromUserId, toUserId: transfer.toUserId, amount: transfer.amount });

  return resolved;
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
      const interval = cronParser.CronExpressionParser.parse(schedule.cron, {
        tz: timezone
      });
      const nextTime = interval.next().toDate();
      
      request.log.info(`[Hook] Found schedule for ${id}: ${schedule.cron}. Simulating time: ${nextTime.toISOString()}`);
      
      await checkSchedules(nextTime);
      
      return { success: true, type: 'schedule_simulation', simulatedTime: nextTime, targetId: id };
    }

    if (id === 'alarm') {
      sync.notify({ type: 'ALARM_START' });
      logAction('ALARM_MANUAL', { source: 'push' });
      return { success: true, type: 'alarm' };
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

// Task completion endpoint
server.post('/api/executions/:executionId/tasks/:taskId/complete', async (request, reply) => {
  const { executionId, taskId } = request.params as { executionId: string, taskId: string };
  const { duration, isOnTime } = request.body as { duration: number, isOnTime: boolean };

  const result = completeTask(executionId, taskId, duration, isOnTime);
  if (!result) {
    return reply.code(404).send({ error: 'Task not found' });
  }
  return result;
});

// Debug endpoint to simulate time
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
      const interval = cronParser.CronExpressionParser.parse(s.cron, {
        currentDate: now,
        tz: timezone
      });
      const next = interval.next().toDate();
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

// Admin: Update data.json
server.post('/api/admin/data', async (request, reply) => {
  try {
    const error = check(dataSchema, request.body, 'Validation failed');
    if (error) {
      return reply.code(400).send({ error: error.message, errors: error.errors });
    }
    writeRawConfig(request.body);
    return { success: true };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Failed to save data file' });
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

server.post('/api/admin/exercises', async (request, reply) => {
  try {
    writeRawExercises(request.body);
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
    cancelExerciseSession(id);
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

// ============================================================================
// MCP Endpoint - Streamable HTTP Transport
// ============================================================================
const handleMcpRequest = async (request: any, reply: any) => {
  // Authentication disabled as requested
  /*
  const apiKey = process.env.MCP_API_KEY;
  if (apiKey) {
    // ... auth logic removed ...
  }
  */

  try {
    // Adapt Fastify request/reply to the transport's expected interface
    // We need to strip the /mcp prefix so the transport sees /sse or /messages
    // if the transport relies on path checking.
    // However, StreamableHTTPServerTransport usually just handles the request based on method/headers.
    
    // Note: If using /mcp/sse, we might need to ensure the transport knows how to handle it.
    // But typically, for a single endpoint setup, we just point to it.
    
    await mcpTransport.handleRequest(
      request.raw as any,
      reply.raw as any,
      request.body as any
    );

    // Don't send a response - the transport handles it
    return reply;
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error'
      },
      id: null
    });
  }
};

// Fastify treats wildcard routes differently depending on placement, so register
// both the root and nested paths to ensure /mcp and /mcp/* (e.g. /mcp/sse) work.
server.all('/mcp', handleMcpRequest);
server.all('/mcp/*', handleMcpRequest);

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

const start = async () => {
  try {
    // First start on a database: import the legacy JSON files (read-only).
    const legacy = importLegacy(store, { stateFile: STATE_FILE, logsFile: LOGS_FILE });
    console.log(legacy.imported
      ? `Imported legacy ${STATE_FILE} and ${LOGS_FILE} into the database`
      : `Legacy files already imported at ${legacy.importedAt}`);

    const change = reloadConfig();
    if (change?.type === 'invalid') {
      console.error('Config is invalid; running with an empty config until it is fixed:', change.error);
    }
    watchConfig(change => {
      if (change.type === 'updated') {
        console.log('Config changed on disk; reloaded');
      } else {
        console.error('Config changed on disk but is invalid; keeping the last valid config:', change.error);
      }
      sync.changed(); // clients get the new config, or the error
    });
    
    // Start the real scheduler (checks every minute)
    cron.schedule('* * * * *', () => {
      checkSchedules(new Date());
    });
    console.log('Scheduler started');
    console.log('MCP endpoint available at POST /mcp');

    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
