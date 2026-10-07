import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { Chore, DataConfig } from '../../shared/types';
import { tempDir } from './helpers';

// Chores become available on the scheduler's minute (generateChoreInstances, real clock). The clock is
// mocked here, so the same test runs against any matcher. db.ts opens the database and config named by
// the environment when it loads, so point them at a temp dir first and load it afterwards.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const chore = (id: string, availabilityCron: string): Chore =>
  ({ id, title: id, icon, defaultStars: 10, availabilityCron, expirationHours: 1 });
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'A', avatar: icon, color: 'red' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [],
  chores: [
    chore('weekdays', '0 18 * * 1-5'), // one range
    chore('four-days', '0 18 * * 1-3,5'), // what the parent form writes for Δευ Τρί Τετ Παρ
    chore('sunday-7', '0 18 * * 7'), // Sunday written as 7
    chore('broken', '61 18 * * *'), // passes the schema's pattern, not a cron
  ],
  settings: { timezone: 'Europe/Athens' }
};
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
const change = reloadConfig();
if (change?.type !== 'updated') throw new Error(`test config rejected: ${JSON.stringify(change)}`);

after(() => mock.timers.reset());

/** The chores that became available at this instant (the scheduler's tick, a few ms into the minute). */
function tickAt(iso: string): string[] {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: Date.parse(iso) + 40 });
  return db.generateChoreInstances().map(i => i.choreId).sort();
}
const cronErrors = () => db.readLastLogs(1000).filter(l => l.type === 'CHORE_CRON_ERROR');

test('a chore on a list of days and ranges becomes available on each day it names, in settings.timezone', () => {
  // 18:00 in Athens is 15:00Z (summer time until 25 October)
  assert.deepEqual(tickAt('2026-10-05T15:00:00Z'), ['four-days', 'weekdays']); // Monday
  assert.deepEqual(tickAt('2026-10-08T15:00:00Z'), ['weekdays']); // Thursday: not one of its days
  assert.deepEqual(tickAt('2026-10-09T15:00:00Z'), ['four-days', 'weekdays']); // Friday
  assert.deepEqual(tickAt('2026-10-11T15:00:00Z'), ['sunday-7']); // Sunday, written as 7
  assert.deepEqual(tickAt('2026-10-12T14:59:00Z'), []); // a minute early
});

test('a chore whose cron cannot be read is logged once, and the other chores carry on', () => {
  // The ticks of the test above count too: eight minutes, one entry
  assert.deepEqual(tickAt('2026-10-19T15:00:00Z'), ['four-days', 'weekdays']); // Monday
  tickAt('2026-10-19T15:01:00Z');
  tickAt('2026-10-19T15:02:00Z');
  const logged = cronErrors();
  assert.equal(logged.length, 1, 'one CHORE_CRON_ERROR, not one a minute');
  assert.deepEqual(logged[0].details, { choreId: 'broken', cron: '61 18 * * *', error: 'Constraint error, got value 61 expected range 0-59' });
});
