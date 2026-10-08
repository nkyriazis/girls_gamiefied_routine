# Girls Gamified Routine

A gamified routine and chore app for children, run as a kiosk-style PWA, typically on a Raspberry Pi 4. The kids'
screen shows the routines the schedules start (a morning alarm first, if a flow has one), chores, the day's school
exercises and a store where the stars they earn buy rewards. Parents run it from their phones at `/parent`. The
screens are in Greek.

How it works, and every design decision, is in [CLAUDE.md](CLAUDE.md): it is the architecture doc and is kept current
with each change. This page only gets you running.

## Run it

Everything runs in Docker; nothing is installed on the host.

```bash
# Development, hot reload: kids' screen http://localhost:5173, parents http://localhost:5173/parent,
# backend http://localhost:3000 (Vite proxies /api, /ws and /uploads to it)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production-like: the built images, nginx on port 80 (FRONTEND_PORT in .env changes it)
docker compose up --build
```

`docker compose up` without `-f` loads `docker-compose.yml` with `docker-compose.override.yml` (the production
builds). The dev file swaps those for `node:24-alpine` containers that mount `backend/` and `frontend/` and watch them.
Don't run dev mode on the Pi: the polling watchers use too much CPU.

The config lives in `backend/data.json` and `backend/exercises.json`, the stars and history in the SQLite database
`backend/routine.db`. The two config files are git-ignored (each install has its own): a new install, with an empty
database, gets them from `backend/data.example.json` and `backend/exercises.example.json` on its first start. `.env.example` lists the settings `.env` can override.

## Test, lint, build

In the running dev containers (the dependencies live there, not on the host):

```bash
dc="docker compose -f docker-compose.yml -f docker-compose.dev.yml exec"
$dc backend npm test              # backend tests (node:test)
$dc backend npm run build         # tsc
$dc backend npm run test-schemas  # the example configs, and the local ones when present, against their schemas
$dc frontend npm test             # frontend tests
$dc frontend npm run lint         # the help, voice, sound and gender checks, then eslint (0 problems)
$dc frontend npm run build        # tsc, vite build, the bundle check
```

CI: the «Checks» workflow (`.github/workflows/ci.yml`) runs these on every pull request and every push to master,
and first in every image build.

## Release and deploy to the Pi

1. Once: create a GitHub token, see [GITHUB_TOKEN.md](GITHUB_TOKEN.md).
2. On the development machine: `./build.sh` (Windows: `build.ps1`) starts the image build on GitHub Actions. It runs the
   Checks first; if one fails, nothing is built. The images are multi-arch, tagged `:latest` and
   `:sha-<first 7 of the commit>`, so an older build can be pulled back by its commit.
3. On the Pi, in its checkout: `./deploy-rpi.sh`. It backs up the data, pulls the code and the images
   (`docker-compose.release.yml`) and restarts.

Backups: the backend backs up the database, the config and the uploads every day. Until `BACKUP_DIR` in `.env` points
at a USB disk or a NAS they stay on the SD card. [BACKUP.md](BACKUP.md) says how to set the destination and restore.

## Docs

| Doc | What it covers |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Architecture, commands, decisions, the Pi; the guide for coding agents too |
| [BACKUP.md](BACKUP.md) | Daily backups, where they go, restoring one |
| [VALIDATION.md](VALIDATION.md) | How the config and state are checked against their schemas, with examples |
| [CUSTOM_SOUNDS.md](CUSTOM_SOUNDS.md) | An uploaded sound for a morning alarm |
| [GITHUB_TOKEN.md](GITHUB_TOKEN.md) | The token `build.sh` needs |
| [tools/evidence/README.md](tools/evidence/README.md) | Screenshots and videos with sound for a pull request |
| [tools/help-voice/README.md](tools/help-voice/README.md) | Recording the owl's voice |
| [tools/sfx/README.md](tools/sfx/README.md) | The screens' sound palette |
| [tools/problem-gen/README.md](tools/problem-gen/README.md) | Generating the word problems |
| [tools/edu-materials/README.md](tools/edu-materials/README.md) | The textbook mirror the exercises are written from |
| [docs/exercises-journey/](docs/exercises-journey/) | Screenshots of a school-exercise session |
| `docs/pr-14/`, `docs/pr-15/`, `docs/pr-42/` | Archived evidence of old pull requests; their scripts drive retired endpoints, don't run them |
| `.cursorrules` | The agent rules for Cursor, a copy of CLAUDE.md's |
