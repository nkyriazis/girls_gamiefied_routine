# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A real-time gamified routine/chore system for children, run as a kiosk-style PWA (typically on a Raspberry Pi 4). Kids see scheduled routines, complete tasks, earn stars, do chores and school exercises, and redeem rewards. Parents manage everything at `/parent`. UI strings are largely in Greek.

Stack: Fastify 5 + TypeScript + WebSockets + node-cron (backend), React 19 + Vite + Framer Motion (frontend), JSON files for persistence, Docker Compose for everything.

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
```

There is no unit test suite. Verify changes manually:
- `/?push=<id>` triggers a flow or routine.
- `POST /api/hooks/push` supports simulated schedules and `alarm`.
- `POST /api/debug/time` and `GET /api/debug/schedule` help with time and schedule debugging.
- `GET /api/debug/logs` returns recent action logs.

## Deployment target

We develop here, but production runs on **piserve**: `ssh piserve`, checkout at `~/work/girls_gamiefied_routine`, deployed with `deploy-rpi.sh`. The Pi's `backend/data.json` and `backend/state.json` hold the **live family data** (star balances, history). They have uncommitted local changes there, so never overwrite them with the dev copies, and never `git checkout`/`reset` them on the Pi. Any config or schema change must stay compatible with that existing data, or come with a migration step.

Release: `./build.sh` / `build.ps1` triggers the GitHub Actions workflow (`.github/workflows/docker-build.yml`, manual dispatch). It builds multi-arch images to `ghcr.io/nkyriazis/routine-{backend,frontend}`. On the Pi, `deploy-rpi.sh` pulls them using `docker-compose.release.yml`. Don't use dev mode on the Pi, because the polling file watchers use too much CPU.

## Architecture

### Persistence: config vs. state (backend/src/db.ts)
- **Config** lives in `data.json` (`DATA_FILE`). It holds users, tasks, routines, routineTasks, routineAssignments, flows, schedules, rewards, chores, schoolLevels, subjects and settings.timezone. `readDb()` re-reads it from disk on **every call**, so config is hot-reloadable. It is validated with AJV against `data.schema.json`. On failure, `readDb()` broadcasts `CONFIG_ERROR` and returns an empty DB.
- **Runtime state** lives in `state.json` (`STATE_FILE`) and is validated with `state.schema.json`. It holds userStars, routineExecutions, taskExecutions, spendings, starTransfers and choreInstances. It lives in memory as `globalState`, and `readDb()` merges it with the config. `writeDb()` updates `globalState` and calls `scheduleSave()`, which persists with a **10 s debounce**. `flushPendingSave()` runs on SIGINT.
- **School exercises** have separate files: `exercises.json` and `exercise-categories.json`, each with its own schema.
- **Action log**: `logAction()` appends to `logs.jsonl` (`LOGS_FILE`).
- The backend is the source of truth. Mutations go through db.ts helpers such as `awardStars`, `claimChore`/`attemptChore`/`confirmChore`/`rejectChore` and `triggerAction`, and these then call `broadcast()`.

### Real-time flow
- The initial load uses REST (`frontend/src/api.ts`). Updates arrive over WebSocket `/ws`: on connect, the server sends `SYNC_STATE`, followed by events such as `STARS_AWARDED`, `ROUTINE_START`, `ALARM_START`, `CHORE_*`, `CONFIG_UPDATED`, `CONFIG_ERROR` and `STATE_ERROR`.
- `broadcast()` sends every message to every client, with no per-user filtering. `frontend/src/context/GameContext.tsx` handles events by `message.type` and filters by userId where needed. New events must be handled there.
- Messages have the shape `{ type, payload }`.

### Scheduling (backend/src/server.ts)
- `node-cron` runs `checkSchedules()` every minute. It matches `schedules[].cron` using cron-parser in `settings.timezone` (default Europe/Athens), then calls `triggerAction(targetId)`. It also generates, expires and cleans up chore instances according to each chore's own cron.
- Flows are multi-step sequences, including alarm steps and parallel routine starts. Routines are assigned to users through `routineAssignments`.

### Backend layout
- `server.ts` holds all REST routes: `/api/*`, the `/api/admin/*` raw config/state editors plus validate and schema endpoints, uploads to `uploads/` served at `/uploads`, and the WebSocket.
- `mcp.ts` is an MCP server exposed at `/mcp` (Streamable HTTP, stateless, guarded by `MCP_API_KEY`). It provides many `registerTool` tools that read and write config and state. When you add domain features, consider adding matching MCP tools. See MCP.md.
- `school/ExerciseGenerators.ts` is a plugin registry of exercise generators, keyed by generator type (for example `arithmetic`), that produce `ExerciseContent`.
- The backend compiles with `rootDir: ".."` so it can include `../shared`. That's why the prod entry point is `dist/backend/src/server.js`.

### Frontend layout
- Routes: `/` → `Dashboard` (kid view: split-screen or grid of active routines, drawers for chores and school exercises, store) and `/parent` → `ParentDashboard` (admin, including Monaco JSON editors for config and state with schema validation).
- Shared types are imported via the `@shared` alias (see `vite.config.ts`). Vite proxies `/api`, `/ws` and `/uploads` to the backend in dev. In prod, `frontend/nginx.conf` does the same, and it needs Upgrade headers for WS.
- Component styles are usually scoped with inline `<style>` blocks inside the component.
- The PWA is set up with vite-plugin-pwa. `/api` uses a NetworkFirst cache.

### Known gaps
- `/api/admin/*` and WebSocket connections are unauthenticated.
- Uploads accept any file type.
