# Girls Gamified Routine - Technical Documentation

## Overview

**Girls Gamified Routine** is a real-time gamified task management system designed for children. The application features a fullscreen dashboard that displays scheduled routines (morning/evening tasks), awards stars for completion, and allows children to redeem rewards. Parents can manage the system through an admin interface.

### Core Technologies

- **Backend**: Node.js with Fastify, TypeScript, WebSockets, node-cron
- **Frontend**: React 19, Vite, TypeScript, Framer Motion, React Router
- **Infrastructure**: Docker Compose, Nginx (production proxy)
- **Data Persistence**: JSON files (file-based database)
- **Real-time Communication**: WebSockets for bidirectional state sync
- **Scheduling**: Cron expressions with timezone support (Europe/Athens default)

### Project Purpose

The system acts as a **real-time command center** for family routines:
- Routines automatically trigger at scheduled times (e.g., 7:00 AM morning routine)
- Multiple children can have routines running simultaneously (split-screen or grid view)
- Star rewards are awarded immediately upon task completion
- Parents monitor activity and approve reward redemptions
- PWA support allows installation on tablets/devices for kiosk-like experience

---

## Architecture Overview

### High-Level Data Flow

```mermaid
graph TB
    subgraph Frontend["FRONTEND (React)"]
        WS[WebSocket Client<br/>Event Listener]
        GC[GameContext<br/>State Mirror]
        UI[Dashboard / ParentDashboard<br/>View Components]
        
        WS --> GC
        GC --> UI
    end
    
    subgraph Backend["BACKEND (Fastify)"]
        API[REST API<br/>/api/*]
        WSB[WebSocket<br/>Broadcaster]
        CRON[Cron<br/>Scheduler]
        MEM[In-Memory State globalState<br/>userStars, routineExecutions, taskExecutions, spendings]
        
        API --> MEM
        WSB --> MEM
        CRON --> MEM
    end
    
    subgraph Storage["File System (Disk)"]
        DATA[data.json<br/>config]
        STATE[state.json<br/>state]
    end
    
    UI -->|HTTP/WS| API
    UI -->|HTTP/WS| WSB
    MEM -->|Debounced Write 10s| STATE
    API -.->|Read Fresh| DATA
    MEM -.->|Load on Startup| STATE
    
    style Frontend fill:#e1f5ff
    style Backend fill:#fff4e1
    style Storage fill:#f0f0f0
```

### The Three Data Layers

1. **Static Configuration (`data.json`)**
   - Users, routines, tasks, schedules, flows, rewards
   - Read fresh on every API request (allows hot-reloading)
   - Modified via Admin panel (`/parent` → Config tab)

2. **Dynamic State (`state.json`)**
   - User star balances, routine executions, task completions, spendings
   - Loaded into memory at startup (`globalState`)
   - Written to disk with 10-second debounce on changes
   - Atomic writes using temp file + rename pattern

3. **In-Memory Cache (`globalState`)**
   - Single source of truth during runtime
   - Merged with `data.json` on each read operation
   - Persisted to `state.json` asynchronously

---

## State Management Deep Dive

### Backend: File-Based Persistence

The backend uses a **hybrid caching strategy**:

```typescript
// In-memory state cache (server.ts)
let globalState: {
  userStars: Record<string, number>;
  routineExecutions: any[];
  taskExecutions: any[];
  spendings: Spending[];
}
```

**Read Flow** (`readDb()`):
1. Read `data.json` from disk (fresh every time)
2. Merge `globalState.userStars` into user objects
3. Append execution history and spendings from `globalState`
4. Return combined object

**Write Flow** (`writeDb()`):
1. Extract star balances from user objects → update `globalState.userStars`
2. Update execution/spending arrays in `globalState`
3. Schedule a debounced persist (10s delay)
4. On persist: atomic write to `state.json.tmp` → rename to `state.json`

**Why This Pattern?**
- **Hot reload config**: Parents can edit routines/schedules without restart
- **Performance**: In-memory reads are instant, writes are batched
- **Data integrity**: Atomic writes prevent corruption on crash
- **Separation of concerns**: Config changes don't corrupt runtime state

### Frontend: React Context + WebSocket Sync

The frontend mirrors backend state using **GameContext** (`frontend/src/context/GameContext.tsx`):

```typescript
// State managed in GameContext
const [users, setUsers] = useState<User[]>([]);
const [flows, setFlows] = useState<Flow[]>([]);
const [rewards, setRewards] = useState<Reward[]>([]);
const [spendings, setSpendings] = useState<Spending[]>([]);
const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
```

**Initialization**:
1. Component mounts → `useEffect` fetches initial data via REST API
2. Establishes WebSocket connection to `/ws`
3. Backend sends `SYNC_STATE` message immediately on connect

**Real-Time Updates**:
- WebSocket listener receives events (`SYNC_STATE`, `STARS_AWARDED`, `ROUTINE_START`, etc.)
- Events update local state reactively
- `lastEvent` triggers with timestamp to ensure identical events fire effects

**Why Context API?**
- Simple, built-in state management (no Redux needed for this scale)
- Global state accessible to all components
- WebSocket connection managed in one place
- Easy to debug (single state tree)

---

## Synchronization & Real-Time Communication

### WebSocket Event Types

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `SYNC_STATE` | Server → Client | `{ userStars, spendings }` | Full state sync on connect or update |
| `ROUTINE_START` | Server → Client | `{ userId, routineId, executionId }` | Trigger routine UI for a user |
| `FLOW_START` | Server → Client | `{ flowId, steps }` | Start a multi-step flow (alarm + routines) |
| `ALARM_START` | Server → Client | `{}` | Trigger global alarm overlay |
| `STARS_AWARDED` | Server → Client | `{ userId, amount, totalStars }` | Show star animation |
| `CONFIG_UPDATED` | Server → Client | `{}` | Signal frontend to reload config |

### Trigger Mechanisms

**1. Cron Scheduler** (`node-cron`)
```javascript
// Runs every minute (server.ts)
cron.schedule('* * * * *', () => {
  checkSchedules(new Date());
});
```

- Parses all schedules from `data.json`
- Compares cron expression against current time (timezone-aware)
- Calls `triggerAction(targetId)` for matching schedules
- Broadcasts appropriate WebSocket event

**2. Manual Push API** (`POST /api/hooks/push`)
```json
{ "id": "morning-flow" }
```
- Used by parent dashboard "Trigger" buttons
- Used by URL parameter (`?push=morning-flow`) for testing
- Simulates scheduled trigger immediately

**3. Flow Orchestration**
- Flows define multi-step sequences (`alarm` → `parallel routines`)
- Steps execute sequentially
- `parallel` steps trigger multiple routines simultaneously
- Frontend manages step progression via `handleStepComplete()`

---

## View Layer Architecture

### Routing Structure

```
/ (Root)
└─ Dashboard.tsx
   ├─ GlobalAlarm (overlay)
   ├─ InlineRoutinePlayer (1-4 simultaneous)
   └─ StoreModal (per-user reward shop)

/parent (Admin)
└─ ParentDashboard.tsx
   ├─ User stars overview
   ├─ Pending reward redemptions
   ├─ Config editor (data.json)
   └─ State editor (state.json)
```

### View Modes & Layouts

**Dashboard** dynamically adapts based on active routines:

| Active Count | Mode | Layout |
|--------------|------|--------|
| 0 | `IDLE` | Large clock + user dock at bottom |
| 1 | `SINGLE` | Fullscreen routine player |
| 2 | `DUAL` | 50/50 split (vertical on mobile) |
| 3+ | `GRID` | 2x2 grid |

**Responsive Breakpoints**:
- Desktop: Grid layout, large fonts
- Mobile (<768px): Single column, scaled-down timers

### Component Hierarchy

```
Dashboard
├─ GlobalAlarm (modal)
│  └─ Dismisses after user interaction
│
├─ InlineRoutinePlayer (per active user)
│  ├─ Header: Avatar, progress bar, exit button
│  ├─ Timeline: Dot indicators (past/current/future)
│  ├─ Task Display: Icon, title, countdown timer
│  ├─ "Done" Button: Advances to next task
│  └─ RewardOverlay (on completion)
│
└─ StoreModal (per user, on dock avatar click)
   ├─ Reward Grid: Available rewards with costs
   ├─ Pending List: Awaiting parent approval
   └─ History: Completed redemptions
```

### Task Lifecycle State Machine

```
[Routine Triggered] 
      ↓
[Task 1 Active] → Timer Counting → [User Clicks "Done"]
      ↓                                      ↓
   API Call: POST /api/executions/{id}/tasks/{taskId}/complete
      ↓                                      ↓
   Backend: Award Stars → Broadcast STARS_AWARDED
      ↓                                      ↓
[Task 2 Active] → ... → [Last Task Done]
      ↓
[RewardOverlay Shown] → Auto-dismiss (5s) or Click
      ↓
[Routine Complete] → Remove from activeRoutines
```

---

## Critical Files Reference

### Backend

**`backend/src/server.ts`** (Core Server)
- **Lines 1-50**: Imports, file path setup, in-memory state declaration
- **Lines 51-90**: `loadState()`, `persistState()`, debounced save logic
- **Lines 92-140**: `readDb()`, `writeDb()` (hybrid data access)
- **Lines 142-180**: WebSocket connection management, `broadcast()` helper
- **Lines 182-230**: `triggerAction()` (dispatch routine/flow), `checkSchedules()` (cron logic)
- **Lines 232-280**: REST API routes (`/api/users`, `/api/flows`, `/api/rewards`, etc.)
- **Lines 282-320**: Task completion endpoint (star awards)
- **Lines 322-360**: Admin endpoints (upload, config editor, state editor)
- **Lines 362-380**: WebSocket route registration
- **Lines 382-400**: Startup sequence (load state, start cron, listen)

**`backend/data.json`** (Configuration Database)
- `tasks`: Task library (reusable across routines)
- `routines`: Template routines (Morning, Evening, etc.)
- `routineTasks`: Join table mapping routines → tasks with duration/order
- `users`: Children profiles with avatars and colors
- `routineAssignments`: User-specific routine instances (used as `routineId` in frontend)
- `flows`: Multi-step sequences (alarm → parallel routines)
- `schedules`: Cron expressions tied to flows or assignments
- `rewards`: Redeemable rewards with star costs
- `settings`: Global config (timezone)

**`backend/state.json`** (Dynamic State, auto-generated)
- `userStars`: `{ "u1": 120, "u2": 80 }`
- `routineExecutions`: Array of routine start records
- `taskExecutions`: Array of completed tasks
- `spendings`: Reward redemption history

### Frontend

**`frontend/src/context/GameContext.tsx`** (State Container)
- Manages: `users`, `flows`, `rewards`, `spendings`, `isConnected`, `lastEvent`
- `refreshData()`: Fetches all data via REST API
- WebSocket client: Auto-reconnects on disconnect, parses events, updates state
- Exported hook: `useGame()` for component access

**`frontend/src/api.ts`** (API Client)
- Thin wrappers around `fetch()` for all backend endpoints
- No state management (consumed by GameContext)

**`frontend/src/components/Dashboard.tsx`** (Main UI)
- Listens to `lastEvent` from GameContext
- Manages: `activeFlow`, `activeRoutines`, `storeUserId`
- Renders: Clock (idle), InlineRoutinePlayer (active), GlobalAlarm (flows), StoreModal

**`frontend/src/components/InlineRoutinePlayer.tsx`** (Routine UI)
- Props: `user`, `routine`, `executionId`, `onComplete`, `onExit`
- State: `currentTaskIndex`, `timeLeft`, `isActive`
- Calls `api.completeTask()` on each task finish
- Shows floating star animation on award

**`frontend/src/components/ParentDashboard.tsx`** (Admin UI)
- Tabs: Dashboard, Config, State
- Dashboard: User stars, pending spendings, file upload, manual triggers
- Config/State: JSON editors with syntax validation

### Shared

**`shared/types.ts`** (Type Contracts)
- Defines: `User`, `Routine`, `Task`, `Flow`, `Reward`, `Spending`
- Imported by both frontend and backend (`@shared` alias in Vite)
- Ensures type safety across network boundary

### Infrastructure

**`docker-compose.yml`** (Base Config)
- Defines: Service names (`backend`, `frontend`), network (`routine-net`), timezone

**`docker-compose.override.yml`** (Dev Mode - auto-loaded)
- Uses: `node:20-alpine` images, volume mounts for hot-reload
- Exposes: Backend on 3000, Frontend on 5173
- Command: `npm run dev` (nodemon for backend, Vite for frontend)

**`docker-compose.prod.yml`** (Production Mode - explicit)
- Builds: Dockerfiles for both services
- Frontend: Nginx serves static build, proxies API/WS to backend
- Backend: Compiled TypeScript (`npm run build`)
- Restart: Always (service auto-recovery)

**`frontend/nginx.conf`** (Production Proxy)
- Serves `/` from `/usr/share/nginx/html` (Vite build output)
- Proxies `/api` to `http://backend:3000`
- Proxies `/ws` with WebSocket upgrade headers

**`frontend/vite.config.ts`** (Build Config)
- Alias: `@shared` → `../shared`
- Proxy: `/api` and `/ws` to backend (dev mode only)
- PWA: Service worker with auto-update, manifest for installable app

---

## Dashboard State Machine (FSM) Analysis

### State Overview

The Dashboard component manages a complex finite state machine with multiple orthogonal (independent) substates:

```
Dashboard State = {
  flowState: { activeFlow, currentStepIndex },
  routineState: { activeRoutines[] },
  uiState: { storeUserId, hasInteracted, isInstallable },
  viewMode: IDLE | SINGLE | DUAL | GRID
}
```

### Primary State Machine: Flow Execution

```mermaid
stateDiagram-v2
    [*] --> Idle: Initial Load
    Idle --> FlowActive: FLOW_START event
    FlowActive --> AlarmStep: step[0].type === 'alarm'
    FlowActive --> ParallelStep: step[0].type === 'parallel'
    AlarmStep --> ParallelStep: User dismisses alarm (handleStepComplete)
    ParallelStep --> FlowComplete: No more steps
    ParallelStep --> NextStep: More steps exist
    NextStep --> AlarmStep: step[n].type === 'alarm'
    NextStep --> ParallelStep: step[n].type === 'parallel'
    FlowComplete --> Idle: activeFlow = null
    
    note right of ParallelStep
        Frontend calls api.pushNow()
        for each routine in actions[]
        Backend broadcasts ROUTINE_START events
    end note
```

**State Variables:**
- `activeFlow: Flow | null` - Currently executing flow
- `currentStepIndex: number` - Position in flow.steps[]

**Transitions:**
1. `FLOW_START` event → Set `activeFlow`, reset `currentStepIndex` to 0
2. User completes step (e.g., dismisses alarm) → Increment `currentStepIndex`
3. Parallel step entered → Frontend triggers backend API calls for each routine
4. Last step completed → Clear `activeFlow`, reset `currentStepIndex`

### Secondary State Machine: Routine Execution

```mermaid
stateDiagram-v2
    [*] --> NoRoutines: activeRoutines.length === 0
    NoRoutines --> SingleRoutine: ROUTINE_START event (count=1)
    NoRoutines --> MultiRoutines: ROUTINE_START event (count≥2)
    SingleRoutine --> MultiRoutines: Another ROUTINE_START
    MultiRoutines --> SingleRoutine: routineComplete/routineExit (count→1)
    SingleRoutine --> NoRoutines: routineComplete/routineExit (count→0)
    MultiRoutines --> NoRoutines: All complete (count→0)
    
    NoRoutines: View = IDLE (Clock)
    SingleRoutine: View = SINGLE (Fullscreen)
    MultiRoutines: View = DUAL/GRID (Split)
```

**State Variables:**
- `activeRoutines: Array<{ userId, routineId, executionId }>` - Running routines

**Transitions:**
1. `ROUTINE_START` event → Add to array (with deduplication by userId+routineId)
2. User exits routine → Remove from array
3. User completes routine → Remove from array

**Derived State:**
- `viewMode = activeRoutines.length === 0 ? 'IDLE' : length === 1 ? 'SINGLE' : length === 2 ? 'DUAL' : 'GRID'`

### Event Processing Pipeline

**GameContext** receives WebSocket events → Updates `lastEvent` → Dashboard `useEffect` reacts:

```typescript
useEffect(() => {
  if (!lastEvent) return;
  
  switch (lastEvent.type) {
    case 'ALARM_START':
      // Create synthetic flow with alarm step
      setActiveFlow({ id: 'temp-alarm', steps: [{ type: 'alarm', props: {...} }] });
      setCurrentStepIndex(0);
      break;
      
    case 'ROUTINE_START':
      // Add to activeRoutines with deduplication
      setActiveRoutines(prev => {
        const filtered = prev.filter(r => !(r.userId === userId && r.routineId === routineId));
        return [...filtered, { userId, routineId, executionId }];
      });
      break;
      
    case 'FLOW_START':
      // Load flow, reset step index
      setActiveFlow(flowsRef.current.find(f => f.id === flowId) || payload);
      setCurrentStepIndex(0);
      break;
  }
}, [lastEvent]);
```

### Critical Race Conditions & Pitfalls

#### 1. **Duplicate Routine Triggers** ⚠️ FIXED
**Symptom:** Same routine appears multiple times on screen

**Root Cause:**
- Backend broadcasts `ROUTINE_START` immediately when flow starts
- Frontend `handleStepComplete()` calls `api.pushNow()` for parallel routines
- If both fire, duplicate events are processed

**Mitigation (Implemented):**
```typescript
// Deduplication by userId+routineId composite key
setActiveRoutines(prev => {
  const filtered = prev.filter(r => !(r.userId === userId && r.routineId === routineId));
  return [...filtered, { userId, routineId, executionId }];
});
```

**Design Decision:**
- Backend should NOT auto-trigger routines in parallel steps
- Backend only broadcasts `FLOW_START` with step definitions
- Frontend is responsible for executing `api.pushNow()` for each parallel action
- This ensures single source of trigger logic

#### 2. **Flow Step Index Out of Sync**
**Symptom:** Flow gets stuck or skips steps

**Scenario:**
```typescript
// User dismisses alarm quickly
handleStepComplete(); // currentStepIndex++
// But activeFlow was just cleared by another event?
```

**Mitigation:**
- Always check `if (!activeFlow) return;` at start of handlers
- Use functional updates: `setCurrentStepIndex(prev => prev + 1)`
- Reset stepIndex to 0 when setting new activeFlow

#### 3. **Stale Flow Reference in Parallel Execution**
**Symptom:** Wrong routines triggered when flow data changes

**Scenario:**
```typescript
// Flow data changes in GameContext
flows = [...newFlows];

// But activeFlow is a stale copy
activeFlow.steps[1].actions.forEach(a => api.pushNow(a.routineId));
```

**Mitigation (Implemented):**
```typescript
const flowsRef = useRef<Flow[]>([]);
useEffect(() => { flowsRef.current = flows; }, [flows]);

// On FLOW_START, always fetch fresh flow
const flow = flowsRef.current.find(f => f.id === flowId) || payload;
```

#### 4. **WebSocket Reconnection State Loss**
**Symptom:** Dashboard doesn't show active routines after reconnect

**Scenario:**
- WebSocket disconnects during active routine
- Reconnects → GameContext refreshes data
- But `activeRoutines` state is local to Dashboard, not persisted

**Current Behavior:** State is lost ❌

**Potential Fix:**
```typescript
// On reconnect, query backend for active executions
useEffect(() => {
  if (isConnected) {
    api.getActiveExecutions().then(executions => {
      setActiveRoutines(executions.map(e => ({
        userId: e.userId,
        routineId: e.routineId,
        executionId: e.id
      })));
    });
  }
}, [isConnected]);
```

**Note:** Backend currently doesn't expose `GET /api/executions/active` endpoint

#### 5. **Multiple Flow Instances**
**Symptom:** Alarm shows, then another alarm shows on top

**Scenario:**
- Flow A is active (on alarm step)
- Parent triggers Flow B (also starts with alarm)
- Both flows render `<GlobalAlarm>` components simultaneously

**Current Behavior:** Only one alarm renders (latest wins via `activeFlow` replacement) ✅

**Consideration:** Should multiple flows queue? Current design assumes single active flow at a time.

#### 6. **Routine Exit vs Complete Semantics**
**Symptom:** Incomplete routines leave orphaned execution records

**Scenario:**
- User starts routine (execution record created in backend)
- User clicks "X" to exit early
- Frontend removes from `activeRoutines` but backend still has open execution

**Current Behavior:**
- `handleRoutineExit()` only updates frontend state
- Backend execution remains incomplete (no `completedAt` timestamp)
- Stars earned from completed tasks persist

**Design Question:** Should early exit:
1. Keep partial stars? (Current)
2. Forfeit all stars?
3. Mark execution as "abandoned"?

#### 7. **Flow State vs Routine State Independence**
**Symptom:** Flow completes but routines still running

**Scenario:**
```
Flow: [Alarm] → [Parallel: Routine1, Routine2]
User dismisses alarm → parallel routines trigger
Flow state: activeFlow = null (complete)
Routine state: activeRoutines = [Routine1, Routine2] (still running)
```

**Current Behavior:** This is correct! Flow and routine lifecycles are independent ✅

**Implication:**
- Flow orchestrates START only
- Routines run independently until user completes them
- Flow does not block on routine completion

### State Consistency Guarantees

**Strong Guarantees:**
1. ✅ `activeRoutines` cannot have duplicates for same userId+routineId
2. ✅ `currentStepIndex` is always valid (0 ≤ index < steps.length or flow is null)
3. ✅ `viewMode` always matches `activeRoutines.length`

**Weak Guarantees (Eventually Consistent):**
1. ⚠️ User star counts sync via WebSocket (may lag by ~100ms)
2. ⚠️ Spending status updates require full data refresh
3. ⚠️ Active routine state lost on reconnect (not persisted)

**No Guarantees:**
1. ❌ Execution records in backend may not match frontend active routines
2. ❌ Flow step progression is client-side only (no backend tracking)
3. ❌ Multiple clients can have different `activeFlow` states (no conflict resolution)

### Recommended Improvements

1. **Add Backend Execution State Tracking:**
   ```typescript
   // Track which executions are still active
   globalState.activeExecutions = [
     { id: 'exec-123', userId: 'u1', routineId: 'r-morning', startedAt: '...' }
   ];
   
   // Broadcast on completion
   broadcast({ type: 'EXECUTION_COMPLETE', payload: { executionId } });
   ```

2. **Add Flow State Persistence:**
   ```typescript
   globalState.activeFlows = [
     { flowId: 'morning-flow', currentStepIndex: 1, startedAt: '...' }
   ];
   ```

3. **Add Explicit Exit API:**
   ```typescript
   // POST /api/executions/:id/exit
   // Mark execution as abandoned, optionally forfeit stars
   ```

4. **Add Idempotency Keys:**
   ```typescript
   // Prevent duplicate routine triggers
   api.pushNow(routineId, { idempotencyKey: `${flowId}-${stepIndex}-${routineId}` });
   ```

5. **Add State Recovery on Reconnect:**
   ```typescript
   // GET /api/state/snapshot
   // Returns: { activeExecutions, activeFlows, lastEventTimestamp }
   ```

---

## I/O Patterns & Data Flow

### Initial Page Load

1. **Client** opens `/` → React app loads
2. **GameContext** mounts → Calls `api.getUsers()`, `api.getFlows()`, `api.getRewards()`, `api.getSpendings()`
3. **Server** receives 4 parallel REST requests → Reads `data.json`, merges `globalState`, responds
4. **GameContext** establishes WebSocket → Server sends `SYNC_STATE` immediately
5. **Dashboard** renders clock (idle mode)

### Scheduled Routine Trigger

1. **Cron** fires at 7:00 AM → `checkSchedules(new Date())`
2. **Server** finds schedule `sch-morning` → `triggerAction('morning-flow')`
3. **Flow Logic**: 
   - Step 1: Broadcast `ALARM_START`
   - Step 2: Broadcast `ROUTINE_START` for each user in parallel actions
4. **All Clients** receive events:
   - Show `GlobalAlarm` overlay
   - Add routines to `activeRoutines` array
5. **Dashboard** switches to DUAL/GRID mode, renders `InlineRoutinePlayer` components

### Task Completion Flow

1. **User** clicks "Done" button in routine player
2. **Frontend** calculates task duration, calls `api.completeTask(executionId, taskId, duration, isOnTime)`
3. **Server** (`POST /api/executions/.../complete`):
   - Creates `TaskExecution` record
   - Finds user from execution → Adds stars to `user.stars`
   - Updates `globalState` → Schedules debounced persist
   - Broadcasts `STARS_AWARDED` event
4. **All Clients** receive event:
   - Update user star count in `GameContext`
   - Show floating star animation (only in active routine player)
5. **Frontend** advances to next task or shows completion overlay

### Reward Redemption Flow

1. **Child** clicks avatar in dock → Opens `StoreModal`
2. **Child** clicks reward → Calls `api.spendStars(userId, rewardId)`
3. **Server** (`POST /api/spendings`):
   - Validates: `user.stars >= reward.cost`
   - Deducts stars, creates `Spending` record (status: `pending`)
   - Updates `globalState`, broadcasts `SYNC_STATE`
4. **All Clients** refresh spendings list
5. **Parent** opens `/parent` → Sees pending spending
6. **Parent** clicks "Done" → Calls `api.markSpendingDone(id)` → Status changes to `done`

---

## Deployment & Environment

### Development Mode

```powershell
docker-compose up
```

- **Hot Reload**: File changes in `backend/`, `frontend/`, `shared/` trigger auto-rebuild
- **File Watching**: Uses `CHOKIDAR_USEPOLLING=true` for Docker volume compatibility
- **Ports**: Frontend (5173), Backend (3000)
- **Data Persistence**: `backend/data.json` and `backend/state.json` mounted as volumes

### Production Mode

```powershell
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

- **Optimized Builds**: TypeScript compiled, Vite production bundle
- **Single Port**: Frontend Nginx on port 80 (proxies backend internally)
- **Data Volume**: `./backend:/data` ensures state persists across container restarts
- **Restart Policy**: `always` (auto-restart on failure or reboot)

### Raspberry Pi 4 Deployment

Fully supported on ARM64 architecture:
- Base images (`node:20-alpine`, `nginx:alpine`) support ARM64
- Production mode recommended (dev file-watching consumes excessive CPU)
- First build takes 5-10 minutes, subsequent starts are instant
- Minimum 2GB RAM recommended

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATA_FILE` | `./data.json` | Path to config file (prod: `/data/data.json`) |
| `STATE_FILE` | `./state.json` | Path to state file (prod: `/data/state.json`) |
| `TZ` | `Europe/Athens` | Container timezone for cron accuracy |
| `CHOKIDAR_USEPOLLING` | `true` (dev) | Enable file-watching in Docker volumes |

---

## Practices & Patterns Employed

### 1. **Shared Type System**
- **Pattern**: Monorepo with `shared/types.ts` imported by both frontend and backend
- **Benefit**: Type safety across network boundary, single source of truth for data models
- **Implementation**: Vite alias (`@shared`) resolves to `../shared`

### 2. **Debounced Persistence**
- **Pattern**: In-memory cache with delayed disk writes (10s debounce)
- **Benefit**: Protects against write storms, improves performance
- **Implementation**: `setTimeout` cleared and reset on each state change

### 3. **Atomic File Writes**
- **Pattern**: Write to `.tmp` file, rename to target (atomic operation)
- **Benefit**: Prevents corruption if process crashes mid-write
- **Implementation**: `fs.rename()` after successful write

### 4. **WebSocket Event Broadcasting**
- **Pattern**: Single broadcast function iterates all connected clients
- **Benefit**: Decouples event sources from clients, real-time updates
- **Implementation**: `Set<WebSocket>` with readyState check

### 5. **Cron-Based Scheduling**
- **Pattern**: `node-cron` with timezone-aware parsing via `cron-parser` + `luxon`
- **Benefit**: Accurate scheduling regardless of server timezone
- **Implementation**: `cron-parser` with `tz` option, minute-level granularity

### 6. **Hot-Reloadable Configuration**
- **Pattern**: Read `data.json` fresh on every API request
- **Benefit**: Parents can edit config without server restart
- **Implementation**: `readDb()` always hits disk for config, merges with memory state

### 7. **Progressive Web App (PWA)**
- **Pattern**: Vite PWA plugin with auto-update strategy
- **Benefit**: Installable on tablets, offline support, app-like experience
- **Implementation**: Service worker caches assets, manifest defines icons/theme

### 8. **Proxy Pattern for API**
- **Pattern**: Nginx (prod) and Vite (dev) proxy `/api` and `/ws` to backend
- **Benefit**: Single origin, no CORS issues, simplified deployment
- **Implementation**: Nginx `proxy_pass`, Vite `server.proxy`

### 9. **Component Composition**
- **Pattern**: Smart container (Dashboard) + dumb presenters (InlineRoutinePlayer)
- **Benefit**: Reusable components, clear separation of concerns
- **Implementation**: Props for data, callbacks for actions

### 10. **Optimistic UI Updates**
- **Pattern**: Frontend updates state immediately, backend confirms via WebSocket
- **Benefit**: Instant feedback, smooth UX
- **Implementation**: `setUsers()` before WebSocket `SYNC_STATE` arrives

---

## Assessment & Improvement Roadmap

### Current Strengths

✅ **Real-time synchronization** works reliably with WebSocket broadcasting  
✅ **Type safety** across frontend/backend with shared types  
✅ **Hot-reloadable config** allows live changes without downtime  
✅ **Debounced persistence** prevents write storms and improves performance  
✅ **Timezone-aware scheduling** ensures accurate routine triggers  
✅ **PWA support** enables tablet installation for dedicated use  
✅ **Docker Compose** simplifies dev/prod environments  
✅ **Atomic file writes** protect against data corruption  

### Critical TODOs (Security & Stability)

#### 🔴 **Priority 1: Authentication & Authorization**
**Issue**: Admin endpoints (`/api/admin/*`, `/parent`) are completely open  
**Risk**: Anyone can read/write config, view state, upload files  
**Solution**:
- Implement simple PIN-based auth for `/parent` route
- Add middleware to check auth token on admin endpoints
- Store hashed PIN in environment variable
```typescript
// Example: Add to server.ts
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
server.addHook('preHandler', (request, reply, done) => {
  if (request.url.startsWith('/api/admin')) {
    const pin = request.headers['x-admin-pin'];
    if (pin !== ADMIN_PIN) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
  }
  done();
});
```

#### 🔴 **Priority 2: Input Validation**
**Issue**: API endpoints trust all input (user IDs, task IDs, JSON in POST body)  
**Risk**: Malformed data can crash server or corrupt state  
**Solution**:
- Add JSON schema validation with `@fastify/ajv`
- Validate UUIDs, dates, numbers at endpoint entry
- Reject unknown properties in POST bodies

#### 🟡 **Priority 3: File Upload Security**
**Issue**: `/api/admin/upload` accepts any file, stores with timestamp-only filename  
**Risk**: Malicious files (scripts, executables), filename collisions  
**Solution**:
- Whitelist MIME types (image/png, image/jpeg, image/svg+xml)
- Validate file size (max 5MB)
- Use UUIDs for filenames, store original name in metadata

### Code Quality Improvements

#### 🟡 **Remove `any` Types**
**Files**: `server.ts` (lines with `any[]`, `any` parameters)  
**Solution**: Define proper interfaces for `RoutineExecution`, `TaskExecution`, `RoutineAssignment`

#### 🟡 **Migrate `verify_api.js` to TypeScript**
**Issue**: Single JavaScript file in TypeScript project  
**Solution**: Rename to `.ts`, add types, or delete if unused

#### 🟡 **Standardize Error Handling**
**Issue**: Inconsistent error responses (some `reply.code(500)`, some throw)  
**Solution**: Add global error handler in Fastify, return consistent JSON structure

#### 🟡 **Frontend Error Boundaries**
**Issue**: Component errors crash entire app  
**Solution**: Add React Error Boundary around Dashboard and ParentDashboard

### Architectural Upgrades

#### 🟢 **Database Migration**
**Current**: JSON files (`data.json`, `state.json`)  
**Limitation**: No transactions, poor concurrency, manual relationship management  
**Recommendation**: Migrate to **SQLite** (lightweight, serverless, perfect for this scale)  
**Migration Path**:
1. Install `better-sqlite3`
2. Create schema matching current JSON structure
3. Write migration script to import existing data
4. Update `readDb()`/`writeDb()` to use SQL queries
5. Keep JSON as backup/export format

#### 🟢 **Logging & Observability**
**Current**: Console logs only  
**Recommendation**: Add structured logging with `pino` (Fastify's logger)  
**Add**:
- Request/response logging (already available via Fastify logger)
- Business event logging (routine starts, star awards, redemptions)
- Error tracking (consider Sentry for production)

#### 🟢 **Testing**
**Current**: No automated tests  
**Recommendation**:
- **Unit**: Backend API endpoints (Fastify testing utilities)
- **Integration**: WebSocket event flow, cron trigger logic
- **E2E**: Playwright tests for Dashboard user flows
**Priority Routes**:
- `POST /api/executions/.../complete` (star award logic)
- `checkSchedules()` function (cron accuracy)
- WebSocket reconnection behavior

#### 🟢 **State Management Enhancement**
**Current**: Context API with `lastEvent` timestamp trick  
**Limitation**: Difficult to debug, no time-travel, no middleware  
**Recommendation** (only if complexity grows):
- Consider Zustand (lightweight, TypeScript-friendly, dev tools)
- Keep Context API for now (good enough for current scale)

### UX & Feature Enhancements

#### 🟢 **Offline Support**
**Current**: PWA caches assets but requires backend for state  
**Enhancement**: Add IndexedDB cache for offline star viewing, queue redemptions

#### 🟢 **Undo/Revoke Task Completion**
**Current**: No way to undo accidental task completion  
**Enhancement**: Add "Undo" button with 5-second window, or parent admin tool to revoke

#### 🟢 **Historical Analytics**
**Current**: `taskExecutions` and `routineExecutions` stored but not visualized  
**Enhancement**: Add charts to `/parent` showing completion rates, on-time %, trends

#### 🟢 **Sound Management**
**Current**: Alarm sound is hardcoded (`melody`)  
**Enhancement**: Add sound upload to admin panel, per-flow sound selection

### Documentation TODOs

#### 📝 **API Documentation**
**Missing**: OpenAPI/Swagger spec for REST endpoints  
**Solution**: Add `@fastify/swagger` plugin, generate docs at `/docs`

#### 📝 **Deployment Guide**
**Missing**: Production deployment checklist (backups, monitoring, SSL)  
**Solution**: Add `DEPLOYMENT.md` with systemd service, Caddy/Traefik SSL setup, backup scripts

#### 📝 **Contributing Guide**
**Missing**: Developer onboarding (local setup, commit conventions, PR process)  
**Solution**: Add `CONTRIBUTING.md` with VSCode setup, Docker troubleshooting

---

## Quick Reference for New Developers

### Adding a New Routine
1. Edit `backend/data.json` → Add entry to `routines` array
2. Add tasks to `routineTasks` with `routineId` reference
3. Create `routineAssignment` linking user to routine
4. (Optional) Add schedule entry to trigger automatically
5. Restart backend or use hot-reload (save `data.json`)

### Adding a New Reward
1. Edit `backend/data.json` → Add entry to `rewards` array
2. Frontend will automatically display in StoreModal
3. Upload icon via `/parent` → Uploads section if using custom image

### Changing a Schedule Time
1. Edit `backend/data.json` → Find schedule in `schedules` array
2. Update `cron` field (format: `minute hour * * *` for daily)
3. Save file (hot-reload applies immediately)

### Debugging WebSocket Issues
1. Open browser DevTools → Network tab → Filter by WS
2. Check connection status (should show `/ws` with green indicator)
3. View sent/received messages in Frames tab
4. Check backend logs for `Client connected via WebSocket`
5. Common issue: NGINX proxy missing `Upgrade` headers (check `nginx.conf`)

### Testing a Routine Manually
1. Open `/parent` dashboard
2. Scroll to "Trigger Routines" section
3. Click button for desired routine/flow
4. Watch frontend for immediate response
5. Or use URL parameter: `/?push=morning-flow`

### Viewing Raw State
1. Open `/parent` → State tab
2. View current `userStars`, `routineExecutions`, etc.
3. Edit JSON (be careful!) and click Save
4. Or directly edit `backend/state.json` (requires server restart)

### Backup & Restore
**Backup**:
```powershell
# Copy state files
cp backend/data.json backup/data-$(date +%Y%m%d).json
cp backend/state.json backup/state-$(date +%Y%m%d).json
```

**Restore**:
```powershell
# Replace current files
cp backup/data-20250101.json backend/data.json
cp backup/state-20250101.json backend/state.json
# Restart backend
docker-compose restart backend
```

---

## Conclusion

This project demonstrates a **real-time, event-driven architecture** suitable for small-scale interactive applications. The file-based persistence is pragmatic for the current scope (2-4 users, low write frequency), and the WebSocket synchronization provides instant feedback crucial for engaging children.

**For new developers**: Start by understanding the data flow (REST → WebSocket → Component), then explore the scheduling logic (`checkSchedules()`), and finally dive into the component lifecycle (`InlineRoutinePlayer`). The codebase is well-structured with clear separation between backend (source of truth) and frontend (reactive view).

**For production use**: Prioritize authentication, input validation, and regular backups. The system is stable for family use but requires hardening for public deployment.

---

*Last Updated: November 22, 2025*  
*Repository: girls_gamiefied_routine*  
*Stack: Node.js + Fastify + React + WebSockets + Docker*
