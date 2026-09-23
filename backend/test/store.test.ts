import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { Store } from '../src/store';
import { ChoreInstance, ExerciseSession, Spending, StateSnapshot } from '../../shared/types';
import { tempDir, uuid } from './helpers';

function openStore() {
  const file = path.join(tempDir(), 'test.db');
  return { file, store: new Store(file) };
}

test('records round-trip exactly, including optional, boolean and JSON fields', () => {
  const { store } = openStore();
  const chore: ChoreInstance = {
    id: uuid(1), choreId: 'c1', status: 'claimed', availableAt: 'a', expiresAt: 'b', claimedBy: 'u1', claimedAt: 'c'
  };
  const session: ExerciseSession = {
    id: uuid(2), playerIds: ['u1', 'u2'], categories: [], totalRounds: 2, currentRound: 1, questionsPerRound: 3,
    currentQuestionIndex: 0, exerciseIds: ['e1'], answers: { u1: [{ exerciseId: 'e1', status: 'correct', answeredAt: 'x', earnedStars: 2 }] },
    startedAt: 's', totalStarsEarned: { u1: 2 }
  };
  store.choreInstances.put(chore);
  store.exerciseSessions.put(session);
  store.taskExecutions.put({ id: uuid(3), executionId: uuid(4), taskId: 't', duration: 0, isOnTime: false, completedAt: 'z' });

  assert.deepEqual(store.choreInstances.get(uuid(1)), chore);
  assert.deepEqual(store.exerciseSessions.get(uuid(2)), session);
  assert.equal(store.taskExecutions.get(uuid(3))?.isOnTime, false);
  assert.equal(store.choreInstances.get('missing'), undefined);
});

test('put replaces, insertNew never overwrites', () => {
  const { store } = openStore();
  const spending = { id: uuid(1), userId: 'u1', rewardId: 'r', cost: 5, createdAt: 't', status: 'pending' as const };
  store.spendings.put(spending);
  store.spendings.put({ ...spending, status: 'done' });
  assert.equal(store.spendings.get(uuid(1))?.status, 'done');
  assert.equal(store.spendings.insertNew({ ...spending, status: 'revoked' }), false);
  assert.equal(store.spendings.get(uuid(1))?.status, 'done');
  assert.equal(store.spendings.count(), 1);
});

test('enrichment fields are not stored', () => {
  const { store } = openStore();
  const enriched: Spending = {
    id: uuid(1), userId: 'u1', rewardId: 'r', cost: 5, createdAt: 't', status: 'pending',
    user: { id: 'u1', name: 'A', avatar: 'x', color: 'red', stars: 3 }
  };
  store.spendings.put(enriched);
  assert.equal('user' in store.spendings.get(uuid(1))!, false);
});

test('transactions roll back on error and nest into the outer one', () => {
  const { store } = openStore();
  store.setStars('u1', 10);
  assert.throws(() => store.transaction(() => {
    store.setStars('u1', 0);
    store.transaction(() => store.setStars('u2', 5));
    throw new Error('boom');
  }), /boom/);
  assert.deepEqual(store.allStars(), { u1: 10 });
});

test('data persists across reopening the file', () => {
  const { file, store } = openStore();
  store.setStars('u1', 42);
  store.appendLog({ id: 'l1', timestamp: '2025-01-01T00:00:00.000Z', type: 'X', details: { a: 1 } });
  store.close();

  const reopened = new Store(file);
  assert.equal(reopened.getStars('u1'), 42);
  assert.deepEqual(reopened.recentLogs(10), [{ id: 'l1', timestamp: '2025-01-01T00:00:00.000Z', type: 'X', details: { a: 1 } }]);
  reopened.close();
});

test('recentLogs returns the newest entries first', () => {
  const { store } = openStore();
  for (let i = 1; i <= 5; i++) {
    store.appendLog({ id: `l${i}`, timestamp: `2025-01-0${i}T00:00:00.000Z`, type: 'X', details: null });
  }
  assert.deepEqual(store.recentLogs(3).map(l => l.id), ['l5', 'l4', 'l3']);
});

test('replaceState swaps all runtime state but keeps the log', () => {
  const { store } = openStore();
  store.setStars('old', 1);
  store.routineExecutions.put({ id: uuid(9), userId: 'old', routineId: 'r', startedAt: 's', totalStars: 0 });
  store.appendLog({ id: 'l1', timestamp: 't', type: 'X', details: null });

  const state: StateSnapshot = {
    userStars: { u1: 7 },
    routineExecutions: [{ id: uuid(1), userId: 'u1', routineId: 'r', startedAt: 's', totalStars: 7, completedAt: 'c' }],
    taskExecutions: [], spendings: [], starTransfers: [], choreInstances: [], exerciseSessions: [], exerciseAssignments: []
  };
  store.replaceState(state);
  assert.deepEqual(store.snapshot(), state);
  assert.equal(store.logs.count(), 1);
});

test('constraint violations other than a duplicate id are errors, not silently dropped', () => {
  const { store } = openStore();
  const broken = { id: uuid(1), userId: 'u1' } as unknown as Parameters<typeof store.routineExecutions.put>[0];
  assert.throws(() => store.routineExecutions.insertNew(broken), /NOT NULL/);
  assert.throws(() => store.routineExecutions.put(broken), /NOT NULL/);
});
