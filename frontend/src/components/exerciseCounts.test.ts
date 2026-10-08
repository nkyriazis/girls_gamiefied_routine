// npm test (frontend): the ✏️ badge and the exercises drawer count the same thing (#47)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyCount, waitingCount, kidsShown, pillText } from './exerciseCounts.ts';

type A = { userId: string; status: 'pending' | 'completed'; extra?: boolean };
const a = (userId: string, status: A['status'], extra = false): A => ({ userId, status, ...(extra ? { extra } : {}) });
const kids = [{ id: 'u1', grade: 5 }, { id: 'u2', grade: 3 }, { id: 'u3' }];

test('the badge counts the daily set still to do; an extra problem left pending is apart', () => {
  const today = [a('u1', 'pending'), a('u1', 'pending'), a('u1', 'completed'), a('u1', 'pending', true), a('u2', 'completed', true)];
  assert.equal(waitingCount(today), 2);
  assert.deepEqual(dailyCount(today, 'u1'), { total: 3, done: 1, waiting: 2 });
  assert.equal(pillText(dailyCount(today, 'u1')), '1 / 3');
});

test('a kid with no set today gets no «Όλα έτοιμα!»', () => {
  const today = [a('u1', 'completed'), a('u1', 'completed')];
  assert.equal(pillText(dailyCount(today, 'u1')), 'Όλα έτοιμα! 🎉');
  assert.equal(pillText(dailyCount(today, 'u2')), 'Καμία άσκηση σήμερα');
});

test('a kid is drawn with a set today, or with a grade while extras are allowed', () => {
  assert.deepEqual(kidsShown(kids, [a('u3', 'pending')], 10).map(k => k.id), ['u1', 'u2', 'u3']);
  assert.deepEqual(kidsShown(kids, [], 10).map(k => k.id), ['u1', 'u2']);
  assert.deepEqual(kidsShown(kids, [a('u1', 'completed', true)], 0).map(k => k.id), []);
});

test('a kid with an extra problem left pending stays, even with no grade or no extras allowed now (#67)', () => {
  // A parent set the limit to 0, or cleared her class, mid-day: her set-aside cards are still hers
  assert.deepEqual(kidsShown(kids, [a('u1', 'pending', true)], 0).map(k => k.id), ['u1']);
  assert.deepEqual(kidsShown(kids, [a('u3', 'pending', true)], 0).map(k => k.id), ['u3']);
  // The badge still counts the daily set only
  assert.equal(waitingCount([a('u3', 'pending', true)]), 0);
});
