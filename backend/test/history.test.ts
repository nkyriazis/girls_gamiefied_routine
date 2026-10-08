import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, HistoryEntry } from '../../shared/types';
import { tempDir, uuid } from './helpers';

// Ιστορικό reads what was decided over REST (GET /api/history, #34), a page at a time from a cursor:
// purchases, gifts, chores and finished exercises (#68), newest first, whatever their age, so STATE
// needn't carry the archive.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }, { id: 'u2', name: 'Ιφιγένεια', avatar: icon, color: 'blue' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [],
  rewards: [{ id: 'tv', title: 'TV', cost: 50, icon }],
  chores: [{ id: 'dishes', title: 'Πιάτα', icon, defaultStars: 5, availabilityCron: '0 8 * * *', expirationHours: 12 }],
  settings: { timezone: 'Europe/Athens' }
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
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
const { store } = db;

const DAY = 864e5;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const idOf = (e: HistoryEntry) =>
  (e.kind === 'spending' ? e.spending : e.kind === 'transfer' ? e.transfer : e.kind === 'chore' ? e.instance : e.assignment).id;

// 60 days of a family, across the 30-day edge of STATE: a purchase a day, a gift every other day,
// a chore every third day. Some share their time to the millisecond, so the cursor must break ties.
let n = 0;
const expected: { at: string; id: string; kids: string[] }[] = [];
for (let d = 0; d < 60; d++) {
  const kid = d % 2 ? 'u1' : 'u2', other = kid === 'u1' ? 'u2' : 'u1', at = ago(d + 0.4);
  const buy = { id: uuid(++n), userId: kid, rewardId: 'tv', cost: 50, createdAt: ago(d + 0.5), status: d % 7 ? 'done' as const : 'revoked' as const, resolvedAt: at };
  store.spendings.put(buy);
  expected.push({ at, id: buy.id, kids: [kid] });
  if (d % 2 === 0) {
    const gift = { id: uuid(++n), fromUserId: kid, toUserId: other, amount: 5, createdAt: ago(d + 0.6), status: 'approved' as const, resolvedAt: at };
    store.starTransfers.put(gift);
    expected.push({ at, id: gift.id, kids: [kid, other] });
  }
  if (d % 3 === 0) {
    const decided = ago(d + 0.3);
    const chore = { id: uuid(++n), choreId: 'dishes', status: d % 2 ? 'rejected' as const : 'confirmed' as const, availableAt: ago(d + 1),
      expiresAt: ago(d + 0.2), claimedBy: kid, ...(d % 2 ? { rejectedAt: decided } : { confirmedAt: decided, starsAwarded: 5 }) };
    store.choreInstances.put(chore);
    expected.push({ at: decided, id: chore.id, kids: [kid] });
  }
  // An exercise finished every day by each kid (#68), one of them at the very time of the purchase
  for (const [i, who] of (['u1', 'u2'] as const).entries()) {
    const done = i ? at : ago(d + 0.35), problem = who === 'u2';
    const exercise = { id: uuid(++n), userId: who, exerciseId: problem ? 'g3-gen-start-unknown-001' : 'e5-lang-paroimies-003',
      date: done.slice(0, 10), status: 'completed' as const, attempts: 2, assignedAt: ago(d + 0.7), completedAt: done, starsAwarded: problem ? 2 : 0,
      ...(problem ? { stepIndex: 5, mistakes: [1, 0, 0, 0, 0], extra: true } : { shown: [0] }) };
    store.exerciseAssignments.put(exercise);
    expected.push({ at: done, id: exercise.id, kids: [who] });
  }
}
// The same day, deliberately at the same time as day 10's purchase
expected.push({ at: expected[15].at, id: uuid(++n), kids: ['u1'] });
store.spendings.put({ id: expected[expected.length - 1].id, userId: 'u1', rewardId: 'tv', cost: 50, createdAt: ago(11), status: 'done', resolvedAt: expected[15].at });
// Never history: what still waits, and chores nobody decided on
store.spendings.put({ id: uuid(++n), userId: 'u1', rewardId: 'tv', cost: 50, createdAt: ago(90), status: 'pending' });
store.starTransfers.put({ id: uuid(++n), fromUserId: 'u1', toUserId: 'u2', amount: 5, createdAt: ago(90), status: 'pending' });
store.choreInstances.put({ id: uuid(++n), choreId: 'dishes', status: 'expired', availableAt: ago(2), expiresAt: ago(1.5) });
store.choreInstances.put({ id: uuid(++n), choreId: 'dishes', status: 'attempted', availableAt: ago(0.2), expiresAt: ago(-0.3), claimedBy: 'u1', attemptedAt: ago(0.1) });
// …and an exercise not finished, today's or a past day's left undone
store.exerciseAssignments.put({ id: uuid(++n), userId: 'u1', exerciseId: 'e5-lang-paroimies-003', date: ago(0).slice(0, 10), status: 'pending', attempts: 1, assignedAt: ago(0.1) });
store.exerciseAssignments.put({ id: uuid(++n), userId: 'u2', exerciseId: 'g3-gen-start-unknown-001', date: ago(3).slice(0, 10), status: 'pending', attempts: 0, assignedAt: ago(3) });

const newestFirst = (rows: typeof expected) => [...rows].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).map(r => r.id);

async function readAll(limit: number, userId?: string): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let before: string | undefined, pages = 0;
  for (;;) {
    const page = await db.history({ before, limit, userId });
    pages++;
    ids.push(...page.entries.map(idOf));
    if (!page.next) return { ids, pages };
    before = page.next;
    assert.ok(pages < 100, 'paging never ends');
  }
}

test('paging from the cursor gives every decision once, newest first, past the window’s edge', async () => {
  const { ids, pages } = await readAll(7);
  assert.deepEqual(ids, newestFirst(expected));
  assert.equal(pages, Math.ceil(expected.length / 7));
});

test('a page ends the list exactly: no empty page after the last full one', async () => {
  const total = expected.length;
  const { pages } = await readAll(total);
  assert.equal(pages, 1);
});

test('the kid filter keeps her purchases, the gifts she gave or got, her chores and her exercises', async () => {
  const { ids } = await readAll(10, 'u1');
  assert.deepEqual(ids, newestFirst(expected.filter(r => r.kids.includes('u1'))));
});

test('each entry is placed at the time it was decided', async () => {
  const first = (await db.history({ limit: 5 })).entries;
  assert.deepEqual(first.map(e => e.at), newestFirst(expected).slice(0, 5).map(id => expected.find(r => r.id === id)!.at));
});

test('a purchase records when it was decided, and comes first in the history then', async () => {
  store.setStars('u2', 100);
  const buy = db.buyReward('u2', 'tv');
  assert.equal(buy.resolvedAt, undefined);
  const given = db.resolveSpending(buy.id, 'done');
  assert.ok(given.resolvedAt && given.resolvedAt >= buy.createdAt);
  assert.equal(store.spendings.get(buy.id)?.resolvedAt, given.resolvedAt);
  const top = (await db.history({ limit: 1 })).entries[0];
  assert.equal(top.kind === 'spending' && top.spending.id, buy.id);
  assert.equal(top.at, given.resolvedAt);
});

test('a finished exercise is one entry, with what Ιστορικό shows of its exercise; one gone from the pools has none (#68)', async () => {
  const done = new Date().toISOString();
  const row = { id: uuid(++n), userId: 'u2', exerciseId: 'g3-gen-start-unknown-001', date: done.slice(0, 10), status: 'completed' as const,
    attempts: 9, assignedAt: done, completedAt: done, starsAwarded: 1, stepIndex: 5, mistakes: [1, 0, 0, 3, 0], extra: true, shown: [3] };
  store.exerciseAssignments.put(row);
  const [top] = (await db.history({ limit: 1, userId: 'u2' })).entries;
  assert.deepEqual(top, {
    kind: 'exercise', at: done, assignment: row,
    exercise: { title: 'Το μυστήριο της αρχής', category: 'Προβλήματα', type: 'problem', stars: 3, steps: 5 }
  });
  store.exerciseAssignments.put({ ...row, id: uuid(++n), exerciseId: 'gone-001', completedAt: new Date(Date.now() + 1000).toISOString() });
  const [gone] = (await db.history({ limit: 1, userId: 'u2' })).entries;
  assert.equal(gone.kind === 'exercise' && gone.exercise, null);
});
