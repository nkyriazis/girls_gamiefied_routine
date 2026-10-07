import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, Exercise } from '../../shared/types';
import { tempDir } from './helpers';

// Config saves (#33): every save names the version it edited (?version=, AppState.configVersion), so a
// save over a newer one is a 409 that writes nothing, instead of the last save silently winning. Every
// save is in the action log (CONFIG_SAVED), and so is every refused stale one (CONFIG_SAVE_STALE).
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [],
  rewards: [{ id: 'park', title: 'Park', cost: 10, icon }, { id: 'tv', title: 'TV', cost: 50, icon }],
  chores: [], settings: { timezone: 'Europe/Athens' }
};
const exercises = [
  { id: 'tf', type: 'true-false', category: 'Γλώσσα', title: 'Σωστό/Λάθος', question: 'Ναι;', correctValue: true, stars: 3 }
] as Exercise[];
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises }));
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

async function post(url: string, body: unknown) {
  const res = await server.inject({ method: 'POST', url, payload: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}
const versions = async () => (await db.appState()).configVersion;
const live = (): DataConfig => JSON.parse(readFileSync(process.env.DATA_FILE!, 'utf-8'));
const newest = (type: string) => db.readLastLogs(200).find(l => l.type === type);
const withCost = (id: string, cost: number): DataConfig =>
  ({ ...live(), rewards: live().rewards.map(r => (r.id === id ? { ...r, cost } : r)) });

test('AppState carries the version of the config it carries', async () => {
  const state = await db.appState();
  assert.match(state.configVersion.data, /^[0-9a-f]{12}$/);
  assert.match(state.configVersion.exercises, /^[0-9a-f]{12}$/);
  assert.equal(state.config.rewards.length, 2);
});

test('a form save with the version it opened with saves, answers the new version and is logged', async () => {
  const opened = (await versions()).data;
  const res = await post(`/api/admin/data?version=${opened}&source=form`, withCost('park', 20));
  assert.equal(res.status, 200);
  const now = (await versions()).data;
  assert.notEqual(now, opened);
  assert.deepEqual(res.body, { success: true, version: now });
  assert.equal(live().rewards.find(r => r.id === 'park')?.cost, 20);
  assert.deepEqual(newest('CONFIG_SAVED')?.details,
    { file: 'data.json', source: 'form', route: 'POST /api/admin/data', changed: ['rewards'] });
});

test('two saves from the same version: the first saves, the second is a 409 that writes nothing', async () => {
  const opened = (await versions()).data;
  // Parent B's sheet and parent A's sheet opened on the same config
  assert.equal((await post(`/api/admin/data?version=${opened}&source=form`, withCost('tv', 70))).status, 200);
  const text = readFileSync(process.env.DATA_FILE!, 'utf-8');
  const current = (await versions()).data;

  const stale = await post(`/api/admin/data?version=${opened}&source=advanced`, { ...cfg, rewards: cfg.rewards.map(r => ({ ...r, cost: 40 })) });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.conflict, true);
  assert.match(String(stale.body.error), /^Το data\.json άλλαξε στο μεταξύ/);
  assert.equal(readFileSync(process.env.DATA_FILE!, 'utf-8'), text);
  assert.equal(live().rewards.find(r => r.id === 'tv')?.cost, 70);
  assert.deepEqual(newest('CONFIG_SAVE_STALE')?.details,
    { file: 'data.json', source: 'advanced', route: 'POST /api/admin/data', version: opened, current });
});

test('the Advanced editor (replace=1) is checked the same way', async () => {
  const opened = (await versions()).data;
  assert.equal((await post(`/api/admin/data?version=${opened}&source=form`, withCost('tv', 80))).status, 200);
  const res = await post(`/api/admin/data?replace=1&version=${opened}&source=advanced`, withCost('park', 5));
  assert.equal(res.status, 409);
  assert.equal(live().rewards.find(r => r.id === 'park')?.cost, 20);
});

test('a save with no version is not checked, and is logged as from the API', async () => {
  const res = await post('/api/admin/data', { ...live(), settings: { ...live().settings, exercisesPerDay: 4 } });
  assert.equal(res.status, 200);
  assert.deepEqual(newest('CONFIG_SAVED')?.details,
    { file: 'data.json', source: 'api', route: 'POST /api/admin/data', changed: ['settings'] });
});

test('an invalid save is still a 400', async () => {
  const res = await post(`/api/admin/data?version=${(await versions()).data}`, { ...live(), rewards: 'none' });
  assert.equal(res.status, 400);
});

test('exercises.json: the GET gives the version with the document, a stale save is a 409, a fresh one is logged', async () => {
  const got = await server.inject({ method: 'GET', url: '/api/admin/exercises' });
  const opened = got.headers['x-config-version'];
  assert.equal(opened, (await versions()).exercises);
  assert.deepEqual(got.json(), { exercises });

  const edited = { exercises: [{ ...exercises[0], stars: 4 }] };
  const res = await post(`/api/admin/exercises?replace=1&version=${opened}&source=advanced`, edited);
  assert.equal(res.status, 200);
  assert.equal(res.body.version, (await versions()).exercises);
  assert.deepEqual(newest('CONFIG_SAVED')?.details,
    { file: 'exercises.json', source: 'advanced', route: 'POST /api/admin/exercises', changed: ['exercises'] });

  const text = readFileSync(process.env.EXERCISES_FILE!, 'utf-8');
  const stale = await post(`/api/admin/exercises?replace=1&version=${opened}&source=advanced`, { exercises });
  assert.equal(stale.status, 409);
  assert.match(String(stale.body.error), /^Το exercises\.json άλλαξε στο μεταξύ/);
  assert.equal(readFileSync(process.env.EXERCISES_FILE!, 'utf-8'), text);
  assert.equal(newest('CONFIG_SAVE_STALE')?.details && (newest('CONFIG_SAVE_STALE')!.details as { file: string }).file, 'exercises.json');
});

test('an unknown source is logged as from the API', async () => {
  assert.equal((await post('/api/admin/data?source=whatever', withCost('park', 21))).status, 200);
  assert.equal((newest('CONFIG_SAVED')?.details as { source: string }).source, 'api');
});
