import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, Exercise } from '../../shared/types';
import { tempDir } from './helpers';

// Hand edits on disk (#98): the server reloads data.json and exercises.json when they change (stat
// polling, every 2 s). Each reload that changes a file is in the action log, CONFIG_RELOADED with the
// top-level keys it changed, and a broken edit is CONFIG_INVALID, once per bad text. The server's own
// saves (CONFIG_SAVED) and the reload at startup log nothing here.
const dir = tempDir();
const DATA = path.join(dir, 'data.json');
const EXERCISES = path.join(dir, 'exercises.json');
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [],
  rewards: [{ id: 'sweet', title: 'Γλυκό', cost: 30, icon }],
  chores: [], settings: { timezone: 'Europe/Athens' }
};
const exercises = [
  { id: 'tf', type: 'true-false', category: 'Γλώσσα', title: 'Σωστό/Λάθος', question: 'Ναι;', correctValue: true, stars: 3 }
] as Exercise[];
writeFileSync(DATA, JSON.stringify(cfg, null, 2));
writeFileSync(EXERCISES, JSON.stringify({ exercises }, null, 2));
process.env.DATA_FILE = DATA;
process.env.EXERCISES_FILE = EXERCISES;
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');

/** What the watcher does on a poll that saw a file change: reload both, log what changed. */
const poll = () => db.logConfigReload(reloadConfig());
let mark = 0;
/** The CONFIG_* entries logged since the last call, oldest first. */
function logged() {
  const entries = db.readLastLogs(200).filter(l => /^CONFIG_/.test(l.type)).reverse();
  const fresh = entries.slice(mark);
  mark = entries.length;
  return fresh.map(l => ({ type: l.type, ...(l.details as object) }));
}
const withSweet = (cost: number): DataConfig => ({ ...cfg, rewards: [{ ...cfg.rewards[0], cost }] });

test('the reload at startup logs nothing', () => {
  assert.deepEqual(logged(), []);
});

test('a hand edit of data.json is logged with the keys it changed', () => {
  writeFileSync(DATA, JSON.stringify(withSweet(35), null, 2));
  poll();
  assert.deepEqual(logged(), [{ type: 'CONFIG_RELOADED', file: 'data.json', changed: ['rewards'] }]);
});

test('a hand edit of exercises.json names that file', () => {
  writeFileSync(EXERCISES, JSON.stringify({ exercises: [{ ...exercises[0], stars: 4 }] }, null, 2));
  poll();
  assert.deepEqual(logged(), [{ type: 'CONFIG_RELOADED', file: 'exercises.json', changed: ['exercises'] }]);
});

test('the server\'s own save is CONFIG_SAVED only: the watcher\'s reload after it logs nothing', () => {
  db.writeRawConfig(withSweet(40), { source: 'form', route: 'POST /api/admin/data' });
  poll();
  assert.deepEqual(logged().map(l => l.type), ['CONFIG_SAVED']);
});

test('a broken edit is CONFIG_INVALID once, however many polls see it; a fix back to the live text is restored', () => {
  writeFileSync(DATA, '{ "users": [');
  poll();
  const [invalid, ...rest] = logged();
  assert.deepEqual(rest, []);
  assert.equal(invalid.type, 'CONFIG_INVALID');
  assert.equal((invalid as { file?: string }).file, 'data.json');
  assert.match(String((invalid as { message?: string }).message), /^data\.json is not valid JSON/);
  poll();
  // the other file changing makes the poll read the broken one again
  writeFileSync(EXERCISES, JSON.stringify({ exercises }, null, 2));
  poll();
  assert.deepEqual(logged(), [{ type: 'CONFIG_RELOADED', file: 'exercises.json', changed: ['exercises'] }]);
  // another broken text is another entry, with the schema's reason
  writeFileSync(DATA, JSON.stringify({ ...cfg, rewards: [{ ...cfg.rewards[0], cost: 'πολύ' }] }));
  poll();
  assert.deepEqual(logged(), [{
    type: 'CONFIG_INVALID', file: 'data.json',
    message: 'data.json failed schema validation: /rewards/0/cost must be integer',
  }]);
  // put back as it was: the live config never changed, so nothing did
  writeFileSync(DATA, JSON.stringify(withSweet(40), null, 2));
  poll();
  assert.deepEqual(logged(), [{ type: 'CONFIG_RELOADED', file: 'data.json', changed: [], restored: true }]);
  // the same broken text again, after the fix: logged again
  writeFileSync(DATA, '{ "users": [');
  poll();
  assert.deepEqual(logged().map(l => l.type), ['CONFIG_INVALID']);
});
