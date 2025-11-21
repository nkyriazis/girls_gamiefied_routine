import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
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

// Enable CORS
server.register(cors, {
  origin: true,
});

// Enable WebSocket
server.register(websocket);

// Health check
server.get('/health', async () => {
  return { status: 'ok', time: new Date().toISOString() };
});

// User routes
server.get('/api/users', async () => {
  const users = await prisma.user.findMany({
    include: {
      assignments: {
        include: {
          routine: {
            include: {
              tasks: {
                include: {
                  task: true
                },
                orderBy: {
                  order: 'asc'
                }
              }
            }
          }
        }
      }
    },
  });

  // Transform to match the expected frontend structure
  return users.map(user => ({
    ...user,
    routines: user.assignments.map(assignment => ({
      id: assignment.id, // Use assignment ID as the Routine ID for the frontend
      title: assignment.routine.title,
      scheduleTime: assignment.scheduleTime,
      cronExpression: assignment.cronExpression,
      themeColor: assignment.themeColor || assignment.routine.themeColor,
      icon: assignment.routine.icon,
      tasks: assignment.routine.tasks.map(rt => ({
        id: rt.task.id,
        title: rt.task.title,
        icon: rt.task.icon,
        durationSeconds: rt.durationSeconds,
        routineId: assignment.id
      }))
    })),
    assignments: undefined // Remove the raw assignments from the response
  }));
});

// Flow routes
server.get('/api/flows', async () => {
  const flows = await prisma.flow.findMany();
  return flows.map((flow) => ({
    ...flow,
    steps: JSON.parse(flow.steps),
  }));
});

// Push hook endpoint
server.post('/api/hooks/push', async (request, reply) => {
  const { id } = request.body as { id: string };

  if (!id) {
    return reply.code(400).send({ error: 'Missing id' });
  }

  // Special case: alarm
  if (id === 'alarm') {
    broadcast({ type: 'ALARM_START' });
    return { success: true, type: 'alarm' };
  }

  // Try to find RoutineAssignment
  const assignment = await prisma.routineAssignment.findUnique({
    where: { id },
    include: { routine: true }
  });

  if (assignment) {
    // Create execution record
    const execution = await prisma.routineExecution.create({
      data: {
        userId: assignment.userId,
        routineId: assignment.routineId,
      }
    });

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
  const flow = await prisma.flow.findUnique({
    where: { id }
  });

  if (flow) {
    broadcast({
      type: 'FLOW_START',
      payload: {
        flowId: flow.id,
        steps: JSON.parse(flow.steps)
      }
    });

    return { success: true, type: 'flow', id };
  }

  // Not found
  return reply.code(404).send({ error: 'Entity not found' });
});

// Task completion endpoint
server.post('/api/executions/:executionId/tasks/:taskId/complete', async (request, reply) => {
  const { executionId, taskId } = request.params as { executionId: string, taskId: string };
  const { duration, isOnTime } = request.body as { duration: number, isOnTime: boolean };

  // Get the task to know how many stars it is worth
  const task = await prisma.task.findUnique({
    where: { id: taskId }
  });

  if (!task) {
    return reply.code(404).send({ error: 'Task not found' });
  }

  // Create TaskExecution
  await prisma.taskExecution.create({
    data: {
      executionId,
      taskId,
      duration,
      isOnTime,
      completedAt: new Date()
    }
  });

  // Update User stars
  // First find the execution to get the user
  const execution = await prisma.routineExecution.findUnique({
    where: { id: executionId },
    include: { user: true }
  });

  if (execution) {
    const starsToAdd = task.stars; // Use the stars from the task definition
    
    // Update user
    await prisma.user.update({
      where: { id: execution.userId },
      data: { stars: { increment: starsToAdd } }
    });

    // Update routine execution total stars
    await prisma.routineExecution.update({
      where: { id: executionId },
      data: { totalStars: { increment: starsToAdd } }
    });
    
    // Broadcast update
    broadcast({
      type: 'STARS_AWARDED',
      payload: {
        userId: execution.userId,
        amount: starsToAdd,
        totalStars: execution.user.stars + starsToAdd
      }
    });

    return { success: true, starsAwarded: starsToAdd };
  }

  return { success: false, error: 'Execution not found' };
});

// WebSocket for real-time events
server.register(async (fastify) => {
  fastify.get('/ws', { websocket: true }, (connection: any, req) => {
    fastify.log.info('Client connected via WebSocket');
    wsConnections.add(connection);

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

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
