import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { DataConfig } from '../../shared/types';
import { tempDir } from './helpers';

// «Ξεκίνα τώρα», /?push=<id> and POST /api/hooks/push start exactly the routine or flow named (#29).
// Simulating a minute, every schedule due in it, is /api/debug/time's job. Through server.inject,
// against this file's own data.json and database.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }, { id: 'u2', name: 'Ιφιγένεια', avatar: icon, color: 'blue' }],
  tasks: [{ id: 't1', title: 'T1', icon, stars: 10 }],
  routines: [{ id: 'r', title: 'Βραδινή', themeColor: 'red', icon }],
  routineTasks: [{ id: 'rt1', routineId: 'r', taskId: 't1', order: 1, durationSeconds: 60 }],
  routineAssignments: [{ id: 'a1', userId: 'u1', routineId: 'r' }, { id: 'a2', userId: 'u2', routineId: 'r' }],
  flows: [],
  // Both kids' evening routines at 20:00
  schedules: [
    { id: 's1', cron: '0 20 * * *', type: 'routine', targetId: 'a1' },
    { id: 's2', cron: '0 20 * * *', type: 'routine', targetId: 'a2' },
  ],
  rewards: [], settings: { timezone: 'Europe/Athens' }
};
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
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
const { store } = db;
before(() => server.ready());
beforeEach(() => {
  store.flowRuns.deleteWhere('1');
  store.routineRuns.deleteWhere('1');
  store.logs.deleteWhere('1');
});

const post = async (url: string, body: unknown) => {
  const res = await server.inject({ method: 'POST', url, payload: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
};
const running = () => store.routineRuns.all('1').map(r => r.routineId).sort();
const logged = (type: string) => store.logs.all('type = ?', type);

test('push starts the routine named, and not the other kid’s routine due at the same minute', async () => {
  const res = await post('/api/hooks/push', { id: 'a1' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, type: 'assignment', id: 'a1' });
  assert.deepEqual(running(), ['a1']);
  assert.equal(logged('SCHEDULE_MATCH').length, 0, 'a push is not a schedule');
  assert.deepEqual(logged('TRIGGER_ROUTINE').map(e => (e.details as { source: string }).source), ['push_hook']);
});

// A push never looks at its target's schedule. On master it ran that schedule's next minute, so a cron
// cron-parser can't read ('99 20 * * *', which data.schema.json lets through) made the push a 500. #89 will
// refuse such a cron in the config, so this checks the push with a readable one at another time: what
// starts, and what it answers, don't depend on the cron.
test('push starts its target now, whatever its schedule says: no simulated time, no SCHEDULE_MATCH', async () => {
  const later = { ...cfg, schedules: [{ id: 's3', cron: '30 7 * * 1', type: 'routine' as const, targetId: 'a2' }] };
  writeFileSync(path.join(dir, 'data.json'), JSON.stringify(later));
  assert.equal(reloadConfig()?.type, 'updated');
  try {
    const res = await post('/api/hooks/push', { id: 'a2' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, { success: true, type: 'assignment', id: 'a2' });
    assert.deepEqual(running(), ['a2']);
    assert.equal(logged('SCHEDULE_MATCH').length, 0);
  } finally {
    writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
    reloadConfig();
  }
});

test('a kid already in a routine keeps it: the push answers skipped, with the run on screen', async () => {
  await post('/api/hooks/push', { id: 'a1' });
  const [run] = store.routineRuns.all('1');
  const res = await post('/api/hooks/push', { id: 'a1' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { success: true, skipped: true, type: 'assignment', id: 'a1', runningId: run.id });
  assert.deepEqual(running(), ['a1']);
});

test('an unknown id is a 404 and starts nothing', async () => {
  const res = await post('/api/hooks/push', { id: 'nope' });
  assert.equal(res.status, 404);
  assert.deepEqual(running(), []);
});

test('debug/time still simulates the whole minute: every schedule due at 20:00 starts', async () => {
  const res = await post('/api/debug/time', { time: '20:00' });
  assert.equal(res.status, 200);
  assert.deepEqual(running(), ['a1', 'a2']);
  assert.equal(logged('SCHEDULE_MATCH').length, 2);
});
