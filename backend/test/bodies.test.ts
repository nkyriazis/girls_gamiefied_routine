import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { ChoreInstance, DataConfig, Exercise } from '../../shared/types';
import { tempDir, uuid } from './helpers';

// Request bodies (#32): every route that reads a body checks its shape first (bodies.ts). A bad body is a
// 400 { error } and changes nothing; every body the screens send (api.ts) still passes. The routes are
// called through server.inject, against this file's own data.json and database.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'Ηλέκτρα', avatar: icon, color: 'red' }, { id: 'u2', name: 'Ιφιγένεια', avatar: icon, color: 'blue' }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [],
  rewards: [{ id: 'park', title: 'Park', cost: 10, icon }],
  chores: [{ id: 'dishes', title: 'Πλύσιμο Πιάτων', icon, defaultStars: 10, availabilityCron: '0 18 * * *', expirationHours: 4 }],
  settings: { timezone: 'Europe/Athens' }
};
const exercises = [
  { id: 'mc', type: 'multiple-choice', category: 'Μαθηματικά', title: 'Πρόσθεση', question: '12 + 15;', options: ['25', '27'], correctIndex: 1, stars: 5 },
  { id: 'tf', type: 'true-false', category: 'Γλώσσα', title: 'Σωστό/Λάθος', question: 'Ναι;', correctValue: true, stars: 3 }
] as Exercise[];
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises }));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require('../src/server') as typeof import('../src/server');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
const { store } = db;
before(() => server.ready());

const HOUR = 3_600_000;
const CHORE = uuid(1);
const AVAILABLE = uuid(2);
const ASSIGNMENT = uuid(3);
const GAME = uuid(4);

/** A fresh scene: u1 ⭐ 100 and u2 ⭐ 20, her dishes done and waiting for a parent, a chore free to claim,
 *  her daily exercise (a pool item) not answered yet, and a running group game. */
function scene() {
  store.replaceState({
    userStars: { u1: 100, u2: 20 }, routineExecutions: [], taskExecutions: [], spendings: [], starTransfers: [],
    choreInstances: [], exerciseSessions: [], exerciseAssignments: []
  });
  const now = Date.now();
  const instance = (id: string, extra: Partial<ChoreInstance>): ChoreInstance => ({
    id, choreId: 'dishes', status: 'available',
    availableAt: new Date(now - HOUR).toISOString(), expiresAt: new Date(now + HOUR).toISOString(), ...extra
  });
  store.choreInstances.put(instance(CHORE, { status: 'attempted', claimedBy: 'u1', claimedAt: new Date(now).toISOString(), attemptedAt: new Date(now).toISOString() }));
  store.choreInstances.put(instance(AVAILABLE, {}));
  store.exerciseAssignments.put({
    id: ASSIGNMENT, userId: 'u1', exerciseId: 'g2-math-mult-1', date: new Date(now).toISOString().slice(0, 10),
    status: 'pending', attempts: 0, assignedAt: new Date(now).toISOString()
  });
  store.exerciseSessions.put({
    id: GAME, playerIds: ['u1', 'u2'], categories: [], totalRounds: 1, currentRound: 1, questionsPerRound: 2,
    currentQuestionIndex: 0, exerciseIds: ['mc', 'tf'], answers: { u1: [], u2: [] },
    startedAt: new Date(now).toISOString(), totalStarsEarned: { u1: 0, u2: 0 }
  });
}

/** Everything a request could change: the runtime state and the help tours played. */
const world = () => JSON.stringify({ state: db.stateSnapshot(), help: store.helpSeen.count() });

/** A request as a screen or a script sends it: `body` is the raw JSON text, or nothing at all. */
async function call(method: 'POST' | 'PUT', url: string, body?: string) {
  const res = await server.inject(body === undefined
    ? { method, url }
    : { method, url, payload: body, headers: { 'content-type': 'application/json' } });
  return { status: res.statusCode, body: res.json() as { error?: unknown } & Record<string, unknown> };
}

/** Refused with a reason, and nothing changed. */
async function refused(method: 'POST' | 'PUT', url: string, body: string | undefined, status = 400, error?: RegExp) {
  scene();
  const was = world();
  const res = await call(method, url, body);
  const what = `${method} ${url} ${body ?? '(no body)'}`;
  assert.equal(res.status, status, `${what}: ${JSON.stringify(res.body)}`);
  assert.equal(typeof res.body.error, 'string', `${what}: ${JSON.stringify(res.body)}`);
  if (error) assert.match(res.body.error as string, error, what);
  assert.equal(world(), was, `${what} changed the state`);
}

const confirm = `/api/chores/${CHORE}/confirm`;
const game = (rounds: unknown, perRound: unknown, playerIds: unknown = ['u1', 'u2']) =>
  JSON.stringify({ playerIds, categories: [], totalRounds: rounds, questionsPerRound: perRound });

test('a missing body is a 400, never a TypeError or a 500', async () => {
  for (const [method, url] of [
    ['POST', '/api/transfers'], ['PUT', '/api/transfers/x'], ['POST', '/api/spendings'], ['PUT', '/api/spendings/x'],
    ['POST', `/api/chores/${AVAILABLE}/claim`], ['POST', '/api/chores/x/claim'],
    ['POST', '/api/users/u1/stars'], ['POST', '/api/exercise-assignments/extra'], ['POST', `/api/exercise-assignments/${ASSIGNMENT}/answer`],
    ['POST', `/api/exercises/sessions/${GAME}/answer`], ['POST', '/api/exercises/sessions'], ['POST', '/api/help/seen'],
    ['POST', '/api/hooks/push'], ['POST', '/api/debug/time'], ['POST', '/api/admin/validate-cron'],
  ] as const) await refused(method, url, undefined, 400, /^body must be object$/);
});

test('numbers are numbers: "5", "abc" and true are refused, not coerced', async () => {
  await refused('POST', '/api/users/u1/stars', '{"amount":"5"}', 400, /^body\/amount must be integer$/);
  await refused('POST', '/api/users/u1/stars', '{"amount":true}');
  await refused('POST', '/api/transfers', '{"fromUserId":"u2","toUserId":"u1","amount":"abc"}', 400, /^body\/amount must be integer$/);
  await refused('POST', '/api/transfers', '{"fromUserId":"u2","toUserId":"u1","amount":"5"}');
  await refused('POST', '/api/debug/time', '{"time":5}', 400, /^body\/time must be string$/);
  await refused('POST', '/api/hooks/push', '{"id":5}');
  await refused('POST', '/api/exercise-assignments/extra', '{"userId":5}');
});

test('a chore confirm pays a whole number of stars, 0 or more, or is refused and the chore stays waiting', async () => {
  for (const stars of ['"abc"', '"20"', '-5', '0.5', 'true', 'null']) {
    await refused('POST', confirm, `{"stars":${stars}}`);
  }
  // db.ts keeps its own guard, for a caller that isn't a route
  scene();
  assert.throws(() => db.confirmChore(CHORE, 'abc' as unknown as number), db.StarsError);
  assert.throws(() => db.confirmChore(CHORE, -5), db.StarsError);
  assert.equal(store.choreInstances.get(CHORE)?.status, 'attempted');
  assert.equal(store.getStars('u1'), 100);
});

test('a parent\'s stars: a whole number, not 0, with a reason she can read', async () => {
  await refused('POST', '/api/users/u1/stars', '{"amount":0}', 400, /^amount must be a non-zero integer$/);
  await refused('POST', '/api/users/u1/stars', '{"amount":2.5}');
});

test('gifts and rewards: their shapes and their words', async () => {
  for (const amount of ['0', '0.5', '-3', 'null']) {
    await refused('POST', '/api/transfers', `{"fromUserId":"u1","toUserId":"u2","amount":${amount}}`);
  }
  await refused('POST', '/api/transfers', '{"fromUserId":"u1","toUserId":"u2"}', 400, /must have required property 'amount'/);
  await refused('PUT', '/api/transfers/x', '{"action":"steal"}', 400, /^body\/action must be equal to one of the allowed values$/);
  await refused('POST', '/api/spendings', '{"userId":"u1"}');
  await refused('POST', '/api/spendings', '{"userId":"u1","rewardId":7}');
  await refused('PUT', '/api/spendings/x', '{"status":"pending"}');
});

test('a group game: the setup screen\'s limits, configured players only', async () => {
  for (const [rounds, perRound] of [['"abc"', 5], [0, 5], [6, 5], [2000, 100], [2, 0], [2, 11], [2, 2.5]]) {
    await refused('POST', '/api/exercises/sessions', game(JSON.parse(String(rounds)), perRound));
  }
  await refused('POST', '/api/exercises/sessions', game(1, 1, []));
  await refused('POST', '/api/exercises/sessions', game(1, 1, ['u1', 'u1']));
  await refused('POST', '/api/exercises/sessions', game(1, 1, Array.from({ length: 11 }, (_, i) => `u${i}`)));
  await refused('POST', '/api/exercises/sessions', game(1, 1, ['nobody']), 400, /nobody/);
  await refused('POST', '/api/exercises/sessions', JSON.stringify({ playerIds: ['u1'], categories: 'Γλώσσα', totalRounds: 1, questionsPerRound: 1 }));
  // db.ts's own bounds, for a caller that isn't a route
  scene();
  assert.throws(() => db.startExerciseSession(['u1'], [], 2000, 100));
  assert.throws(() => db.startExerciseSession(['u1'], [], NaN, 5));
  assert.equal(store.exerciseSessions.count(), 1);
});

test('an answer must be there (any JSON value), and the other bodies name what they need', async () => {
  await refused('POST', `/api/exercise-assignments/${ASSIGNMENT}/answer`, '{}', 400, /must have required property 'answer'/);
  await refused('POST', `/api/exercises/sessions/${GAME}/answer`, '{"userId":"u1","exerciseId":"mc"}');
  await refused('POST', `/api/chores/${AVAILABLE}/claim`, '{"userId":""}');
  await refused('POST', `/api/chores/${AVAILABLE}/claim`, '{"userId":"nobody"}', 404, /nobody/);
  await refused('POST', '/api/help/seen', '{"tourIds":"store"}');
  await refused('POST', '/api/help/seen', '{"tourIds":[]}');
  await refused('POST', '/api/help/reset', '{"userId":5}');
  await refused('POST', '/api/hooks/push', '{"id":""}');
  await refused('POST', '/api/executions/x/close', '{"by":"teacher"}');
  await refused('POST', '/api/admin/validate-cron', '{"cron":5}', 400, /^body\/cron must be string$/);
});

test('every body the screens send still passes (api.ts), and unknown fields are ignored', async () => {
  const ok = async (method: 'POST' | 'PUT', url: string, body?: unknown) => {
    const res = await call(method, url, body === undefined ? undefined : JSON.stringify(body));
    assert.equal(res.status, 200, `${method} ${url} ${JSON.stringify(body)}: ${JSON.stringify(res.body)}`);
    return res.body;
  };
  scene();
  await ok('POST', confirm, {}); // the chore's own 10
  assert.equal(store.getStars('u1'), 110);
  scene();
  await ok('POST', confirm, { stars: 20 });
  assert.deepEqual([store.getStars('u1'), store.choreInstances.get(CHORE)?.starsAwarded], [120, 20]);
  scene();
  await ok('POST', confirm, { stars: 0 });
  assert.deepEqual([store.getStars('u1'), store.choreInstances.get(CHORE)?.starsAwarded], [100, 0]);

  scene();
  await ok('POST', '/api/users/u1/stars', { amount: 5 });
  await ok('POST', '/api/users/u1/stars', { amount: -3 });
  const gift = await ok('POST', '/api/transfers', { fromUserId: 'u1', toUserId: 'u2', amount: 5, note: 'ignored' });
  await ok('PUT', `/api/transfers/${gift.id}`, { action: 'approve' });
  const bought = await ok('POST', '/api/spendings', { userId: 'u1', rewardId: 'park' });
  await ok('PUT', `/api/spendings/${bought.id}`, { status: 'done' });
  assert.deepEqual([store.getStars('u1'), store.getStars('u2')], [87, 25]);

  await ok('POST', `/api/chores/${AVAILABLE}/claim`, { userId: 'u2' });
  await ok('POST', `/api/chores/${AVAILABLE}/attempt`, {}); // no body schema: api.ts's {} is fine
  await ok('POST', `/api/exercises/sessions/${GAME}/answer`, { userId: 'u1', exerciseId: 'mc', answer: 1 });
  await ok('POST', `/api/exercise-assignments/${ASSIGNMENT}/answer`, { answer: 1 });
  const started = await ok('POST', '/api/exercises/sessions', { playerIds: ['u1', 'u2'], categories: [], totalRounds: 5, questionsPerRound: 10 });
  assert.equal((started.exerciseIds as string[]).length, 50);
  await ok('POST', '/api/help/seen', { tourIds: ['store', 'chores@u1'] });
  await ok('POST', '/api/help/reset', { userId: 'u1' });
  await ok('POST', '/api/help/reset', {});
  await ok('POST', '/api/help/reset'); // no body at all: every tour
  assert.equal(store.helpSeen.count(), 0);
  await ok('POST', '/api/executions/x/close', {}); // the kids' ✕ (no such run here: a no-op)
  await ok('POST', '/api/executions/x/close'); // no body at all: the same
  await ok('POST', '/api/executions/x/close', { by: 'parent' }); // a parent's «Τέλος» (#63)
  assert.deepEqual(await ok('POST', '/api/admin/validate-cron', { cron: '0 7 * * 1-5' }), { error: null }); // the forms' raw cron field (#89)
});

test("the exercises editor's pre-check (#31) names the one mistake and saves nothing", async () => {
  const file = readFileSync(process.env.EXERCISES_FILE!, 'utf-8');
  const bad = { exercises: [{ ...exercises[0], correctIndex: 'δεύτερο' }] };
  const res = await call('POST', '/api/admin/validate-exercises', JSON.stringify(bad));
  assert.equal(res.status, 200);
  assert.equal(res.body.valid, false);
  assert.deepEqual((res.body.errors as { instancePath: string; message: string }[]).map(e => `${e.instancePath} ${e.message}`),
    ['/exercises/0/correctIndex must be integer']);
  assert.deepEqual((await call('POST', '/api/admin/validate-exercises', JSON.stringify({ exercises }))).body, { valid: true });
  assert.equal(readFileSync(process.env.EXERCISES_FILE!, 'utf-8'), file);
});

test("a refused exercises save says what is wrong in a line, not AJV's JSON (#31)", async () => {
  const file = readFileSync(process.env.EXERCISES_FILE!, 'utf-8');
  const bad = { exercises: [{ ...exercises[0], correctIndex: 'δεύτερο' }] };
  const res = await call('POST', '/api/admin/exercises', JSON.stringify(bad));
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Exercises validation failed: /exercises/0/correctIndex must be integer');
  assert.equal(readFileSync(process.env.EXERCISES_FILE!, 'utf-8'), file);
});
