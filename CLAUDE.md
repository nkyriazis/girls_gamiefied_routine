# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A real-time gamified routine/chore system for children, run as a kiosk-style PWA (typically on a Raspberry Pi 4). Kids see scheduled routines, complete tasks, earn stars, do chores and school exercises, and redeem rewards. Parents manage everything at `/parent`. UI strings are largely in Greek.

Stack: Fastify 5 + TypeScript + WebSockets + node-cron (backend), React 19 + Vite + Framer Motion (frontend), JSON files for config and SQLite (`node:sqlite`, Node 24) for runtime state, Docker Compose for everything.

## Agent rules (from .cursorrules)

- Don't modify the host: no global installs or system config changes. Use Docker for any tooling or services.
- During the design phase, recreate data from scratch with mock data instead of writing migrations, unless told otherwise.
- Before committing, always check `git status` and `git diff`. Avoid `git add .`. Split commits into logical chunks using `<type>(<scope>): <subject>` (types: feat, fix, docs, refactor, chore…; scopes: backend, frontend, shared, docker, config).
- If the data model changes, update `shared/types.ts` **and** the matching JSON schema in `backend/*.schema.json`. Otherwise config validation will reject the data.

## Commands

Everything runs in containers. The dependencies live in the container-mounted `node_modules`.

```bash
# Dev (hot reload): frontend http://localhost:5173, backend http://localhost:3000
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Prod-like build (docker-compose.override.yml is auto-loaded): nginx on ${FRONTEND_PORT:-80}
docker compose up --build

# Dev + public MCP endpoint via ngrok (needs NGROK_AUTHTOKEN / NGROK_DOMAIN in .env)
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile mcp up -d

# Add a package / type-check / lint inside the running dev containers
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm install <pkg>
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm run build      # tsc
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend npm run build     # tsc -b && vite build
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend npm run lint      # eslint

# Validate data.json / state.json against their schemas
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm run test-schemas

# Backend tests (node:test): store, config cache, legacy import
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm test

# Import state.json + logs.jsonl into the database (if not done yet) and verify record by record (prod image)
docker compose exec backend npm run migrate
```

Beyond `npm test`, verify changes manually:
- `/?push=<id>` triggers a flow or routine.
- `POST /api/hooks/push` supports simulated schedules and `alarm`.
- `POST /api/debug/time` and `GET /api/debug/schedule` help with time and schedule debugging.
- `GET /api/debug/logs` returns recent action logs.

## Deployment target

We develop here, but production runs on **piserve**: `ssh piserve`, checkout at `~/work/girls_gamiefied_routine`, deployed with `deploy-rpi.sh`. The Pi's `backend/data.json`, `backend/routine.db` (and, until migrated, `backend/state.json` + `backend/logs.jsonl`) hold the **live family data** (star balances, history). They have uncommitted local changes there, so never overwrite them with the dev copies, and never `git checkout`/`reset` them on the Pi. Any config or schema change must stay compatible with that existing data, or come with a migration step.

Release: `./build.sh` / `build.ps1` triggers the GitHub Actions workflow (`.github/workflows/docker-build.yml`, manual dispatch). It builds multi-arch images to `ghcr.io/nkyriazis/routine-{backend,frontend}`. On the Pi, `deploy-rpi.sh` pulls them using `docker-compose.release.yml`. Don't use dev mode on the Pi, because the polling file watchers use too much CPU.

## Architecture

### Persistence: config vs. state
- **Config** (`config.ts`) lives in `data.json` (`DATA_FILE`) and `exercises.json` (`EXERCISES_FILE`), validated with AJV against `data.schema.json` / `exercises.schema.json` (`schemas.ts`). It is cached in memory (deep-frozen) and re-read only at startup, after an admin/MCP edit (`writeRawConfig`) and when the file changes on disk (stat polling). An invalid file never replaces the cache: the last valid config stays live and the error goes to clients as `configError` in the state and to `/api/admin/validation-status`. Use `config()` to read it, `readRawConfig()` for a mutable copy.
- **Runtime state and history** (`store.ts`) live in SQLite at `DB_FILE` (default: `routine.db` next to `data.json`, i.e. on the `/data` volume): user stars, routine/task executions, spendings, transfers, chore instances, exercise sessions/assignments and the action log. Every change is written through immediately (WAL, `synchronous=FULL`); there is no in-memory copy. Multi-step changes use `store.transaction()`. Schema changes are appended to `MIGRATIONS` in store.ts. If the data model changes, update `shared/types.ts`, the table columns in store.ts (new migration) and `state.schema.json`.
- **Legacy files** (`migrate.ts`): on first start the backend imports `state.json` (`STATE_FILE`) and `logs.jsonl` (`LOGS_FILE`) once, in one transaction, and records it in the `meta` table. It never writes those files. `npm run migrate` runs the same import and prints a record-by-record verification.
- `/api/admin/state` reads and replaces the whole state as a `StateSnapshot` (the old state.json shape, validated by `state.schema.json`).
- **Action log**: `logAction()` inserts into the `action_logs` table; `/api/debug/logs` returns the newest entries.
- The backend is the source of truth. Mutations go through db.ts helpers such as `awardStars`, `claimChore`/`attemptChore`/`confirmChore`/`rejectChore` and `triggerAction` (REST and MCP alike).

### Real-time flow (backend/src/sync.ts)
- Clients render one `AppState` (`shared/types.ts`) and nothing else. Every store write (the `Store` change hook) and every config change calls `sync.changed()`; the server then rebuilds `appState()` (db.ts) and sends it as a `STATE` message to every client over WebSocket `/ws`. Changes in one event-loop turn are sent once, builds never overlap, and a connecting client gets the state the same way, so reconnects and restarts need nothing special. Mutations don't have to remember to notify anyone.
- `GameContext.tsx` replaces its state with each `STATE`. There is no initial REST fetch and no per-event patching. To show something new, add it to `AppState`/`appState()`.
- Flows and routines on screen are server state too (`flowRuns`, `routineRuns`; tables `flow_runs`, `routine_runs`). The server starts and advances them (db.ts, "ROUTINES AND FLOWS ON SCREEN"); the kids' dashboard only renders them and reports actions: dismiss an alarm, complete a task, close a routine. Those REST calls name the step/task they act on, so repeats from a second device are no-ops. A reload or a server restart resumes where it was.
- The only events are the chore toasts (`CHORE_CONFIRMED/REJECTED/EXPIRED`, via `sync.notify()` and `useGame().subscribe()`). They never carry state that isn't also in `AppState`.
- Heartbeat: the server sends `HEARTBEAT` every 10 s; a client that hears nothing for 25 s drops the socket and reconnects.
- All messages are `ServerMessage` (`{ type, payload }`), sent to every client with no per-user filtering.

### Scheduling (backend/src/server.ts)
- `node-cron` runs `checkSchedules()` every minute. It matches `schedules[].cron` using cron-parser in `settings.timezone` (default Europe/Athens), then calls `triggerAction(targetId)`. It also generates, expires and cleans up chore instances according to each chore's own cron.
- Flows are multi-step sequences, including alarm steps and parallel routine starts. Routines are assigned to users through `routineAssignments`.

### Backend layout
- `server.ts` holds all REST routes: `/api/*`, the `/api/admin/*` raw config/state editors plus validate and schema endpoints, uploads to `uploads/` served at `/uploads`, and the WebSocket.
- `mcp.ts` is an MCP server exposed at `/mcp` (Streamable HTTP, stateless, guarded by `MCP_API_KEY`). It provides many `registerTool` tools that read and write config and state. When you add domain features, consider adding matching MCP tools. See MCP.md.
- `school/ExerciseGenerators.ts` is a plugin registry of exercise generators, keyed by generator type (for example `arithmetic`), that produce `ExerciseContent`.
- The backend compiles with `rootDir: ".."` so it can include `../shared`. That's why the prod entry point is `dist/backend/src/server.js`.

### Frontend layout
- Routes: `/` → `Dashboard` (kid view: split-screen or grid of active routines, drawers for chores and school exercises, store) and `/parent` → `components/parent/ParentDashboard` (phone-first: Σήμερα with the kids' balances and what waits for a parent, Ιστορικό, Ρυθμίσεις with forms for rewards, schedules and chores, and Προχωρημένα with the Monaco JSON editors, uploads and the log). It renders `useGame()` state only; actions go through `api.ts`.
- Shared types are imported via the `@shared` alias (see `vite.config.ts`). Vite proxies `/api`, `/ws` and `/uploads` to the backend in dev. In prod, `frontend/nginx.conf` does the same, and it needs Upgrade headers for WS.
- Component styles are usually scoped with inline `<style>` blocks inside the component.
- The PWA is set up with vite-plugin-pwa. `/api` uses a NetworkFirst cache.

### Known gaps
- `/api/admin/*` and WebSocket connections are unauthenticated.
- Uploads accept any file type.
