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
import { Spending, StarTransfer } from '../../shared/types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StreamableHTTPServerTransport } = require('./sdk-proxy');

// Import shared database layer
import {
  DATA_FILE,
  UPLOADS_DIR,
  MAX_LOGS,
  logAction,
  loadSchema,
  loadState,
  readDb,
  writeDb,
  globalState,
  wsConnections,
  broadcast,
  triggerAction,
  getEnrichedSpendings,
  getEnrichedTransfers,
  getAvailableBalance,
  readLastLogs,
  flushPendingSave,
  scheduleSave,
  validateConfig,
  validateState,
  lastConfigError,
  lastStateError,
  setLastConfigError,
  setLastStateError,
  generateChoreInstances,
  expireChores,
  cleanupOldChoreInstances,
  getChoresWithInstances,
  claimChore,
  attemptChore,
  confirmChore,
  rejectChore,
  broadcastChoreState,
  getExercises,
  startExercise,
  submitExercise,
  abandonExercise
} from './db';

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
  const db = await readDb();
  const timezone = db.settings?.timezone || 'Europe/Athens';
  
  const localTime = DateTime.fromJSDate(date).setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss');
  console.log(`Checking schedules for: ${localTime} (${timezone})`);
  
  // Check regular schedules (flows, routines)
  for (const schedule of db.schedules) {
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
        await triggerAction(schedule.targetId, db, `schedule:${schedule.id}`);
      }
    } catch (err) {
      console.error(`Error checking schedule ${schedule.id}:`, err);
      logAction('SCHEDULE_ERROR', { scheduleId: schedule.id, error: (err as Error).message });
    }
  }
  
  // Generate new chore instances based on their cron schedules
  try {
    const newInstances = await generateChoreInstances();
    if (newInstances.length > 0) {
      console.log(`Generated ${newInstances.length} new chore instance(s)`);
    }
  } catch (err) {
    console.error('Error generating chore instances:', err);
    logAction('CHORE_GENERATION_ERROR', { error: (err as Error).message });
  }
  
  // Expire overdue chores
  try {
    const { expired, notified } = await expireChores();
    if (expired.length > 0) {
      console.log(`Expired ${expired.length} chore(s), notified ${notified.length} user(s)`);
    }
  } catch (err) {
    console.error('Error expiring chores:', err);
    logAction('CHORE_EXPIRATION_ERROR', { error: (err as Error).message });
  }
  
  // Cleanup old instances once per hour (at minute 0)
  if (new Date().getMinutes() === 0) {
    try {
      const removed = await cleanupOldChoreInstances();
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

// User routes
server.get('/api/users', async (request, reply) => {
  try {
    const db = await readDb();
    
    const users = db.users.map((user: any) => {
      const assignments = db.routineAssignments
        .filter((a: any) => a.userId === user.id)
        .map((assignment: any) => {
          const routine = db.routines.find((r: any) => r.id === assignment.routineId);
          if (!routine) return null;

          let cronExpression = null;
          
          const directSchedule = db.schedules.find((s: any) => s.type === 'routine' && s.targetId === assignment.id);
          if (directSchedule) {
            cronExpression = directSchedule.cron;
          } else {
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
              return { ...rt, task };
            });

          return {
            ...assignment,
            cronExpression,
            scheduleTime: cronExpression ? simpleCronToTime(cronExpression) : null,
            routine: { ...routine, tasks: routineTasks }
          };
        })
        .filter((a: any) => a !== null);

      return { ...user, assignments };
    });

    return users.map((user: any) => ({
      ...user,
      routines: user.assignments.map((assignment: any) => ({
        id: assignment.id,
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
      assignments: undefined
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
    return db.flows;
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

// Chores routes
server.get('/api/chores', async (request, reply) => {
  try {
    const { userId } = request.query as { userId?: string };
    const { chores, instances } = await getChoresWithInstances(userId);
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
    
    const instance = await claimChore(instanceId, userId);
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
    
    const instance = await attemptChore(instanceId);
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
    
    const instance = await confirmChore(instanceId, stars);
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
    
    const instance = await rejectChore(instanceId);
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

// Exercises routes
server.get('/api/exercises', async (request, reply) => {
  try {
    const { userId } = request.query as { userId?: string };
    const { exercises, instances } = await getExercises(userId);
    return { exercises, instances };
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

server.post('/api/exercises/:exerciseId/start', async (request, reply) => {
  try {
    const { exerciseId } = request.params as { exerciseId: string };
    const { userId } = request.body as { userId: string };
    
    if (!userId) {
      return reply.code(400).send({ error: 'userId is required' });
    }
    
    const instance = await startExercise(exerciseId, userId);
    return instance;
  } catch (error) {
    request.log.error(error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return reply.code(404).send({ error: message });
    }
    if (message.includes('not eligible')) {
      return reply.code(400).send({ error: message });
    }
    return reply.code(500).send({ error: 'Internal Server Error', details: message });
  }
});

server.post('/api/exercises/:instanceId/submit', async (request, reply) => {
  try {
    const { instanceId } = request.params as { instanceId: string };
    const { answer } = request.body as { answer: any };
    
    const result = await submitExercise(instanceId, answer);
    return result;
  } catch (error) {
    request.log.error(error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return reply.code(404).send({ error: message });
    }
    if (message.includes('not active')) {
      return reply.code(400).send({ error: message });
    }
    return reply.code(500).send({ error: 'Internal Server Error', details: message });
  }
});

server.post('/api/exercises/:instanceId/abandon', async (request, reply) => {
  try {
    const { instanceId } = request.params as { instanceId: string };
    
    const instance = await abandonExercise(instanceId);
    return instance;
  } catch (error) {
    request.log.error(error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return reply.code(404).send({ error: message });
    }
    if (message.includes('not active')) {
      return reply.code(400).send({ error: message });
    }
    return reply.code(500).send({ error: 'Internal Server Error', details: message });
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

  user.stars -= reward.cost;
  logAction('SPEND_STARS', { userId, rewardId, cost: reward.cost, newBalance: user.stars });

  const spending: Spending = {
    id: randomUUID(),
    userId,
    rewardId,
    cost: reward.cost,
    createdAt: new Date().toISOString(),
    status: 'pending'
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

// Star Transfers routes
server.get('/api/transfers', async (request, reply) => {
  try {
    const enriched = await getEnrichedTransfers();
    return enriched;
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({ error: 'Internal Server Error', details: (error as Error).message });
  }
});

server.post('/api/transfers', async (request, reply) => {
  const { fromUserId, toUserId, amount } = request.body as { fromUserId: string, toUserId: string, amount: number };
  
  const db = await readDb();
  const fromUser = db.users.find(u => u.id === fromUserId);
  const toUser = db.users.find(u => u.id === toUserId);

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

  db.starTransfers.push(transfer);
  await writeDb(db);

  logAction('TRANSFER_REQUEST', { fromUserId, toUserId, amount, transferId: transfer.id });

  const enrichedTransfers = await getEnrichedTransfers();

  broadcast({
    type: 'SYNC_STATE',
    payload: {
      userStars: globalState.userStars,
      spendings: await getEnrichedSpendings(),
      starTransfers: enrichedTransfers
    }
  });

  return transfer;
});

server.put('/api/transfers/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { action } = request.body as { action: 'approve' | 'reject' | 'cancel' };

  const db = await readDb();
  const transfer = db.starTransfers.find(t => t.id === id);

  if (!transfer) {
    return reply.code(404).send({ error: 'Transfer not found' });
  }

  if (transfer.status !== 'pending') {
    return reply.code(400).send({ error: 'Transfer is already resolved' });
  }

  const fromUser = db.users.find(u => u.id === transfer.fromUserId);
  const toUser = db.users.find(u => u.id === transfer.toUserId);

  if (!fromUser || !toUser) {
    return reply.code(404).send({ error: 'User not found' });
  }

  if (action === 'approve') {
    // Deduct from sender and add to receiver
    fromUser.stars -= transfer.amount;
    toUser.stars += transfer.amount;
    transfer.status = 'approved';
    logAction('TRANSFER_APPROVED', { transferId: id, fromUserId: transfer.fromUserId, toUserId: transfer.toUserId, amount: transfer.amount });
  } else if (action === 'reject') {
    // Stars stay with sender (they were locked, now unlocked)
    transfer.status = 'rejected';
    logAction('TRANSFER_REJECTED', { transferId: id, fromUserId: transfer.fromUserId, toUserId: transfer.toUserId, amount: transfer.amount });
  } else if (action === 'cancel') {
    // Stars stay with sender (they were locked, now unlocked)
    transfer.status = 'cancelled';
    logAction('TRANSFER_CANCELLED', { transferId: id, fromUserId: transfer.fromUserId, toUserId: transfer.toUserId, amount: transfer.amount });
  } else {
    return reply.code(400).send({ error: 'Invalid action' });
  }

  transfer.resolvedAt = new Date().toISOString();
  await writeDb(db);

  const enrichedTransfers = await getEnrichedTransfers();

  broadcast({
    type: 'SYNC_STATE',
    payload: {
      userStars: globalState.userStars,
      spendings: await getEnrichedSpendings(),
      starTransfers: enrichedTransfers
    }
  });

  return transfer;
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

    const db = await readDb();

    const schedule = db.schedules.find(s => s.targetId === id);

    if (schedule) {
      const timezone = db.settings?.timezone || 'Europe/Athens';
      const interval = cronParser.CronExpressionParser.parse(schedule.cron, {
        tz: timezone
      });
      const nextTime = interval.next().toDate();
      
      request.log.info(`[Hook] Found schedule for ${id}: ${schedule.cron}. Simulating time: ${nextTime.toISOString()}`);
      
      await checkSchedules(nextTime);
      
      return { success: true, type: 'schedule_simulation', simulatedTime: nextTime, targetId: id };
    }

    if (id === 'alarm') {
      broadcast({ type: 'ALARM_START' });
      logAction('ALARM_MANUAL', { source: 'push' });
      return { success: true, type: 'alarm' };
    }

    const result = await triggerAction(id, db, 'push_hook');

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

  const db = await readDb();
  const task = db.tasks.find(t => t.id === taskId);

  if (!task) {
    return reply.code(404).send({ error: 'Task not found' });
  }

  db.taskExecutions.push({
    id: randomUUID(),
    executionId,
    taskId,
    duration,
    isOnTime,
    completedAt: new Date().toISOString()
  });

  const execution = db.routineExecutions.find(e => e.id === executionId);

  if (execution) {
    const starsToAdd = isOnTime ? (task.stars || 0) : (task.lateStars ?? 0);
    
    const user = db.users.find(u => u.id === execution.userId);
    if (user) {
      user.stars = (user.stars || 0) + starsToAdd;
    }

    execution.totalStars = (execution.totalStars || 0) + starsToAdd;
    
    await writeDb(db);
    
    logAction('TASK_COMPLETE', { executionId, taskId, starsAwarded: starsToAdd, userId: execution.userId });

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
  const db = await readDb();
  const timezone = db.settings?.timezone || 'Europe/Athens';
  const now = new Date();
  
  const localTime = DateTime.fromJSDate(now).setZone(timezone).toFormat('yyyy-MM-dd HH:mm:ss');
  
  const schedules = db.schedules.map((s: any) => {
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
    
    setLastConfigError(null);
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

// Admin: Get action logs
server.get('/api/debug/logs', async (request, reply) => {
  return readLastLogs(MAX_LOGS);
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

// Admin: Get raw state
server.get('/api/admin/state', async (request, reply) => {
  return globalState;
});

// Admin: Update state
server.post('/api/admin/state', async (request, reply) => {
  try {
    const newState = request.body as any;
    
    if (validateState) {
      const valid = validateState(newState);
      if (!valid) {
        return reply.code(400).send({ 
          error: 'State validation failed', 
          errors: validateState.errors 
        });
      }
    }
    
    // Update global state
    globalState.userStars = newState.userStars || {};
    globalState.routineExecutions = newState.routineExecutions || [];
    globalState.taskExecutions = newState.taskExecutions || [];
    globalState.spendings = newState.spendings || [];
    globalState.starTransfers = newState.starTransfers || [];
    globalState.choreInstances = newState.choreInstances || [];
    
    scheduleSave();
    
    setLastStateError(null);
    const enrichedSpendings = await getEnrichedSpendings();
    const enrichedTransfers = await getEnrichedTransfers();
    const { instances: choreInstances } = await getChoresWithInstances();

    broadcast({
      type: 'SYNC_STATE',
      payload: {
        userStars: globalState.userStars,
        spendings: enrichedSpendings,
        starTransfers: enrichedTransfers,
        choreInstances
      }
    });
    
    return { success: true };
  } catch (error) {
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
  fastify.get('/ws', { websocket: true }, async (connection: any, req) => {
    fastify.log.info('Client connected via WebSocket');
    wsConnections.add(connection);

    const enrichedSpendings = await getEnrichedSpendings();
    const enrichedTransfers = await getEnrichedTransfers();
    const { instances: choreInstances } = await getChoresWithInstances();

    connection.send(JSON.stringify({
      type: 'SYNC_STATE',
      payload: {
        userStars: globalState.userStars,
        spendings: enrichedSpendings,
        starTransfers: enrichedTransfers,
        choreInstances
      }
    }));

    connection.on('message', (message: any) => {
      const data = JSON.parse(message.toString());
      fastify.log.info({ msg: 'Received', data });
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
  await flushPendingSave();
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
    console.log('MCP endpoint available at POST /mcp');

    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
