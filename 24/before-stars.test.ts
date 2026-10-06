import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { DataConfig } from '../../shared/types';
import { tempDir } from './helpers';

// Red cases for #24, against master's API: a balance must never go below the stars promised in pending gifts.
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
const { store } = db;

const stars = (id: string) => store.getStars(id);
function scene(u1: number, u2 = 20) {
  store.starTransfers.deleteWhere('1');
  store.spendings.deleteWhere('1');
  store.setStars('u1', u1);
  store.setStars('u2', u2);
}
function gift(amount: number) {
  const t = { id: `g${Math.random()}`, fromUserId: 'u1', toUserId: 'u2', amount, createdAt: new Date().toISOString(), status: 'pending' as const };
  store.starTransfers.put(t);
  return t;
}

test('a purchase cannot spend stars promised in a pending gift', () => {
  scene(100); gift(100);
  assert.equal(db.trySpendStars('u1', 100), null);
  assert.equal(stars('u1'), 100);
});

test('a parent cannot take away stars promised in a pending gift', () => {
  scene(100); gift(100);
  assert.throws(() => db.awardStars('u1', -50));
  assert.equal(stars('u1'), 100);
});

test('gift, take-away, approve: the sender never goes below zero', () => {
  scene(100); const t = gift(100);
  try { db.awardStars('u1', -50); } catch { /* refused: fine */ }
  // what PUT /api/transfers/:id { action: 'approve' } does
  db.adjustUserStars(t.fromUserId, -t.amount);
  db.adjustUserStars(t.toUserId, t.amount);
  assert.ok(stars('u1') >= 0, `u1 at ${stars('u1')}`);
});
