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

## Pull requests

One issue per PR, kept compact, written for the owner to review from the PR page alone. Follow `.github/pull_request_template.md`: **Before** (the problem shown: screenshot, video with sound, failing test, code at file:line), **Problem**, **Fix**, **After** (the same evidence, now right), **Blast radius** (what else it touched, any manual step for piserve's live data). Capture screens on the dev stack with Playwright at the kiosk size (1280×800) and any other size the change affects; `tools/evidence/` records scenarios as screenshots and videos with sound (see its README). Before closing the issue, record the decision where the next agent will look (this file or the tool's README).

The drill, when the owner names an issue: the `issue` workflow (`.claude/workflows/issue.js`) runs it in stages, and each stops for the owner's reactions.
1. **Scope** (`{issue, stage: "scope"}`): read the issue and #51, branch `issue-<n>-<slug>`, record the Before evidence in `.evidence/<n>/`, plan, and have a critic challenge it. Show the owner the brief, the critique and the evidence; wait.
2. **Build** (`{issue, stage: "build", notes}`, with the owner's reactions verbatim): fix, After evidence from the same scenario, checks, the mark, `.evidence/<n>/PR.md`; an adversarial review and one round of fixes. Show the owner the draft; wait. More notes, build again.
3. **Ship**, only on the owner's word, from the main session: `tools/evidence/publish.sh <n>`, push the branch, `gh pr create --body-file .evidence/<n>/PR.published.md`, and comment the blast radius on the issue.

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
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend npm run lint      # check-help, check-voice, check-sound, check-gender, then eslint

# The owl's voice: record every help bubble that is new or changed, audit, list what to commit (dev machine: NVIDIA GPU, Docker)
tools/help-voice/run.sh
# The screens' sounds, rarely: fetch the CC0 packs, then choose and make the palette (see tools/sfx/README.md)
tools/sfx/fetch.sh

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

Release: `./build.sh` / `build.ps1` triggers the GitHub Actions workflow (`.github/workflows/docker-build.yml`, manual dispatch only: a push to master builds nothing). It builds multi-arch images to `ghcr.io/nkyriazis/routine-{backend,frontend}`. On the Pi, `deploy-rpi.sh` pulls them using `docker-compose.release.yml`. Don't use dev mode on the Pi, because the polling file watchers use too much CPU. The images bundle what is committed and generate nothing. The owl's voice clips (`frontend/public/help-voice/`, `src/help/voice/clips.json`) and the sounds (`frontend/public/sfx/`, `src/sound/sounds.json`) are made on the dev machine and ship as plain files in the frontend image, precached by the PWA. So after changing a help bubble, run `tools/help-voice/run.sh` and commit its output before building. `npm run check-voice` fails while a bubble has no clip.

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
- Flows and routines on screen are server state too (`flowRuns`, `routineRuns`; tables `flow_runs`, `routine_runs`). The server starts and advances them (db.ts, "ROUTINES AND FLOWS ON SCREEN"); the kids' dashboard only renders them and reports actions: dismiss an alarm, complete a task, close a routine. Those REST calls name the step/task they act on, so repeats from a second device are no-ops. A reload or a server restart resumes where it was. An alarm nobody dismisses stops after `settings.alarmMinutes` (default 60), with the rest of its flow (`expireAlarms`, every minute and at startup), so a screen opened later doesn't ring a morning alarm. An alarm already running when the page loads sits under "Click to Start" and can't sound until that click (browsers' autoplay rule), so `useAppSounds` retries on the first touch.
- The only events are the chore toasts (`CHORE_CONFIRMED/REJECTED/EXPIRED`, via `sync.notify()` and `useGame().subscribe()`). They never carry state that isn't also in `AppState`.
- Heartbeat: the server sends `HEARTBEAT` every 10 s; a client that hears nothing for 25 s drops the socket and reconnects.
- All messages are `ServerMessage` (`{ type, payload }`), sent to every client with no per-user filtering.

### Scheduling (backend/src/server.ts)
- `node-cron` runs `checkSchedules()` every minute. It matches `schedules[].cron` using cron-parser in `settings.timezone` (default Europe/Athens), then calls `triggerAction(targetId)`. It also generates, expires and cleans up chore instances according to each chore's own cron.
- Flows are multi-step sequences, including alarm steps and parallel routine starts. Routines are assigned to users through `routineAssignments`.

### Backend layout
- `server.ts` holds all REST routes: `/api/*`, the `/api/admin/*` raw config/state editors plus validate and schema endpoints, uploads to `uploads/` served at `/uploads`, and the WebSocket.
- `mcp.ts` is an MCP server exposed at `/mcp` (Streamable HTTP, stateless, guarded by `MCP_API_KEY`). It provides many `registerTool` tools that read and write config and state. When you add domain features, consider adding matching MCP tools. See MCP.md.
- `exercisePool.ts` serves the daily school exercises from `backend/exercise-pools/*.json` (validated by `exercise-pool.schema.json`, shipped in the image, not on the data volume). Each file lists the grades it serves, and a kid draws from every file listing their `grade` in data.json (none set, no exercises); `settings.exercisesPerDay` (default 3) sets how many. `npm test` validates every shipped pool and solves each problem.
- The problems are generated: `tools/problem-gen/` has problem families from the textbooks that write 500 per grade into `backend/exercise-pools/*-generated.json`, and an audit that checks them independently (equations, marks, ranges, variety). Change a family and rerun `gen.ts`; never edit the generated JSON. See its README for the Greek and realism rules.
- A `problem` exercise is a word problem in steps (tag the story's phrases as known/sought, choose, fill numbers, order), checked one step at a time by `checkProblemStep` in db.ts; the assignment stores `stepIndex` and `mistakes` per step. The group game (exercise sessions, `exercises.json`) leaves problems out.
- Two free steps: `paint` (she paints the story's words freehand; the check forgives loose strokes) and `calc` (she works it out her own way; every calculation is read back against the story's quantities and relations). Their checks live in `shared/problems.ts`, used by both server and screen. Reading is a ladder set per kid (`ConfigUser.problemReading`: `marked` taps the marked phrases, `paint` paints freehand with the unneeded facts greyed out for her, `paint-all` paints those too with a third brush); every problem plays on every rung, tag steps painting with targets derived from their marks (`targetsFromMarks`). They come from `tools/problem-gen/world/`, a world model (quantities + relations; which facts are needed is computed, not written; every other valid way to work it out is a quantity too), which writes `g-dimotikou-world.json` (200 Γ΄ problems; `audit.ts` checks them with the rest).
- The backend compiles with `rootDir: ".."` so it can include `../shared`. That's why the prod entry point is `dist/backend/src/server.js`.

### Frontend layout
- Routes: `/` → `Dashboard` (kid view: split-screen or grid of active routines, drawers for chores and school exercises, store) and `/parent` → `components/parent/ParentDashboard` (phone-first: Σήμερα with the kids' balances and what waits for a parent, Ιστορικό, Ρυθμίσεις with forms for rewards, schedules and chores, and Προχωρημένα with the Monaco JSON editors, uploads and the log). It renders `useGame()` state only; actions go through `api.ts`.
- Shared types are imported via the `@shared` alias (see `vite.config.ts`). Vite proxies `/api`, `/ws` and `/uploads` to the backend in dev. In prod, `frontend/nginx.conf` does the same, and it needs Upgrade headers for WS.
- Help (`src/help/`): an owl button plays a driver.js (MIT) tour of whatever screen is on top, on the kids' screens (`<HelpProvider>`, dressed in `help.css`). Widgets carry a named anchor (`{...help('store.balance')}`; names typed in `anchors.ts`); a screen wraps its content in `<HelpScreen tour={…} inline?>` and the most deeply nested open screen wins. Tours live next to their screen (`StoreModal.help.ts`), steps name anchors (missing widgets are skipped) and have stable keys (anchor or id). A problem's tour follows the step on screen and her rung; intros play once per kid. Played tours are server state (`help_seen` table, `AppState.helpSeen`, `POST /api/help/seen` and `/api/help/reset`, MCP `reset_help`); ids ending in `@<userId>` are a kid's own. `npm run check-help` (first thing in `npm run lint`) fails when an anchor isn't placed or explained, or a new overlay screen has no `<HelpScreen>`. When you add a widget or a screen, give it an anchor and a tour step. The owl says every bubble aloud: clips recorded at development time by `tools/help-voice/` (VoxCPM2 speaks, Whisper audits every take; see its README) ship in `public/help-voice/`, keyed by the spoken text (`src/help/speech.ts`, `voice/clips.json`; a step's `say` replaces symbols). A new or edited bubble is silent until `tools/help-voice/run.sh` records it (one command on the dev machine: records, audits, says what to commit); `npm run check-voice` (in lint) tells. The kids' screens speak the same way to every child: no «έτοιμη», «σε ποια» (use a verb, or the neuter «παιδί/παιδιά»); `npm run check-gender` (in lint) fails on gendered words in their text and speech. A new tour variant goes in `src/help/allTours.ts`.
- Sound (`src/sound/`): the kids' screens use a palette of named sounds (`sounds.json`, WAVs in `public/sfx/`, chosen from CC0 Kenney packs by `tools/sfx/`; see its README), played through Web Audio. `SoundProvider` makes every button tap by itself; an element names another sound with `{...sound('open')}` (or `sound('none')` when its handler plays its own), and outcomes are played where they happen (`sfx('correct')`, `sfx('stars')`). `npm run check-sound` (in lint) fails when something she can touch or drag makes no sound. When you add a widget, give it the sound it means.
- Component styles are usually scoped with inline `<style>` blocks inside the component.
- The PWA is set up with vite-plugin-pwa. `/api` uses a NetworkFirst cache.

### Curriculum material
- `tools/edu-materials/` mirrors the official primary-school textbooks (ebooks.edu.gr) and the Photodentro learning objects they link to into `materials/` (git- and docker-ignored, about 18 GB), and indexes them for search. `mirror.sh` runs the whole pipeline in Docker; `index.py search` finds content by grade, subject and kind (student book, workbook, teacher's book). See its README.
- `materials/` exists only on the dev machine, not on the Pi. Nothing may read it at runtime: exercises are written from it into `backend/exercise-pools/` at development time, with a `source` naming the chapter.

### Known gaps
- Follow-up: things that happen elsewhere (a parent approves stars or a reward, a chore is confirmed, rejected or expires) make no sound on the kids' screens. A sound with nothing on screen to explain it is unsettling, so the plan is a visible notification first (toast or banner, maybe also push to the parents' phones), then the palette's sound with it.
- `/api/admin/*` and WebSocket connections are unauthenticated.
- Uploads accept any file type.
