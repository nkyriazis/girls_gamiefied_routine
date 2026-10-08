import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';
import { DataConfig, Exercise, ExerciseAssignment, NumberInputExercise, ProblemExercise } from '../../shared/types';
import { tempDir } from './helpers';

// Shown, then do (#136): an item solved for her («Δείξε μου», Αυστηρό's worked step) comes back the next
// morning as another item of the same kind, in its category's slot of the day's set. Its own pools and database.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'A', avatar: icon, color: 'red', grade: 3 }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [],
  settings: { timezone: 'Europe/Athens', exercisesPerDay: 3 }
};
const problem = (id: string, family: string | undefined, topic: string): ProblemExercise => ({
  id, type: 'problem', category: 'Προβλήματα', title: id, stars: 3, topic, ...(family ? { generatorParams: { family } } : {}),
  story: 'Έχει [25 ευρώ|known]. [Πόσα|sought];',
  steps: [{ kind: 'choice', phase: 'plan', prompt: 'Πράξη;', options: ['25 + 3', '25 : 3'], correctIndex: 1 }]
});
const plain = (id: string, category: string, family: string, topic?: string): NumberInputExercise => ({
  id, type: 'number-input', category, title: id, stars: 1, question: '1 + 1', correctValue: 2, ...(topic ? { topic } : {}), generatorParams: { family }
});
// Problems: family fa (3), fb alone in topic T1 with fa, fc alone in T2, a world problem (no family) alone in T3.
// Maths: family add (2), lone alone in its family and topic. Language: two of one family.
const problems = [problem('fa-1', 'fa', 'T1'), problem('fa-2', 'fa', 'T1'), problem('fa-3', 'fa', 'T1'), problem('fb-1', 'fb', 'T1'),
  problem('fc-1', 'fc', 'T2'), problem('w-1', undefined, 'T3')];
const maths = [plain('add-1', 'Μαθηματικά', 'add', 'Πρόσθεση'), plain('add-2', 'Μαθηματικά', 'add', 'Πρόσθεση'), plain('lone-1', 'Μαθηματικά', 'lone', 'Μόνη')];
const language = [plain('lang-1', 'Γλώσσα', 'lang', 'Λέξεις'), plain('lang-2', 'Γλώσσα', 'lang', 'Λέξεις')];
const pools = path.join(dir, 'pools');
mkdirSync(pools);
writeFileSync(path.join(pools, 'g.json'), JSON.stringify({ grades: [3], exercises: [...problems, ...maths, ...language] }));
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
writeFileSync(path.join(dir, 'exercises.json'), JSON.stringify({ exercises: [] }));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
process.env.EXERCISE_POOLS_DIR = pools;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OPEN, retryFor } = require('../src/exercisePool') as typeof import('../src/exercisePool');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
const { store } = db;
const setConfig = (c: DataConfig) => db.writeRawConfig(c, { source: 'form', route: 'test' });

const DAY = 86400_000;
const dateOf = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
const today = () => dateOf(Date.now());
const all = () => store.exerciseAssignments.all('userId = ?', 'u1');
const todays = () => store.exerciseAssignments.all('userId = ? AND date = ?', 'u1', today());

/** An assignment `daysAgo` days back, done: `shown` as stored, `retryOf` if it is a retry. */
function had(exerciseId: string, daysAgo: number, more: Partial<ExerciseAssignment> = {}): ExerciseAssignment {
  const at = Date.now() - daysAgo * DAY;
  const a: ExerciseAssignment = {
    id: randomUUID(), userId: 'u1', exerciseId, date: dateOf(at), status: 'completed', attempts: 2,
    assignedAt: new Date(at).toISOString(), completedAt: new Date(at + 60_000).toISOString(), starsAwarded: 0, ...more
  };
  store.exerciseAssignments.put(a);
  return a;
}

/** The next morning: every row a day older, so the next draw is a new day's. */
function nextMorning() {
  const back = (iso?: string) => (iso ? new Date(Date.parse(iso) - DAY).toISOString() : undefined);
  for (const a of all()) {
    store.exerciseAssignments.put({
      ...a, date: dateOf(Date.parse(a.assignedAt) - DAY), assignedAt: back(a.assignedAt)!, ...(a.completedAt ? { completedAt: back(a.completedAt) } : {})
    });
  }
}

const retryLog = () => db.readLastLogs(50).find(l => l.type === 'EXERCISE_ASSIGNMENTS_CREATED')?.details as { retry?: unknown; exerciseIds: string[] };

beforeEach(() => {
  store.exerciseAssignments.deleteWhere('userId = ?', 'u1');
});

const byId = new Map<string, Exercise>([...problems, ...maths, ...language].map(e => [e.id, e]));
const poolsOf = { own: [...byId.values()], revision: [] };

test('the pick: another item of the same family, else the same topic, never the bare category', () => {
  for (let i = 0; i < 20; i++) {
    const pick = retryFor(byId.get('fa-1')!, poolsOf, OPEN, new Map(), new Set());
    assert.equal(pick?.match, 'family');
    assert.ok(['fa-2', 'fa-3'].includes(pick!.ex.id), pick!.ex.id);
  }
  // fb is alone in its family: its topic, T1, has the fa problems
  assert.equal(retryFor(byId.get('fb-1')!, poolsOf, OPEN, new Map(), new Set())?.match, 'topic');
  assert.match(retryFor(byId.get('fb-1')!, poolsOf, OPEN, new Map(), new Set())!.ex.id, /^fa-/);
  // The freshest within the family: never seen first, then seen longest ago
  const seen = new Map([['fa-2', new Date().toISOString()]]);
  assert.equal(retryFor(byId.get('fa-1')!, poolsOf, OPEN, seen, new Set())?.ex.id, 'fa-3');
  // Not one already in the day's set
  assert.equal(retryFor(byId.get('fa-1')!, poolsOf, OPEN, new Map(), new Set(['fa-3']))?.ex.id, 'fa-2');
  // A world problem has no family; alone in its topic, a problem has nothing of its kind: no retry
  assert.equal(retryFor(byId.get('w-1')!, poolsOf, OPEN, new Map(), new Set()), undefined);
  assert.equal(retryFor(byId.get('fc-1')!, poolsOf, OPEN, new Map(), new Set()), undefined);
  // A plain exercise alone of its kind comes back itself
  assert.deepEqual(retryFor(byId.get('lone-1')!, poolsOf, OPEN, new Map(), new Set()), { ex: byId.get('lone-1'), match: 'same' });
  // Not hers any more (her grade changed): it lapses instead of coming back from the old grade's pool
  assert.equal(retryFor({ ...byId.get('lone-1')!, id: 'gone-1', topic: 'gone', generatorParams: { family: 'gone' } } as Exercise, poolsOf, OPEN, new Map(), new Set()), undefined);
});

test('a shown problem comes back the next morning as another of its family, in the problem\'s slot', async () => {
  const shown = had('fa-1', 1, { shown: [0] });
  had('add-1', 1, { starsAwarded: 1 });
  await db.ensureDailyAssignments();
  const set = todays();
  assert.equal(set.length, 3, 'the count stays exercisesPerDay');
  assert.deepEqual(set.map(a => byId.get(a.exerciseId)!.category), ['Προβλήματα', 'Μαθηματικά', 'Γλώσσα'], 'in mix order');
  const retry = set.find(a => a.retryOf);
  assert.equal(retry?.retryOf, shown.id);
  assert.match(retry!.exerciseId, /^fa-[23]$/);
  assert.deepEqual(retryLog().retry, { exerciseId: retry!.exerciseId, of: shown.id, ofExercise: 'fa-1', match: 'family' });
});

test('one a day, oldest first; a retry left undone keeps it owed, a completed one clears it', async () => {
  const older = had('add-1', 2, { shown: [0] });
  const newer = had('fa-1', 1, { shown: [0] });
  await db.ensureDailyAssignments();
  assert.deepEqual(todays().filter(a => a.retryOf).map(a => [a.retryOf, a.exerciseId]), [[older.id, 'add-2']]);

  // Left undone: the next morning the same is owed again (still the oldest)
  nextMorning();
  await db.ensureDailyAssignments();
  assert.deepEqual(todays().filter(a => a.retryOf).map(a => a.retryOf), [older.id]);

  // Done: the debt is paid, and the newer one comes back
  const retry = todays().find(a => a.retryOf)!;
  store.exerciseAssignments.put({ ...retry, status: 'completed', completedAt: new Date().toISOString(), starsAwarded: 1 });
  nextMorning();
  await db.ensureDailyAssignments();
  assert.deepEqual(todays().filter(a => a.retryOf).map(a => a.retryOf), [newer.id]);
});

test('owed: shown in the last 7 days, left pending too; a retry shown again owes nothing; extras count', async () => {
  had('add-1', 8, { shown: [0] }); // too old
  const original = had('fa-1', 3, { shown: [0] });
  // its retry, done but shown again: the original is paid, and the retry owes nothing
  had('fa-2', 2, { shown: [0], retryOf: original.id });
  await db.ensureDailyAssignments();
  assert.equal(todays().filter(a => a.retryOf).length, 0);
  assert.equal(retryLog().retry, undefined);

  store.exerciseAssignments.deleteWhere('userId = ?', 'u1');
  // An extra problem left pending with a step shown
  const extra = had('fa-1', 1, { shown: [0], extra: true, status: 'pending', completedAt: undefined, starsAwarded: undefined });
  await db.ensureDailyAssignments();
  assert.deepEqual(todays().filter(a => a.retryOf).map(a => a.retryOf), [extra.id]);
});

test('nothing of its kind: a problem is dropped and the next owed comes back; a plain one comes back itself', async () => {
  had('w-1', 3, { shown: [0] });
  const lone = had('lone-1', 2, { shown: [0] });
  await db.ensureDailyAssignments();
  assert.deepEqual(todays().filter(a => a.retryOf).map(a => [a.retryOf, a.exerciseId]), [[lone.id, 'lone-1']]);
  assert.equal((retryLog().retry as { match: string }).match, 'same');
});

test('no slot of its category in the day\'s set: the retry waits, still owed', async () => {
  setConfig({ ...cfg, settings: { ...cfg.settings, exercisesPerDay: 1 } });
  try {
    const owed = had('add-1', 1, { shown: [0] });
    await db.ensureDailyAssignments();
    assert.deepEqual(todays().map(a => byId.get(a.exerciseId)!.category), ['Προβλήματα']);
    assert.equal(todays().filter(a => a.retryOf).length, 0);

    setConfig(cfg);
    nextMorning();
    await db.ensureDailyAssignments();
    assert.deepEqual(todays().filter(a => a.retryOf).map(a => a.retryOf), [owed.id]);
  } finally {
    setConfig(cfg);
  }
});

test('a retry plays by Αυστηρό\'s rules on a forgiving kid: no «Δείξε μου», closed or worked after its tries', async () => {
  const original = had('add-1', 1, { shown: [0] });
  const pending = { status: 'pending' as const, attempts: 0, completedAt: undefined, starsAwarded: undefined };
  // Not a retry: forgiving, so wrong tries go on, and «Δείξε μου» after one
  const plainOne = had('add-2', 0, { ...pending });
  await db.answerExerciseAssignment(plainOne.id, 3);
  await db.answerExerciseAssignment(plainOne.id, 3);
  assert.equal(store.exerciseAssignments.get(plainOne.id)?.status, 'pending');
  assert.equal((await db.revealExerciseAssignment(plainOne.id)).shown?.[0], 0);

  // A plain retry: closed after Αυστηρό's two tries, its answer shown, paying nothing; «Δείξε μου» refused
  const plainRetry = had('add-2', 0, { ...pending, retryOf: original.id });
  await db.answerExerciseAssignment(plainRetry.id, 3);
  await assert.rejects(db.revealExerciseAssignment(plainRetry.id), /retry/);
  const closed = await db.answerExerciseAssignment(plainRetry.id, 3);
  assert.deepEqual([closed.assignment.status, closed.assignment.shown, closed.starsAwarded], ['completed', [0], 0]);

  // A problem retry: its step shown worked after two counted wrong tries; «Δείξε μου» refused
  const problemRetry = had('fa-2', 0, { ...pending, retryOf: original.id });
  await assert.rejects(db.revealExerciseAssignment(problemRetry.id, 0), /retry/);
  await db.answerExerciseAssignment(problemRetry.id, { step: 0, value: 0 });
  assert.equal(store.exerciseAssignments.get(problemRetry.id)?.shown, undefined);
  await db.answerExerciseAssignment(problemRetry.id, { step: 0, value: 0 });
  assert.deepEqual(store.exerciseAssignments.get(problemRetry.id)?.shown, [0]);
  // The worked answer finishes it, paying Αυστηρό's: 3 stars less one, no floor of 1
  const done = await db.answerExerciseAssignment(problemRetry.id, { step: 0, value: 1 });
  assert.deepEqual([done.assignment.status, done.starsAwarded], ['completed', 2]);
});
