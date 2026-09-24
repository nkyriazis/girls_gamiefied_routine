import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { Store } from '../src/store';
import { importLegacy, verifyLegacyImport } from '../src/migrate';
import { StateSnapshot } from '../../shared/types';
import { tempDir, uuid } from './helpers';

// A state.json from an older deployment: no exerciseSessions/exerciseAssignments.
const legacyState: Omit<StateSnapshot, 'exerciseSessions' | 'exerciseAssignments'> = {
  userStars: { electra: 40, iphigenia: 25 },
  routineExecutions: [{ id: uuid(1), userId: 'electra', routineId: 'r', startedAt: 's', totalStars: 30 }],
  taskExecutions: [
    { id: uuid(2), executionId: uuid(1), taskId: 't1', duration: 12, isOnTime: true, completedAt: 'c1' },
    { id: uuid(3), executionId: uuid(1), taskId: 't2', duration: 0, isOnTime: false, completedAt: 'c2' }
  ],
  spendings: [{ id: uuid(4), userId: 'electra', rewardId: 'rw', cost: 10, createdAt: 'c', status: 'done' }],
  starTransfers: [{ id: uuid(5), fromUserId: 'iphigenia', toUserId: 'electra', amount: 5, createdAt: 'c', status: 'approved', resolvedAt: 'r' }],
  choreInstances: []
};
const logLines = [
  JSON.stringify({ id: 'log-1', timestamp: '2025-11-24T20:00:00.000Z', type: 'TASK_COMPLETE', details: { starsAwarded: 10 } }),
  JSON.stringify({ timestamp: '2025-11-24T20:01:00.000Z', type: 'NO_ID', details: {} }),
  '{"id":"log-3","timestamp":"2025-11-2', // truncated by a crash mid-append
];

function setup(state: unknown = legacyState) {
  const dir = tempDir();
  const sources = { stateFile: path.join(dir, 'state.json'), logsFile: path.join(dir, 'logs.jsonl') };
  writeFileSync(sources.stateFile, JSON.stringify(state, null, 2));
  writeFileSync(sources.logsFile, logLines.join('\n') + '\n');
  const store = new Store(path.join(dir, 'routine.db'));
  return { sources, store };
}

const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

test('imports every record, balance and log line, and verifies clean', () => {
  const { sources, store } = setup();
  const before = [hash(sources.stateFile), hash(sources.logsFile)];

  assert.equal(importLegacy(store, sources).imported, true);

  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.userStars, legacyState.userStars);
  assert.equal(snapshot.taskExecutions.length, 2);
  assert.deepEqual(snapshot.taskExecutions, legacyState.taskExecutions);
  assert.deepEqual(snapshot.exerciseSessions, []);
  assert.equal(store.logs.count(), 2);

  const v = verifyLegacyImport(store, sources);
  assert.equal(v.ok, true);
  assert.equal(v.skippedLogLines, 1);
  assert.deepEqual(v.rows.find(r => r.name === 'taskExecutions'), { name: 'taskExecutions', source: 2, db: 2, missing: 0, changed: 0 });

  // Originals are untouched
  assert.deepEqual([hash(sources.stateFile), hash(sources.logsFile)], before);
});

test('is idempotent: a second run imports nothing and never overwrites newer state', () => {
  const { sources, store } = setup();
  importLegacy(store, sources);
  store.setStars('electra', 999); // the app moved on after the import

  const second = importLegacy(store, sources);
  assert.equal(second.imported, false);
  assert.equal(store.getStars('electra'), 999);
  assert.equal(store.taskExecutions.count(), 2);
  assert.equal(store.logs.count(), 2);
});

test('lines without an id get a stable id, so re-reading them is a no-op', () => {
  const { sources, store } = setup();
  importLegacy(store, sources);
  const ids = store.logs.all().map(l => l.id);
  assert.match(ids[1], /^legacy-[0-9a-f]{32}$/);
  // A fresh database importing the same file assigns the same ids
  const other = setup().store;
  importLegacy(other, sources);
  assert.deepEqual(other.logs.all().map(l => l.id), ids);
});

test('an invalid state.json aborts the import without writing anything', () => {
  const { sources, store } = setup({ ...legacyState, userStars: { electra: 'lots' } });
  assert.throws(() => importLegacy(store, sources), /failed schema validation/);
  assert.equal(store.getMeta('legacy_import'), undefined);
  assert.equal(store.logs.count(), 0);
  assert.deepEqual(store.allStars(), {});
});

test('verification flags missing and altered records and balances', () => {
  const { sources, store } = setup();
  importLegacy(store, sources);
  store.taskExecutions.deleteWhere('id = ?', uuid(2));
  store.spendings.put({ ...legacyState.spendings[0], status: 'revoked' });
  store.setStars('iphigenia', 0);

  const v = verifyLegacyImport(store, sources);
  assert.equal(v.ok, false);
  assert.equal(v.rows.find(r => r.name === 'taskExecutions')?.missing, 1);
  assert.equal(v.rows.find(r => r.name === 'spendings')?.changed, 1);
  assert.deepEqual(v.stars.find(s => s.userId === 'iphigenia'), { userId: 'iphigenia', source: 25, db: 0 });
});

test('a fresh install without legacy files starts empty', () => {
  const dir = tempDir();
  const store = new Store(path.join(dir, 'routine.db'));
  const sources = { stateFile: path.join(dir, 'none.json'), logsFile: path.join(dir, 'none.jsonl') };
  assert.equal(importLegacy(store, sources).imported, true);
  assert.equal(verifyLegacyImport(store, sources).ok, true);
  assert.deepEqual(store.allStars(), {});
});
