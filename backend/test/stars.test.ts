import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { DataConfig } from '../../shared/types';
import { tempDir } from './helpers';

// The stars invariant (#24): a balance never goes below zero, and stars promised in a pending gift
// can't be spent or taken until a parent decides on the gift.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }, { id: 'u2', name: 'Ιφιγένεια', avatar: icon, color: 'blue' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [],
  rewards: [{ id: 'park', title: 'Park', cost: 100, icon }, { id: 'tv', title: 'TV', cost: 50, icon }],
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
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
const { store, StarsError } = db;

const stars = (id: string) => store.getStars(id);
function scene(u1: number, u2 = 20) {
  store.starTransfers.deleteWhere('1');
  store.spendings.deleteWhere('1');
  store.setStars('u1', u1);
  store.setStars('u2', u2);
}
const refused = (message: RegExp) => (err: unknown) => err instanceof StarsError && err.status === 400 && message.test(err.message);

test('a purchase cannot spend stars promised in a pending gift, and nothing changes', () => {
  scene(100); db.createGift('u1', 'u2', 100);
  assert.throws(() => db.buyReward('u1', 'park'), refused(/^Ηλέκτρα: διαθέσιμα ⭐ 0 · ⭐ 100 περιμένουν σε δώρο/));
  assert.equal(stars('u1'), 100);
  assert.equal(store.spendings.count(), 0);
});

test('a parent cannot take away stars promised in a pending gift, and nothing changes', () => {
  scene(100); db.createGift('u1', 'u2', 100);
  assert.throws(() => db.takeStars('u1', 50), refused(/Απορρίψτε πρώτα το δώρο/));
  assert.equal(stars('u1'), 100);
});

test('the issue: gift, then a take-away or a purchase, then approve: nobody goes below zero', () => {
  for (const debit of [() => db.takeStars('u1', 50), () => db.buyReward('u1', 'park')]) {
    scene(100);
    const gift = db.createGift('u1', 'u2', 100);
    assert.throws(debit, StarsError);
    assert.equal(db.resolveGift(gift.id, 'approve').status, 'approved');
    assert.deepEqual([stars('u1'), stars('u2')], [0, 120]);
  }
});

test('approving a gift the sender no longer has stars for is refused, and the gift stays pending', () => {
  scene(100);
  const gift = db.createGift('u1', 'u2', 100);
  store.setStars('u1', 30); // only a whole-state write (admin state editor) can do this
  assert.throws(() => db.resolveGift(gift.id, 'approve'), refused(/^Ηλέκτρα: δεν υπάρχουν πια ⭐ 100 για αυτό το δώρο$/));
  assert.equal(store.starTransfers.get(gift.id)?.status, 'pending');
  assert.deepEqual([stars('u1'), stars('u2')], [30, 20]);
  assert.equal(db.resolveGift(gift.id, 'reject').status, 'rejected');
  assert.equal(stars('u1'), 30);
});

test('within the available stars everything still works', () => {
  scene(100);
  const gift = db.createGift('u1', 'u2', 40);
  assert.equal(db.usersView().find(u => u.id === 'u1')?.available, 60);
  assert.equal(db.takeStars('u1', 10).newTotal, 90);
  const tv = db.buyReward('u1', 'tv');
  assert.equal(stars('u1'), 40);
  assert.throws(() => db.takeStars('u1', 1), refused(/διαθέσιμα ⭐ 0/));
  assert.throws(() => db.createGift('u1', 'u2', 1), refused(/^Ηλέκτρα: διαθέσιμα ⭐ 0, χρειάζονται ⭐ 1$/));
  db.resolveGift(gift.id, 'approve');
  assert.deepEqual([stars('u1'), stars('u2')], [0, 60]);
  db.resolveSpending(tv.id, 'revoked'); // refunds
  assert.equal(stars('u1'), 50);
  assert.equal(db.awardStars('u1', 5).newTotal, 55);
});

test('awardStars only adds; taking away is takeStars', () => {
  scene(10);
  assert.throws(() => db.awardStars('u1', -5), StarsError);
  assert.throws(() => db.takeStars('u1', 0), StarsError);
  assert.throws(() => db.takeStars('nobody', 1), (err: unknown) => err instanceof StarsError && err.status === 404);
  assert.equal(db.takeStars('u1', 10).newTotal, 0);
  assert.throws(() => db.takeStars('u1', 1), refused(/^Ηλέκτρα: διαθέσιμα ⭐ 0, χρειάζονται ⭐ 1$/));
  assert.equal(stars('u1'), 0);
});

// #47: a gift whose kid left the config. Cancelling or rejecting moves no stars, so it needs neither
// kid; it releases the promised stars. Approving would move them, so it still needs both.
test('a gift to (or from) a kid no longer in the config can be cancelled or rejected, not approved', () => {
  scene(100);
  const gift = (id: string, fromUserId: string, toUserId: string) =>
    store.starTransfers.put({ id, fromUserId, toUserId, amount: 5, createdAt: new Date().toISOString(), status: 'pending' });
  const available = () => db.usersView().find(u => u.id === 'u1')?.available;
  gift('to-gone', 'u1', 'u-gone');
  assert.equal(available(), 95);
  assert.throws(() => db.resolveGift('to-gone', 'approve'), (err: unknown) => err instanceof StarsError && err.status === 404);
  assert.equal(db.resolveGift('to-gone', 'cancel').status, 'cancelled');
  assert.equal(available(), 100);
  gift('to-gone-2', 'u1', 'u-gone');
  assert.equal(db.resolveGift('to-gone-2', 'reject').status, 'rejected');
  gift('from-gone', 'u-gone', 'u2');
  assert.equal(db.resolveGift('from-gone', 'reject').status, 'rejected');
  assert.deepEqual([stars('u1'), stars('u2')], [100, 20]);
});
