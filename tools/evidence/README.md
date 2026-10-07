# Evidence for a PR

A PR shows its problem and its fix on the dev stack (see "Pull requests" in CLAUDE.md): screenshots at
the kiosk size (1280×800), and videos with sound for anything that plays sound. This kit records them.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d     # the dev stack, first
tools/evidence/dev.sh problem u1 g3-world-012                             # set the scene (dev.sh lists its helpers)
tools/evidence/record.sh .evidence/52/before.mjs                          # play it: .png and .mp4 next to the scenario
```

`dev.sh` helpers (`dev/*.js`) change the dev database only: `problem <kid> <exerciseId>` sets a kid's problem
for today, fresh; `exercise <kid> <exerciseId>` puts any pool item in the slot of its category
(maths, language), fresh; `plain` makes today's plain exercises fresh; `clear-runs` takes flows and routines off screen;
`stars u1 100 u2 20` sets balances and clears those kids' pending gifts and rewards; `game u1,u2 math-mc-1,lang-tf-1`
starts a group game (📚) with those questions in one round, alone: every other game, running or finished, is removed.
`history 120` adds a busy family's purchases and gifts decided 31 to 120 days ago, older than STATE's window
(ids `cafe0000-…`), and `history undo` removes exactly those.

A scenario is a short Playwright script (`scenarios/smoke.mjs` is the smallest, `scenarios/owl-tours.mjs`
a long one). `kit.mjs` gives it `open()` (the kids' screen, past the start overlay), `tap`, `caption` (says on
the video what is shown), `listen` (waits for a clip to end), `shot` and `finish`. Write the "before"
scenario first, against master, and play the same one after the fix: the two videos then compare.

## How the sound gets in

Playwright's video has no sound. `kit.mjs` logs every clip and screen sound the page plays, with the time,
and a corner square flips every second. Web Audio tones (the alarm's built-in melody, a routine's time-up
beeps) have no file: each tone that sounds is logged with its wave, pitch and length, and `mix.sh` makes it
again with ffmpeg at the page's level. A tone started while the page may not make sound yet isn't heard, so
it isn't logged either. `mix.sh` finds the flips in the video, so it knows the video's
clock against the page's (frames come late under load), speeds the video back to the page's pace, and lays
each sound from `frontend/public` where it played. Both logs live on the Node side and the square shows the page
clock's second, so a scenario may navigate (`open()` again, `page.goto`) without losing either.

Everything runs in one image (`Dockerfile`: Playwright's, plus ffmpeg), built by `record.sh`.

## Where it goes

Per issue, `.evidence/<issue>/` (git-ignored): the scenarios, screenshots and videos. When the PR opens,
the files the PR shows are pushed to the `pr-evidence` branch under `<issue>/` and linked from the
description (`https://raw.githubusercontent.com/nkyriazis/girls_gamiefied_routine/pr-evidence/<issue>/<file>`).
The repo is public: the screens show the dev data only, never piserve's.

`publish.sh <issue>` does that (it pushes, so only when the owner says to ship), and writes
`.evidence/<issue>/PR.published.md`, the description to open the PR with.
