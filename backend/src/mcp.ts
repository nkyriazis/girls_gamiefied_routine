import type { McpServer as McpServerType, ResourceTemplate as ResourceTemplateType } from '@modelcontextprotocol/sdk/server/mcp';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { McpServer, ResourceTemplate } = require('./sdk-proxy') as { McpServer: typeof McpServerType, ResourceTemplate: typeof ResourceTemplateType };
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  readDb,
  readRawConfig,
  writeRawConfig,
  globalState,
  triggerAction,
  broadcast,
  getEnrichedSpendings,
  awardStars,
  setUserStars,
  UPLOADS_DIR,
  SCHEMA_FILE,
  STATE_SCHEMA_FILE,
  logAction
} from './db';

// Create MCP server instance
export const mcpServer = new McpServer({
  name: 'routine-server',
  version: '1.0.0'
});

// ============================================================================
// RESOURCES - Static/browsable content
// ============================================================================

// List uploaded files
mcpServer.registerResource(
  'uploads-list',
  'uploads://list',
  {
    title: 'Uploaded Files List',
    description: 'List of all uploaded files (images, audio)',
    mimeType: 'application/json'
  },
  async (uri) => {
    try {
      const files = await fs.readdir(UPLOADS_DIR);
      const filtered = files.filter(f => !f.startsWith('.'));
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(filtered, null, 2)
        }]
      };
    } catch {
      return {
        contents: [{
          uri: uri.href,
          text: '[]'
        }]
      };
    }
  }
);

// Get specific uploaded file (base64)
mcpServer.registerResource(
  'upload-file',
  new ResourceTemplate('uploads://{filename}', { list: undefined }),
  {
    title: 'Uploaded File',
    description: 'Get an uploaded file content (base64 encoded)'
  },
  async (uri, { filename }) => {
    const filePath = path.join(UPLOADS_DIR, filename as string);
    try {
      const content = await fs.readFile(filePath);
      const base64 = content.toString('base64');
      const ext = path.extname(filename as string).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg'
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      return {
        contents: [{
          uri: uri.href,
          text: `data:${mimeType};base64,${base64}`
        }]
      };
    } catch {
      return {
        contents: [{
          uri: uri.href,
          text: 'File not found'
        }]
      };
    }
  }
);

// Data schema
mcpServer.registerResource(
  'data-schema',
  'schema://data',
  {
    title: 'Data Schema',
    description: 'JSON Schema for data.json configuration',
    mimeType: 'application/json'
  },
  async (uri) => {
    try {
      const schema = await fs.readFile(SCHEMA_FILE, 'utf-8');
      return {
        contents: [{
          uri: uri.href,
          text: schema
        }]
      };
    } catch {
      return {
        contents: [{
          uri: uri.href,
          text: '{}'
        }]
      };
    }
  }
);

// State schema
mcpServer.registerResource(
  'state-schema',
  'schema://state',
  {
    title: 'State Schema',
    description: 'JSON Schema for state.json',
    mimeType: 'application/json'
  },
  async (uri) => {
    try {
      const schema = await fs.readFile(STATE_SCHEMA_FILE, 'utf-8');
      return {
        contents: [{
          uri: uri.href,
          text: schema
        }]
      };
    } catch {
      return {
        contents: [{
          uri: uri.href,
          text: '{}'
        }]
      };
    }
  }
);

// ============================================================================
// READ TOOLS - Query data
// ============================================================================

// Get full config
mcpServer.registerTool(
  'get_config',
  {
    title: 'Get Configuration',
    description: 'Get the full data.json configuration including users, tasks, routines, rewards, schedules, flows',
    inputSchema: {},
    outputSchema: { config: z.any() }
  },
  async () => {
    const config = await readRawConfig();
    return {
      content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
      structuredContent: { config }
    };
  }
);

// Get full state
mcpServer.registerTool(
  'get_state',
  {
    title: 'Get State',
    description: 'Get the full runtime state including user stars, routine executions, task executions, and spendings',
    inputSchema: {},
    outputSchema: { state: z.any() }
  },
  async () => {
    return {
      content: [{ type: 'text', text: JSON.stringify(globalState, null, 2) }],
      structuredContent: { state: globalState }
    };
  }
);

// Get users
mcpServer.registerTool(
  'get_users',
  {
    title: 'Get Users',
    description: 'Get all users with their current star balances',
    inputSchema: {},
    outputSchema: { users: z.array(z.any()) }
  },
  async () => {
    const db = await readDb();
    return {
      content: [{ type: 'text', text: JSON.stringify(db.users, null, 2) }],
      structuredContent: { users: db.users }
    };
  }
);

// Get single user
mcpServer.registerTool(
  'get_user',
  {
    title: 'Get User',
    description: 'Get a single user by ID',
    inputSchema: { id: z.string().describe('User ID') },
    outputSchema: { user: z.any().nullable() }
  },
  async ({ id }) => {
    const db = await readDb();
    const user = db.users.find(u => u.id === id) || null;
    return {
      content: [{ type: 'text', text: JSON.stringify(user, null, 2) }],
      structuredContent: { user }
    };
  }
);

// Get user stars
mcpServer.registerTool(
  'get_user_stars',
  {
    title: 'Get User Stars',
    description: 'Get the star balance for a specific user',
    inputSchema: { userId: z.string().describe('User ID') },
    outputSchema: { userId: z.string(), stars: z.number() }
  },
  async ({ userId }) => {
    const stars = globalState.userStars[userId] || 0;
    return {
      content: [{ type: 'text', text: `User ${userId} has ${stars} stars` }],
      structuredContent: { userId, stars }
    };
  }
);

// Get tasks
mcpServer.registerTool(
  'get_tasks',
  {
    title: 'Get Tasks',
    description: 'Get all task definitions',
    inputSchema: {},
    outputSchema: { tasks: z.array(z.any()) }
  },
  async () => {
    const config = await readRawConfig();
    return {
      content: [{ type: 'text', text: JSON.stringify(config.tasks || [], null, 2) }],
      structuredContent: { tasks: config.tasks || [] }
    };
  }
);

// Get single task
mcpServer.registerTool(
  'get_task',
  {
    title: 'Get Task',
    description: 'Get a single task by ID',
    inputSchema: { id: z.string().describe('Task ID') },
    outputSchema: { task: z.any().nullable() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const task = (config.tasks || []).find((t: any) => t.id === id) || null;
    return {
      content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      structuredContent: { task }
    };
  }
);

// Get routines
mcpServer.registerTool(
  'get_routines',
  {
    title: 'Get Routines',
    description: 'Get all routine definitions',
    inputSchema: {},
    outputSchema: { routines: z.array(z.any()) }
  },
  async () => {
    const config = await readRawConfig();
    return {
      content: [{ type: 'text', text: JSON.stringify(config.routines || [], null, 2) }],
      structuredContent: { routines: config.routines || [] }
    };
  }
);

// Get single routine
mcpServer.registerTool(
  'get_routine',
  {
    title: 'Get Routine',
    description: 'Get a single routine by ID',
    inputSchema: { id: z.string().describe('Routine ID') },
    outputSchema: { routine: z.any().nullable() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const routine = (config.routines || []).find((r: any) => r.id === id) || null;
    return {
      content: [{ type: 'text', text: JSON.stringify(routine, null, 2) }],
      structuredContent: { routine }
    };
  }
);

// Get rewards
mcpServer.registerTool(
  'get_rewards',
  {
    title: 'Get Rewards',
    description: 'Get all reward definitions',
    inputSchema: {},
    outputSchema: { rewards: z.array(z.any()) }
  },
  async () => {
    const config = await readRawConfig();
    return {
      content: [{ type: 'text', text: JSON.stringify(config.rewards || [], null, 2) }],
      structuredContent: { rewards: config.rewards || [] }
    };
  }
);

// Get single reward
mcpServer.registerTool(
  'get_reward',
  {
    title: 'Get Reward',
    description: 'Get a single reward by ID',
    inputSchema: { id: z.string().describe('Reward ID') },
    outputSchema: { reward: z.any().nullable() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const reward = (config.rewards || []).find((r: any) => r.id === id) || null;
    return {
      content: [{ type: 'text', text: JSON.stringify(reward, null, 2) }],
      structuredContent: { reward }
    };
  }
);

// Get schedules
mcpServer.registerTool(
  'get_schedules',
  {
    title: 'Get Schedules',
    description: 'Get all schedule definitions (cron-based triggers)',
    inputSchema: {},
    outputSchema: { schedules: z.array(z.any()) }
  },
  async () => {
    const config = await readRawConfig();
    return {
      content: [{ type: 'text', text: JSON.stringify(config.schedules || [], null, 2) }],
      structuredContent: { schedules: config.schedules || [] }
    };
  }
);

// Get single schedule
mcpServer.registerTool(
  'get_schedule',
  {
    title: 'Get Schedule',
    description: 'Get a single schedule by ID',
    inputSchema: { id: z.string().describe('Schedule ID') },
    outputSchema: { schedule: z.any().nullable() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const schedule = (config.schedules || []).find((s: any) => s.id === id) || null;
    return {
      content: [{ type: 'text', text: JSON.stringify(schedule, null, 2) }],
      structuredContent: { schedule }
    };
  }
);

// Get flows
mcpServer.registerTool(
  'get_flows',
  {
    title: 'Get Flows',
    description: 'Get all flow definitions (multi-step sequences)',
    inputSchema: {},
    outputSchema: { flows: z.array(z.any()) }
  },
  async () => {
    const config = await readRawConfig();
    return {
      content: [{ type: 'text', text: JSON.stringify(config.flows || [], null, 2) }],
      structuredContent: { flows: config.flows || [] }
    };
  }
);

// Get single flow
mcpServer.registerTool(
  'get_flow',
  {
    title: 'Get Flow',
    description: 'Get a single flow by ID',
    inputSchema: { id: z.string().describe('Flow ID') },
    outputSchema: { flow: z.any().nullable() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const flow = (config.flows || []).find((f: any) => f.id === id) || null;
    return {
      content: [{ type: 'text', text: JSON.stringify(flow, null, 2) }],
      structuredContent: { flow }
    };
  }
);

// Get routine assignments
mcpServer.registerTool(
  'get_routine_assignments',
  {
    title: 'Get Routine Assignments',
    description: 'Get all routine assignments (user-specific routine instances)',
    inputSchema: {},
    outputSchema: { routineAssignments: z.array(z.any()) }
  },
  async () => {
    const config = await readRawConfig();
    return {
      content: [{ type: 'text', text: JSON.stringify(config.routineAssignments || [], null, 2) }],
      structuredContent: { routineAssignments: config.routineAssignments || [] }
    };
  }
);

// Get single routine assignment
mcpServer.registerTool(
  'get_routine_assignment',
  {
    title: 'Get Routine Assignment',
    description: 'Get a single routine assignment by ID',
    inputSchema: { id: z.string().describe('Routine Assignment ID') },
    outputSchema: { routineAssignment: z.any().nullable() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const assignment = (config.routineAssignments || []).find((ra: any) => ra.id === id) || null;
    return {
      content: [{ type: 'text', text: JSON.stringify(assignment, null, 2) }],
      structuredContent: { routineAssignment: assignment }
    };
  }
);

// Get spendings
mcpServer.registerTool(
  'get_spendings',
  {
    title: 'Get Spendings',
    description: 'Get reward redemption history, optionally filtered by status',
    inputSchema: { 
      status: z.enum(['pending', 'done', 'revoked']).optional().describe('Filter by status')
    },
    outputSchema: { spendings: z.array(z.any()) }
  },
  async ({ status }) => {
    const spendings = await getEnrichedSpendings();
    const filtered = status 
      ? spendings.filter((s: any) => s.status === status)
      : spendings;
    return {
      content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
      structuredContent: { spendings: filtered }
    };
  }
);

// ============================================================================
// WRITE TOOLS - Mutations
// ============================================================================

// Add task
mcpServer.registerTool(
  'add_task',
  {
    title: 'Add Task',
    description: 'Add a new task definition',
    inputSchema: {
      id: z.string().describe('Unique task ID'),
      title: z.string().describe('Task title'),
      icon: z.any().describe('Icon object with type and value'),
      stars: z.number().describe('Stars awarded for completion'),
      lateStars: z.number().optional().describe('Stars awarded if completed late (default 0)')
    },
    outputSchema: { success: z.boolean(), task: z.any() }
  },
  async ({ id, title, icon, stars, lateStars }) => {
    const config = await readRawConfig();
    const task = { id, title, icon, stars, lateStars: lateStars ?? 0 };
    config.tasks = config.tasks || [];
    config.tasks.push(task);
    await writeRawConfig(config);
    logAction('MCP_ADD_TASK', { task });
    return {
      content: [{ type: 'text', text: `Task "${title}" added successfully` }],
      structuredContent: { success: true, task }
    };
  }
);

// Update task
mcpServer.registerTool(
  'update_task',
  {
    title: 'Update Task',
    description: 'Update an existing task',
    inputSchema: {
      id: z.string().describe('Task ID to update'),
      title: z.string().optional().describe('New title'),
      icon: z.any().optional().describe('New icon'),
      stars: z.number().optional().describe('New stars value'),
      lateStars: z.number().optional().describe('New late stars value')
    },
    outputSchema: { success: z.boolean(), task: z.any().nullable() }
  },
  async ({ id, title, icon, stars, lateStars }) => {
    const config = await readRawConfig();
    const taskIndex = (config.tasks || []).findIndex((t: any) => t.id === id);
    if (taskIndex === -1) {
      return {
        content: [{ type: 'text', text: `Task "${id}" not found` }],
        structuredContent: { success: false, task: null }
      };
    }
    if (title !== undefined) config.tasks[taskIndex].title = title;
    if (icon !== undefined) config.tasks[taskIndex].icon = icon;
    if (stars !== undefined) config.tasks[taskIndex].stars = stars;
    if (lateStars !== undefined) config.tasks[taskIndex].lateStars = lateStars;
    await writeRawConfig(config);
    logAction('MCP_UPDATE_TASK', { id, updates: { title, icon, stars, lateStars } });
    return {
      content: [{ type: 'text', text: `Task "${id}" updated successfully` }],
      structuredContent: { success: true, task: config.tasks[taskIndex] }
    };
  }
);

// Delete task
mcpServer.registerTool(
  'delete_task',
  {
    title: 'Delete Task',
    description: 'Delete a task by ID',
    inputSchema: { id: z.string().describe('Task ID to delete') },
    outputSchema: { success: z.boolean() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const initialLength = (config.tasks || []).length;
    config.tasks = (config.tasks || []).filter((t: any) => t.id !== id);
    if (config.tasks.length === initialLength) {
      return {
        content: [{ type: 'text', text: `Task "${id}" not found` }],
        structuredContent: { success: false }
      };
    }
    await writeRawConfig(config);
    logAction('MCP_DELETE_TASK', { id });
    return {
      content: [{ type: 'text', text: `Task "${id}" deleted successfully` }],
      structuredContent: { success: true }
    };
  }
);

// Add user
mcpServer.registerTool(
  'add_user',
  {
    title: 'Add User',
    description: 'Add a new user',
    inputSchema: {
      id: z.string().describe('Unique user ID'),
      name: z.string().describe('User display name'),
      avatar: z.any().describe('Avatar icon object'),
      color: z.string().optional().describe('Theme color')
    },
    outputSchema: { success: z.boolean(), user: z.any() }
  },
  async ({ id, name, avatar, color }) => {
    const config = await readRawConfig();
    const user = { id, name, avatar, color };
    config.users = config.users || [];
    config.users.push(user);
    await writeRawConfig(config);
    logAction('MCP_ADD_USER', { user });
    return {
      content: [{ type: 'text', text: `User "${name}" added successfully` }],
      structuredContent: { success: true, user }
    };
  }
);

// Update user
mcpServer.registerTool(
  'update_user',
  {
    title: 'Update User',
    description: 'Update an existing user',
    inputSchema: {
      id: z.string().describe('User ID to update'),
      name: z.string().optional().describe('New name'),
      avatar: z.any().optional().describe('New avatar'),
      color: z.string().optional().describe('New color')
    },
    outputSchema: { success: z.boolean(), user: z.any().nullable() }
  },
  async ({ id, name, avatar, color }) => {
    const config = await readRawConfig();
    const userIndex = (config.users || []).findIndex((u: any) => u.id === id);
    if (userIndex === -1) {
      return {
        content: [{ type: 'text', text: `User "${id}" not found` }],
        structuredContent: { success: false, user: null }
      };
    }
    if (name !== undefined) config.users[userIndex].name = name;
    if (avatar !== undefined) config.users[userIndex].avatar = avatar;
    if (color !== undefined) config.users[userIndex].color = color;
    await writeRawConfig(config);
    logAction('MCP_UPDATE_USER', { id, updates: { name, avatar, color } });
    return {
      content: [{ type: 'text', text: `User "${id}" updated successfully` }],
      structuredContent: { success: true, user: config.users[userIndex] }
    };
  }
);

// Add reward
mcpServer.registerTool(
  'add_reward',
  {
    title: 'Add Reward',
    description: 'Add a new reward',
    inputSchema: {
      id: z.string().describe('Unique reward ID'),
      title: z.string().describe('Reward title'),
      icon: z.any().describe('Icon object'),
      cost: z.number().describe('Star cost')
    },
    outputSchema: { success: z.boolean(), reward: z.any() }
  },
  async ({ id, title, icon, cost }) => {
    const config = await readRawConfig();
    const reward = { id, title, icon, cost };
    config.rewards = config.rewards || [];
    config.rewards.push(reward);
    await writeRawConfig(config);
    logAction('MCP_ADD_REWARD', { reward });
    return {
      content: [{ type: 'text', text: `Reward "${title}" added successfully` }],
      structuredContent: { success: true, reward }
    };
  }
);

// Update reward
mcpServer.registerTool(
  'update_reward',
  {
    title: 'Update Reward',
    description: 'Update an existing reward',
    inputSchema: {
      id: z.string().describe('Reward ID to update'),
      title: z.string().optional().describe('New title'),
      icon: z.any().optional().describe('New icon'),
      cost: z.number().optional().describe('New cost')
    },
    outputSchema: { success: z.boolean(), reward: z.any().nullable() }
  },
  async ({ id, title, icon, cost }) => {
    const config = await readRawConfig();
    const rewardIndex = (config.rewards || []).findIndex((r: any) => r.id === id);
    if (rewardIndex === -1) {
      return {
        content: [{ type: 'text', text: `Reward "${id}" not found` }],
        structuredContent: { success: false, reward: null }
      };
    }
    if (title !== undefined) config.rewards[rewardIndex].title = title;
    if (icon !== undefined) config.rewards[rewardIndex].icon = icon;
    if (cost !== undefined) config.rewards[rewardIndex].cost = cost;
    await writeRawConfig(config);
    logAction('MCP_UPDATE_REWARD', { id, updates: { title, icon, cost } });
    return {
      content: [{ type: 'text', text: `Reward "${id}" updated successfully` }],
      structuredContent: { success: true, reward: config.rewards[rewardIndex] }
    };
  }
);

// Delete reward
mcpServer.registerTool(
  'delete_reward',
  {
    title: 'Delete Reward',
    description: 'Delete a reward by ID',
    inputSchema: { id: z.string().describe('Reward ID to delete') },
    outputSchema: { success: z.boolean() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const initialLength = (config.rewards || []).length;
    config.rewards = (config.rewards || []).filter((r: any) => r.id !== id);
    if (config.rewards.length === initialLength) {
      return {
        content: [{ type: 'text', text: `Reward "${id}" not found` }],
        structuredContent: { success: false }
      };
    }
    await writeRawConfig(config);
    logAction('MCP_DELETE_REWARD', { id });
    return {
      content: [{ type: 'text', text: `Reward "${id}" deleted successfully` }],
      structuredContent: { success: true }
    };
  }
);

// Add schedule
mcpServer.registerTool(
  'add_schedule',
  {
    title: 'Add Schedule',
    description: 'Add a new cron schedule',
    inputSchema: {
      id: z.string().describe('Unique schedule ID'),
      cron: z.string().describe('Cron expression (minute hour dayOfMonth month dayOfWeek)'),
      type: z.enum(['routine', 'flow']).describe('Target type'),
      targetId: z.string().describe('ID of the routine assignment or flow to trigger')
    },
    outputSchema: { success: z.boolean(), schedule: z.any() }
  },
  async ({ id, cron, type, targetId }) => {
    const config = await readRawConfig();
    const schedule = { id, cron, type, targetId };
    config.schedules = config.schedules || [];
    config.schedules.push(schedule);
    await writeRawConfig(config);
    logAction('MCP_ADD_SCHEDULE', { schedule });
    return {
      content: [{ type: 'text', text: `Schedule "${id}" added successfully` }],
      structuredContent: { success: true, schedule }
    };
  }
);

// Update schedule
mcpServer.registerTool(
  'update_schedule',
  {
    title: 'Update Schedule',
    description: 'Update an existing schedule',
    inputSchema: {
      id: z.string().describe('Schedule ID to update'),
      cron: z.string().optional().describe('New cron expression'),
      type: z.enum(['routine', 'flow']).optional().describe('New target type'),
      targetId: z.string().optional().describe('New target ID')
    },
    outputSchema: { success: z.boolean(), schedule: z.any().nullable() }
  },
  async ({ id, cron, type, targetId }) => {
    const config = await readRawConfig();
    const scheduleIndex = (config.schedules || []).findIndex((s: any) => s.id === id);
    if (scheduleIndex === -1) {
      return {
        content: [{ type: 'text', text: `Schedule "${id}" not found` }],
        structuredContent: { success: false, schedule: null }
      };
    }
    if (cron !== undefined) config.schedules[scheduleIndex].cron = cron;
    if (type !== undefined) config.schedules[scheduleIndex].type = type;
    if (targetId !== undefined) config.schedules[scheduleIndex].targetId = targetId;
    await writeRawConfig(config);
    logAction('MCP_UPDATE_SCHEDULE', { id, updates: { cron, type, targetId } });
    return {
      content: [{ type: 'text', text: `Schedule "${id}" updated successfully` }],
      structuredContent: { success: true, schedule: config.schedules[scheduleIndex] }
    };
  }
);

// Delete schedule
mcpServer.registerTool(
  'delete_schedule',
  {
    title: 'Delete Schedule',
    description: 'Delete a schedule by ID',
    inputSchema: { id: z.string().describe('Schedule ID to delete') },
    outputSchema: { success: z.boolean() }
  },
  async ({ id }) => {
    const config = await readRawConfig();
    const initialLength = (config.schedules || []).length;
    config.schedules = (config.schedules || []).filter((s: any) => s.id !== id);
    if (config.schedules.length === initialLength) {
      return {
        content: [{ type: 'text', text: `Schedule "${id}" not found` }],
        structuredContent: { success: false }
      };
    }
    await writeRawConfig(config);
    logAction('MCP_DELETE_SCHEDULE', { id });
    return {
      content: [{ type: 'text', text: `Schedule "${id}" deleted successfully` }],
      structuredContent: { success: true }
    };
  }
);

// Trigger action (routine or flow)
mcpServer.registerTool(
  'trigger_action',
  {
    title: 'Trigger Action',
    description: 'Manually trigger a routine assignment or flow',
    inputSchema: { id: z.string().describe('ID of the routine assignment or flow to trigger') },
    outputSchema: { success: z.boolean(), type: z.string().optional(), id: z.string().optional() }
  },
  async ({ id }) => {
    const db = await readDb();
    const result = await triggerAction(id, db, 'mcp');
    if (result) {
      return {
        content: [{ type: 'text', text: `Triggered ${result.type} "${id}" successfully` }],
        structuredContent: { success: true, type: result.type, id: result.id }
      };
    }
    return {
      content: [{ type: 'text', text: `Action "${id}" not found` }],
      structuredContent: { success: false }
    };
  }
);

// Award stars (add to current balance)
mcpServer.registerTool(
  'award_stars',
  {
    title: 'Award Stars',
    description: 'Award stars to a user (adds to current balance)',
    inputSchema: {
      userId: z.string().describe('User ID'),
      amount: z.number().describe('Number of stars to award (can be negative)')
    },
    outputSchema: { success: z.boolean(), newTotal: z.number() }
  },
  async ({ userId, amount }) => {
    try {
      const result = await awardStars(userId, amount);
      return {
        content: [{ type: 'text', text: `Awarded ${amount} stars to user ${userId}. New balance: ${result.newTotal}` }],
        structuredContent: result
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Set user stars (absolute value)
mcpServer.registerTool(
  'set_user_stars',
  {
    title: 'Set User Stars',
    description: 'Set a user\'s star balance to an absolute value',
    inputSchema: {
      userId: z.string().describe('User ID'),
      amount: z.number().describe('New star balance')
    },
    outputSchema: { success: z.boolean(), newTotal: z.number() }
  },
  async ({ userId, amount }) => {
    try {
      const result = await setUserStars(userId, amount);
      return {
        content: [{ type: 'text', text: `Set stars for user ${userId} to ${result.newTotal}` }],
        structuredContent: result
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      };
    }
  }
);
