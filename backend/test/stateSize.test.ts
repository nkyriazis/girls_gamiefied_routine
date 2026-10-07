import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'fs';
import path from 'path';
import { AppState, DataConfig, ServerMessage } from '../../shared/types';
import { tempDir, uuid } from './helpers';

// STATE carries the current world, never the archive (#34): everything pending whatever its age,
// purchases and gifts resolved in the last HISTORY_DAYS, and each kid's last rewards given; records
// name kids and rewards by id. This file holds the budget for STATE's history part (users, rewards,
// purchases, gifts). The other lists in AppState are bounded by their own windows (see AppState).
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [
    { id: 'u1', name: 'Ηλέκτρα', avatar: { type: 'image', value: '1763893864988-1.png' } as never, color: 'var(--color-accent)', grade: 5 },
    { id: 'u2', name: 'Ιφιγένεια', avatar: { type: 'image', value: '1763893864988-2.png' } as never, color: 'var(--color-primary)', grade: 3 },
    { id: 'u3', name: 'Τρίτο', avatar: icon, color: 'green' },
  ],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [],
  rewards: [
    { id: 'rew-tv', title: '1 Ώρα Τηλεόραση', cost: 50, icon }, { id: 'rew-sweet', title: 'Γλυκό', cost: 30, icon },
    { id: 'rew-park', title: 'Βόλτα στο Πάρκο', cost: 100, icon }, { id: 'rew-toy', title: 'Μικρό Παιχνίδι', cost: 200, icon },
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
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
const { store } = db;

const DAY = 864e5;
let n = 0;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
// A busy family: a purchase a day and a gift every other day, all resolved (piserve: ~55 records a year)
function history(fromDays: number, toDays: number) {
  for (let d = fromDays; d < toDays; d++) {
    const kid = d % 2 ? 'u1' : 'u2';
    store.spendings.put({ id: uuid(++n), userId: kid, rewardId: cfg.rewards[d % 4].id, cost: cfg.rewards[d % 4].cost,
      createdAt: ago(d + 0.5), status: d % 7 ? 'done' : 'revoked', resolvedAt: ago(d + 0.4) });
    if (d % 2 === 0) store.starTransfers.put({ id: uuid(++n), fromUserId: kid, toUserId: kid === 'u1' ? 'u2' : 'u1', amount: 5,
      createdAt: ago(d + 0.6), status: d % 10 ? 'approved' : 'rejected', resolvedAt: ago(d + 0.4) });
  }
}
const message = async (): Promise<string> => JSON.stringify({ type: 'STATE', payload: await db.appState() } satisfies ServerMessage);
const ids = (s: AppState) => [...s.spendings.map(r => r.id), ...s.starTransfers.map(r => r.id)].sort();
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
// The part of STATE this file budgets: the kids, the rewards, and the purchases and gifts that name them
const historyPart = (s: AppState) => Buffer.byteLength(JSON.stringify([s.users, s.config.rewards, s.spendings, s.starTransfers]));
const HISTORY_BUDGET = 16 * 1024;

store.setStars('u1', 100);
store.setStars('u2', 100);
// Waiting for a parent since long ago: must stay in STATE (Σήμερα, the kid's store)
const oldGift = { id: uuid(900001), fromUserId: 'u1', toUserId: 'u2', amount: 5, createdAt: ago(90), status: 'pending' as const };
const oldBuy = { id: uuid(900002), userId: 'u2', rewardId: 'rew-sweet', cost: 30, createdAt: ago(90), status: 'pending' as const };
store.starTransfers.put(oldGift);
store.spendings.put(oldBuy);
// Asked for long ago, decided last week: in the window by the day it was decided
const lateBuy = { id: uuid(900003), userId: 'u1', rewardId: 'rew-tv', cost: 50, createdAt: ago(45), status: 'done' as const, resolvedAt: ago(3) };
const lateGift = { id: uuid(900004), fromUserId: 'u2', toUserId: 'u1', amount: 5, createdAt: ago(45), status: 'rejected' as const, resolvedAt: ago(3) };
store.spendings.put(lateBuy);
store.starTransfers.put(lateGift);
// A kid whose rewards were all given long ago (12 of them, 400+ days): the newest 10 stay for her
// store's «Ιστορικό Εξαργυρώσεων», whatever their age; a revoked one doesn't count
const quietKid = Array.from({ length: 12 }, (_, i) => ({ id: uuid(800000 + i), userId: 'u3', rewardId: 'rew-sweet', cost: 30,
  createdAt: ago(400 + i), status: 'done' as const, resolvedAt: ago(400 + i) }));
quietKid.forEach(s => store.spendings.put(s));
store.spendings.put({ id: uuid(800100), userId: 'u3', rewardId: 'rew-sweet', cost: 30, createdAt: ago(399), status: 'revoked', resolvedAt: ago(399) });

let month = '', monthIds: string[] = [], year = '', threeYears = '';
before(async () => {
  history(0, 30);
  month = await message();
  monthIds = ids(JSON.parse(month).payload);
  history(30, 365);
  year = await message();
  history(365, 3 * 365);
  threeYears = await message();
  const last: AppState = JSON.parse(threeYears).payload;
  console.log(`STATE with 30 days of history: ${kb(Buffer.byteLength(month))} (${monthIds.length} records)`);
  console.log(`STATE with 1 year:            ${kb(Buffer.byteLength(year))}`);
  console.log(`STATE with 3 years:           ${kb(Buffer.byteLength(threeYears))} (${ids(last).length} records)`);
  console.log(`its history part (users, rewards, purchases, gifts): ${kb(historyPart(last))} (budget ${kb(HISTORY_BUDGET)})`);
});

test('a pending gift or purchase is in STATE whatever its age', async () => {
  const state: AppState = JSON.parse(threeYears).payload;
  assert.ok(state.starTransfers.some(t => t.id === oldGift.id), 'the 90-day-old pending gift');
  assert.ok(state.spendings.some(s => s.id === oldBuy.id), 'the 90-day-old pending purchase');
});

test('a purchase or gift decided in the window is in STATE, however long ago it was asked for', async () => {
  const state: AppState = JSON.parse(threeYears).payload;
  assert.ok(state.spendings.some(s => s.id === lateBuy.id), 'the purchase asked 45 days ago, given 3 days ago');
  assert.ok(state.starTransfers.some(t => t.id === lateGift.id), 'the gift asked 45 days ago, rejected 3 days ago');
});

test('a kid’s last 10 rewards given stay in STATE whatever their age', async () => {
  const state: AppState = JSON.parse(threeYears).payload;
  const hers = state.spendings.filter(s => s.userId === 'u3').map(s => s.id).sort();
  assert.deepEqual(hers, quietKid.slice(0, 10).map(s => s.id).sort());
});

test('history older than the window does not ride along in STATE', async () => {
  // Three more years of resolved history change nothing in what STATE carries
  assert.deepEqual(ids(JSON.parse(threeYears).payload), monthIds.concat().sort());
});

test('records carry ids, not copies of the kids and the reward', async () => {
  const state: AppState = JSON.parse(month).payload;
  const embedded = [...state.spendings, ...state.starTransfers].filter(r => 'user' in r || 'reward' in r || 'fromUser' in r || 'toUser' in r);
  assert.equal(embedded.length, 0, `${embedded.length} records embed a user or reward`);
});

test('STATE’s history part from three years of busy history stays within its budget', async () => {
  const size = historyPart(JSON.parse(threeYears).payload);
  assert.ok(size < HISTORY_BUDGET, `users, rewards, purchases and gifts take ${kb(size)} of STATE`);
});
