import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig } from '../../shared/types';
import { tempDir } from './helpers';

// A cron the scheduler can't read (#89): «99 20 * * *» passes data.schema.json's pattern, but cron.ts can't read
// it, so the schedule never fires and the chore never appears. A save that brings one in is refused like a
// schema error; one already in the file on disk still loads (piserve's live file must keep loading), and is
// a warning the parents' page shows. A save that leaves it as it is still saves; fixing it clears it.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [],
  schedules: [
    { id: 'sch-morning', cron: '0 7 * * 1-5', type: 'flow', targetId: 'alarm' },
    { id: 'sch-evening', cron: '30 20 * * *', type: 'flow', targetId: 'alarm' },
  ],
  rewards: [{ id: 'park', title: 'Park', cost: 10, icon }],
  chores: [
    { id: 'dishes', title: 'Πιάτα', icon, defaultStars: 10, availabilityCron: '0 18 * * *', expirationHours: 4 },
    { id: 'plants', title: 'Λουλούδια', icon, defaultStars: 5, availabilityCron: '0 9 * * *', expirationHours: 4 },
  ],
  settings: { timezone: 'Europe/Athens' }
};
const DATA = path.join(dir, 'data.json');
writeFileSync(DATA, JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises: [] }));
process.env.DATA_FILE = DATA;
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig, configError, config } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server, checkSchedules } = require('../src/server') as typeof import('../src/server');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
before(() => server.ready());

async function post(url: string, body: unknown) {
  const res = await server.inject({ method: 'POST', url, payload: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}
const live = (): DataConfig => JSON.parse(readFileSync(DATA, 'utf-8'));
const withCron = (data: DataConfig, id: string, cron: string): DataConfig => ({
  ...data,
  schedules: data.schedules.map(s => (s.id === id ? { ...s, cron } : s)),
  chores: (data.chores ?? []).map(c => (c.id === id ? { ...c, availabilityCron: cron } : c)),
});
const warnings = async () => (await db.appState()).configWarnings.map(w => `${w.path} ${'cron' in w ? w.cron : w.value}`);
const logged = (type: string) => db.readLastLogs(200).filter(l => l.type === type);

test('a save that brings in an unreadable cron is a 400 naming the field, and writes nothing', async () => {
  const text = readFileSync(DATA, 'utf-8');
  for (const [id, cron, field] of [['sch-evening', '99 20 * * *', '/schedules/1/cron'], ['dishes', '0 25 * * *', '/chores/0/availabilityCron']]) {
    const res = await post('/api/admin/data?source=form', withCron(live(), id, cron));
    assert.equal(res.status, 400, cron);
    assert.ok(String(res.body.error).includes(field), String(res.body.error));
    assert.ok(String(res.body.error).includes(`«${cron}»`), String(res.body.error));
  }
  assert.equal(readFileSync(DATA, 'utf-8'), text);
});

test("the Advanced editor's pre-check lists it like a schema error", async () => {
  const res = await post('/api/admin/validate', withCron(withCron(live(), 'sch-evening', '5-1 * * * *'), 'plants', '61 18 * * *'));
  assert.equal(res.body.valid, false);
  assert.deepEqual((res.body.errors as { instancePath: string }[]).map(e => e.instancePath), ['/schedules/1/cron', '/chores/1/availabilityCron']);
  assert.deepEqual((await post('/api/admin/validate', live())).body, { valid: true, warnings: [] });
});

test('a data.json on disk with unreadable crons still loads, and says which ones', async () => {
  writeFileSync(DATA, JSON.stringify(withCron(withCron(cfg, 'sch-evening', '99 20 * * *'), 'dishes', '0 25 * * *'), null, 2));
  assert.equal(reloadConfig()?.type, 'updated');
  assert.equal(configError(), null);
  assert.equal(config().schedules[1].cron, '99 20 * * *'); // live, as it is
  const state = await db.appState();
  assert.deepEqual(state.configWarnings.map(w => ('cron' in w ? { ...w, error: typeof w.error } : w)), [
    { path: '/schedules/1/cron', kind: 'schedule', id: 'sch-evening', cron: '99 20 * * *', error: 'string',
      message: `Το πρόγραμμα «sch-evening» δεν θα ξεκινά: η ώρα (cron) «99 20 * * *» δεν διαβάζεται (${(state.configWarnings[0] as { error: string }).error})` },
    { path: '/chores/0/availabilityCron', kind: 'chore', id: 'dishes', cron: '0 25 * * *', error: 'string',
      message: `Η δουλειά «Πιάτα» δεν θα εμφανίζεται: η ώρα (cron) «0 25 * * *» δεν διαβάζεται (${(state.configWarnings[1] as { error: string }).error})` },
  ]);
  const status = (await server.inject({ method: 'GET', url: '/api/admin/validation-status' })).json();
  assert.equal(status.config, null);
  assert.deepEqual(status.warnings, state.configWarnings);
});

test('while they are live, a save that leaves them as they are saves', async () => {
  const res = await post('/api/admin/data?source=form', { ...live(), rewards: [{ ...cfg.rewards[0], cost: 20 }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(live().rewards[0].cost, 20);
  assert.equal(live().schedules[1].cron, '99 20 * * *');
  assert.deepEqual(await warnings(), ['/schedules/1/cron 99 20 * * *', '/chores/0/availabilityCron 0 25 * * *']);
  // the editor's pre-check: valid, with the live ones as warnings
  const check = (await post('/api/admin/validate', live())).body;
  assert.equal(check.valid, true);
  assert.deepEqual((check.warnings as { path: string }[]).map(w => w.path), ['/schedules/1/cron', '/chores/0/availabilityCron']);
});

test('but changing one to another unreadable cron, or adding one more, is refused', async () => {
  const text = readFileSync(DATA, 'utf-8');
  assert.equal((await post('/api/admin/data', withCron(live(), 'sch-evening', '5-1 * * * *'))).status, 400);
  assert.equal((await post('/api/admin/data', withCron(live(), 'plants', '61 18 * * *'))).status, 400);
  assert.equal(readFileSync(DATA, 'utf-8'), text);
});

test('the scheduler logs an unreadable cron once per schedule or chore and cron, not every minute', async () => {
  for (let i = 0; i < 3; i++) await checkSchedules(new Date());
  assert.deepEqual(logged('SCHEDULE_CRON_ERROR').map(l => (l.details as { scheduleId: string; cron: string })).map(d => `${d.scheduleId} ${d.cron}`),
    ['sch-evening 99 20 * * *']);
  assert.equal(logged('CHORE_CRON_ERROR').length, 1);
  assert.equal(logged('SCHEDULE_ERROR').length, 0); // that one is for a schedule that matched and failed to start
});

test('fixing them saves and clears the warnings', async () => {
  const res = await post('/api/admin/data?source=form', withCron(withCron(live(), 'sch-evening', '30 20 * * *'), 'dishes', '0 18 * * *'));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(await warnings(), []);
});

test("the form's raw cron field asks the server, which reads it as the scheduler does", async () => {
  assert.equal((await post('/api/admin/validate-cron', { cron: '0 7 * * 1-5' })).body.error, null);
  for (const cron of ['5-1 * * * *', '0 25 * * *', '0 0 31 2 *', '@daily', '0 7 * *']) {
    const { status, body } = await post('/api/admin/validate-cron', { cron });
    assert.equal(status, 200);
    assert.equal(typeof body.error, 'string', cron);
  }
  assert.equal((await post('/api/admin/validate-cron', { cron: 5 })).status, 400);
});
