# Validation

Every config save (`data.json`, `exercises.json`) and every whole-state replace from Κατάσταση (JSON) is checked
against a JSON Schema (ajv, all errors reported) before anything is written. An invalid one changes nothing.

Day-to-day actions (stars, purchases, transfers, chores, exercises, routines on screen) don't go through
`state.schema.json`: they write to the database through `backend/src/db.ts`. Each route's request body is checked
against its own schema (`backend/src/bodies.ts`), and `db.ts` refuses what its rules forbid (a user or reward that
doesn't exist, a purchase or gift worth more stars than are left, a chore that isn't open). Nothing checks the
database against `state.schema.json` afterwards.

| What | Where it lives | Schema | Parent's editor |
| --- | --- | --- | --- |
| Config | `backend/data.json` | `backend/data.schema.json` | Ρυθμίσεις (the forms), Προχωρημένα → Ρυθμίσεις (JSON) |
| Group-game questions | `backend/exercises.json` | `backend/exercises.schema.json` | Προχωρημένα → Ασκήσεις (JSON) |
| Stars and history | the SQLite database, `backend/routine.db` | `backend/state.schema.json` | Προχωρημένα → Κατάσταση (JSON) |

Κατάσταση (JSON) reads and replaces the whole state in the database (`GET`/`POST /api/admin/state`), shown as a
`StateSnapshot`. No file is involved: `state.json` (legacy, imported once into the database on first start, see
CLAUDE.md «Persistence») is neither what the editor shows nor what it saves. Replacing the state replaces balances, history and whatever runs on screen; for
stars, use Σήμερα.

## In the editors

The three JSON editors (Monaco) load their schema from the server (`/api/admin/schema/data`,
`/api/admin/schema/state`, `/api/exercises/schema`) and underline errors as you type. There is one button,
Αποθήκευση. It first asks the server's validate route; if that answers `valid: false`, the errors are listed under
the editor, one `<path> <message>` per line, and nothing is saved. Otherwise it saves, and the server checks again.

The Ρυθμίσεις forms save through the same route as the JSON editor (`POST /api/admin/data`), so the same schema
applies. The forms also refuse, saying why, what the schema can't see: deleting a task a routine uses, or a routine
a schedule or flow starts.

## What the server answers

| Request | Valid | Invalid |
| --- | --- | --- |
| `POST /api/admin/validate`, `/api/admin/validate-exercises`, `/api/admin/validate-state` (check only, write nothing) | 200 `{"valid":true}` | 200 `{"valid":false,"errors":[…]}` |
| `POST /api/admin/data` (data.json) | 200 `{"success":true,"version":"…"}` | 400 `{"error":"Validation failed","errors":[…]}` |
| `POST /api/admin/exercises` (exercises.json) | 200 `{"success":true,"version":"…"}` | 400 `{"error":"Exercises validation failed: <up to 3 errors on one line>"}` |
| `POST /api/admin/state` (the database) | 200 `{"success":true,"version":"…"}` | 400 `{"error":"State validation failed","errors":[…]}` |

`errors` are ajv's error objects: `instancePath`, `schemaPath`, `keyword`, `params`, `message`. The one-line form,
`<path> <message>; …` with `(+N more)` past three, is what a parent's toast shows (`summarize` in
`backend/src/schemas.ts`).

One more refusal for the state, writing nothing:
- **409, stale** (#98): Κατάσταση (JSON) names the version it opened (`?version=`, the first 12 hex of the sha256 of
  the snapshot's JSON; `GET /api/admin/state` sends it in `X-State-Version`, the hash of exactly the text it
  returns). The server hashes the live snapshot again in the same transaction as the replace, so if anything
  changed the state since (a chore confirmed, a task done, another parent's save), the answer is 409
  `{"error":"Η κατάσταση άλλαξε στο μεταξύ …","conflict":true}`, logged as `STATE_REPLACE_STALE`, and the editor
  offers Φόρτωσε ξανά. While the kids are busy that is often: on purpose, the editor is a last resort. A save
  without `?version=` is not checked (scripts, curl).

Two more refusals for the config files, both writing nothing:
- **409, stale** (#33): a save names the version it was edited from (`?version=`, the first 12 hex of the file's
  sha256; `GET /api/admin/data` and `/api/admin/exercises` send it in `X-Config-Version`). If another screen, or a
  hand edit on disk, saved since, the answer is 409 `{"error":"Το data.json άλλαξε στο μεταξύ …","conflict":true}`
  and the editor asks to load again.
- **400 while the file on disk is invalid** (#45): a hand edit that broke `data.json` or `exercises.json` never
  replaces the live config. The last valid one keeps running, the error reaches every screen as `configError` in
  the state and `GET /api/admin/validation-status`, and saves are refused so no form writes over the file being
  fixed. Only the JSON editor may replace it (`?replace=1`); the broken file is kept beside it as
  `<file>.invalid-<stamp>`.

A hand edit on disk is in Καταγραφή (#98), as the server reloads it (within about 2 s):
`CONFIG_RELOADED {"file":"data.json","changed":["rewards"]}` (the top-level keys it changed), `CONFIG_INVALID
{"file":"data.json","message":"data.json failed schema validation: /rewards/0/cost must be integer"}` once per broken
text, and `CONFIG_RELOADED {…,"changed":[],"restored":true}` when the file goes back to the live text. The
server's own saves are `CONFIG_SAVED`; the reload at startup logs nothing.

Every other route's request body has its own schema (`backend/src/bodies.ts`, #32): a bad body is a 400
`{"error":"body/amount must be integer"}` before the handler runs.

## From the command line

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npm run test-schemas
```

`backend/test-schemas.js` checks `data.json` against its schema, then tries `state.json` (legacy, imported once; on
a checkout without one it prints an `ENOENT` error line). It prints the result and exits 0 either way, so CI only reports
it (CLAUDE.md, «CI»). `exercises.json` isn't in it; `npm test` validates the shipped exercise pools.

## Worked examples

Each was sent to the dev stack's `POST /api/admin/validate` (or `validate-state`) with today's config (or state) and
one change; the replies are copied as they came. A Αποθήκευση of the same document shows the same errors under the
editor.

**A task without `stars`** (`tasks[0]` is `t-brush`):

```json
{"valid":false,"errors":[{"instancePath":"/tasks/0","schemaPath":"#/properties/tasks/items/required","keyword":"required","params":{"missingProperty":"stars"},"message":"must have required property 'stars'"}]}
```

**An icon type that isn't `emoji` or `image`** (`"type": "invalid-type"`):

```json
{"valid":false,"errors":[{"instancePath":"/tasks/0/icon/type","schemaPath":"#/properties/tasks/items/properties/icon/properties/type/enum","keyword":"enum","params":{"allowedValues":["emoji","image"]},"message":"must be equal to one of the allowed values"}]}
```

**Negative stars** (`"stars": -10`):

```json
{"valid":false,"errors":[{"instancePath":"/tasks/0/stars","schemaPath":"#/properties/tasks/items/properties/stars/minimum","keyword":"minimum","params":{"comparison":">=","limit":0},"message":"must be >= 0"}]}
```

**A field the schema doesn't know** (`"unexpectedField": "value"` on a task):

```json
{"valid":false,"errors":[{"instancePath":"/tasks/0","schemaPath":"#/properties/tasks/items/additionalProperties","keyword":"additionalProperties","params":{"additionalProperty":"unexpectedField"},"message":"must NOT have additional properties"}]}
```

**A cron that isn't five fields** (`"cron": "invalid cron"` on `schedules[0]`): `/schedules/0/cron must match pattern
"^[\d\*\-,/]+ [\d\*\-,/]+ [\d\*\-,/]+ [\d\*\-,/]+ [\d\*\-,/]+$"`.

**A time zone without a region** (`"timezone": "Athens"`): `/settings/timezone must match pattern
"^[A-Za-z]+/[A-Za-z_]+$"`. The pattern checks the shape only: `"Invalid/Timezone"` passes.

**A negative balance**, through `validate-state` (`"userStars": {"u1": -50, …}`):

```json
{"valid":false,"errors":[{"instancePath":"/userStars/u1","schemaPath":"#/properties/userStars/patternProperties/%5E%5Ba-zA-Z0-9-_%5D%2B%24/minimum","keyword":"minimum","params":{"comparison":">=","limit":0},"message":"must be >= 0"}]}
```

**A purchase with an unknown status** (`"status": "invalid-status"` in `spendings`): `/spendings/0/status must be equal
to one of the allowed values`, `allowedValues` `["pending","done","revoked"]`.

And the saves, all refused, nothing written:
- `POST /api/admin/data` with a task missing `stars` and another at `-10`: 400 `{"error":"Validation failed","errors":[…both…]}`.
- `POST /api/admin/exercises` with an exercise missing `id` and another with an extra field: 400
  `{"error":"Exercises validation failed: /exercises/0 must have required property 'id'; /exercises/1 must NOT have additional properties"}`.
- `POST /api/admin/state` with `u1` at `-50`: 400 `{"error":"State validation failed","errors":[…]}`.
- `POST /api/admin/state?version=000000000000` with the state as `GET` returned it: 409
  `{"error":"Η κατάσταση άλλαξε στο μεταξύ (από άλλη οθόνη ή από τα παιδιά). Φόρτωσε ξανά και κάνε την αλλαγή σου πάλι.","conflict":true}`.
- `POST /api/admin/data?version=000000000000` with today's valid config: 409
  `{"error":"Το data.json άλλαξε στο μεταξύ (από άλλη οθόνη ή στον δίσκο). Φόρτωσε ξανά και κάνε την αλλαγή σου πάλι.","conflict":true}`.

## What the schemas check, and don't

- Ids: `^[a-zA-Z0-9-_]+$`. The schemas don't check that ids are unique or that a reference (a schedule's `targetId`,
  a flow's `routineId`) points at something; the forms make ids themselves and refuse deletes that would break one.
- Icons: `{"type": "emoji" | "image", "value": "<non-empty>"}`; an image's value is an uploaded file's name (or a URL).
- Cron: five space-separated fields of digits and `* - , /`.
- Flows: at least one step; a step is an `alarm` (optional `props.sound`: `"melody"`, `"beep"` or
  `{"type": "upload", "value": "<file>"}`, see CUSTOM_SOUNDS.md) or a `parallel` list of `routine` and `flow` actions.
- Schedules: `type` is `flow` or `routine`.
- State: balances are integers ≥ 0, record ids are 36 characters of lowercase hex and dashes, a purchase's status is
  `pending`, `done` or `revoked`. Timestamps are only checked to be strings.
- No unknown fields anywhere the schema lists the fields (`additionalProperties: false`).
