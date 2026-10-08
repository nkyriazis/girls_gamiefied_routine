import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, StateSnapshot } from '../../shared/types';
import { tempDir, uuid } from './helpers';

// State saves (#98): the Κατάσταση (JSON) editor replaces the whole runtime state. Its version is the hash
// of the snapshot the GET returned (X-State-Version), so a save from an editor opened before anything else
// changed the state (a chore confirmed, a task done) is a 409 that writes nothing, instead of silently
// undoing it. Every save is logged with what it changed (STATE_REPLACED), every refused one too.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }, { id: 'u2', name: 'Ιφιγένεια', avatar: icon, color: 'blue' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [],
  rewards: [{ id: 'park', title: 'Park', cost: 10, icon }],
  chores: [], settings: { timezone: 'Europe/Athens' }
};
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises: [] }));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require('../src/server') as typeof import('../src/server');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
before(() => server.ready());
const { store } = db;

const EMPTY: StateSnapshot = {
  userStars: {}, routineExecutions: [], taskExecutions: [], spendings: [], starTransfers: [],
  choreInstances: [], exerciseSessions: [], exerciseAssignments: []
};
/** u1 ⭐ 100, u2 ⭐ 20, two purchases, nothing on screen. The purchases go in against their ids' order
 * (uuid(2) first), so a snapshot sorted by id, or by anything but insertion, comes out in another order. */
function scene() {
  store.replaceState({
    ...EMPTY,
    userStars: { u1: 100, u2: 20 },
    spendings: [
      { id: uuid(2), userId: 'u2', rewardId: 'park', cost: 10, createdAt: '2026-10-01T11:00:00.000Z', status: 'pending' },
      { id: uuid(1), userId: 'u1', rewardId: 'park', cost: 10, createdAt: '2026-10-01T10:00:00.000Z', status: 'pending' },
    ],
  });
}

/** What the editor does when it opens: GET the snapshot and its version. */
async function open() {
  const res = await server.inject({ method: 'GET', url: '/api/admin/state' });
  const version = res.headers['x-state-version'];
  // Every test compares versions: a missing header would make two undefineds equal and the test pass on nothing.
  assert.equal(typeof version, 'string');
  assert.match(version as string, /^[0-9a-f]{12}$/);
  return { text: res.body, state: res.json() as StateSnapshot, version: version as string };
}
async function save(url: string, body: unknown) {
  const res = await server.inject({ method: 'POST', url, payload: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}
const newest = (type: string) => db.readLastLogs(200).find(l => l.type === type); // newest first
const count = (type: string) => db.readLastLogs(200).filter(l => l.type === type).length;

test('GET sends the version of exactly what it returns, and an untouched state keeps it', async () => {
  scene();
  const first = await open();
  assert.match(first.version, /^[0-9a-f]{12}$/);
  assert.equal(first.version, createHash('sha256').update(first.text).digest('hex').slice(0, 12));
  const again = await open();
  assert.equal(again.text, first.text);
  assert.equal(again.version, first.version);
});

test('the snapshot is in a fixed order: updating a record does not move it', async () => {
  scene();
  const opened = await open();
  // The first one inserted: a write that moved it (delete and insert again) would put it last
  const first = store.spendings.get(uuid(2))!;
  store.spendings.put({ ...first, status: 'done', resolvedAt: '2026-10-02T10:00:00.000Z' });
  store.spendings.put(first); // back as it was
  store.setStars('u1', 100); // the same balance, written again
  const now = await open();
  assert.deepEqual(now.state.spendings.map(s => s.id), [uuid(2), uuid(1)]); // as inserted, not by id
  assert.equal(now.version, opened.version);
});

test('things outside the snapshot do not move the version: tours played, the log, a routine on screen', async () => {
  scene();
  const opened = await open();
  db.markHelpSeen(['store@u1']);
  db.logAction('X', { a: 1 });
  store.routineRuns.put({ id: uuid(9), userId: 'u1', routineId: 'r', taskIndex: 0, taskStartedAt: '2026-10-01T10:00:00.000Z' });
  assert.equal((await open()).version, opened.version);
  store.routineRuns.deleteWhere('1');
});

test('saving what was opened answers the same version, and the log says nothing changed', async () => {
  scene();
  const opened = await open();
  const res = await save(`/api/admin/state?version=${opened.version}&source=advanced`, opened.state);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, version: opened.version });
  assert.deepEqual(newest('STATE_REPLACED')?.details,
    { source: 'advanced', stars: {}, changed: [], cleared: { flowRuns: 0, routineRuns: 0 } });
});

test('the issue: a chore confirmed after the editor opened makes its save a 409 that writes nothing', async () => {
  scene();
  const opened = await open();
  // Parent B confirms Ηλέκτρα's chore on a phone: she gets its stars
  db.awardStars('u1', 20);
  const current = (await open()).version;
  assert.notEqual(current, opened.version);
  // Parent A changes Ιφιγένεια's balance in the editor that still says 100 for Ηλέκτρα
  const stale = await save(`/api/admin/state?version=${opened.version}&source=advanced`,
    { ...opened.state, userStars: { ...opened.state.userStars, u2: 25 } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.conflict, true);
  assert.equal(stale.body.error,
    'Η κατάσταση άλλαξε στο μεταξύ (από άλλη οθόνη ή από τα παιδιά). Φόρτωσε ξανά και κάνε την αλλαγή σου πάλι.');
  assert.deepEqual(db.stateSnapshot().userStars, { u1: 120, u2: 20 });
  assert.equal((await open()).version, current);
  assert.deepEqual(newest('STATE_REPLACE_STALE')?.details, { source: 'advanced', version: opened.version, current });
});

test('after reloading, the same change saves, and the log lists the balances it moved and what it ended', async () => {
  scene();
  store.flowRuns.put({ id: uuid(8), flowId: 'f', steps: [], stepIndex: 0, startedAt: '2026-10-01T10:00:00.000Z' });
  store.routineRuns.put({ id: uuid(9), userId: 'u1', routineId: 'r', taskIndex: 0, taskStartedAt: '2026-10-01T10:00:00.000Z' });
  const opened = await open();
  // u2 20 → 25, u1 left out (→ 0), u3 new (0 → 5), and a purchase given
  const edited: StateSnapshot = {
    ...opened.state,
    userStars: { u2: 25, u3: 5 },
    spendings: opened.state.spendings.map(s => (s.id === uuid(1) ? { ...s, status: 'done' as const } : s)),
  };
  const res = await save(`/api/admin/state?version=${opened.version}&source=advanced`, edited);
  assert.equal(res.status, 200);
  assert.equal(res.body.version, (await open()).version);
  assert.notEqual(res.body.version, opened.version);
  assert.deepEqual(db.stateSnapshot(), edited);
  assert.deepEqual(newest('STATE_REPLACED')?.details, {
    source: 'advanced',
    stars: { u1: [100, 0], u2: [20, 25], u3: [0, 5] },
    changed: ['userStars', 'spendings'],
    cleared: { flowRuns: 1, routineRuns: 1 },
  });
  assert.equal(store.flowRuns.count(), 0);
  assert.equal(store.routineRuns.count(), 0);
});

test('a save without a version is not checked (scripts, curl), and is logged as api', async () => {
  scene();
  const opened = await open();
  db.awardStars('u1', 5);
  const before = count('STATE_REPLACE_STALE');
  const res = await save('/api/admin/state', { ...opened.state, userStars: { u1: 100, u2: 30 } });
  assert.equal(res.status, 200);
  assert.deepEqual(db.stateSnapshot().userStars, { u1: 100, u2: 30 });
  assert.equal(count('STATE_REPLACE_STALE'), before);
  assert.deepEqual(newest('STATE_REPLACED')?.details,
    { source: 'api', stars: { u1: [105, 100], u2: [20, 30] }, changed: ['userStars'], cleared: { flowRuns: 0, routineRuns: 0 } });
});

test('an invalid state is refused before the version is looked at, and writes nothing', async () => {
  scene();
  const opened = await open();
  const res = await save(`/api/admin/state?version=${opened.version}`, { ...opened.state, userStars: { u1: -50 } });
  assert.equal(res.status, 400);
  assert.equal((await open()).version, opened.version);
});
