import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_FILE = path.join(process.cwd(), 'data.json');
console.log('Using data file:', DATA_FILE);

interface Db {
  users: any[];
  routines: any[];
  tasks: any[];
  routineTasks: any[];
  routineAssignments: any[];
  flows: any[];
  routineExecutions: any[];
  taskExecutions: any[];
}

async function readDb(): Promise<Db> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty structure or handle error
    console.error("Error reading DB:", error);
    return {
      users: [], routines: [], tasks: [], routineTasks: [], 
      routineAssignments: [], flows: [], routineExecutions: [], taskExecutions: []
    };
  }
}

async function writeDb(data: Db) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
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

  const db = await readDb();

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

  // Not found
  return reply.code(404).send({ error: 'Entity not found' });
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
    const starsToAdd = task.stars; // Use the stars from the task definition
    
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
