import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, ProblemExercise } from '../../shared/types';
import { MAX_SET_ASIDE, extraRefusals } from '../../shared/extraProblems';
import { tempDir } from './helpers';

// Extra problems set aside (#67): ✕ leaves an extra pending, it stays hers for the day, and
// «Κι άλλο πρόβλημα» draws a different one. At most MAX_SET_ASIDE wait at once; none is handed
// out twice; the day's limit counts every extra she started. Its own pools and database.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [
    { id: 'u1', name: 'A', avatar: icon, color: 'red', grade: 3 },
    { id: 'u2', name: 'B', avatar: icon, color: 'blue', grade: 4 },
  ],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [],
  settings: { timezone: 'Europe/Athens', exercisesPerDay: 1, extraProblemsPerDay: 10 }
};
const balloons: ProblemExercise = {
  id: 'p', type: 'problem', category: 'Προβλήματα', title: 'Μπαλόνια', stars: 3,
  story: 'Έχει [25 ευρώ|known]. Κάθε μπαλόνι [3 ευρώ|known], [κόκκινο|extra]. [Πόσα μπαλόνια|sought];',
  steps: [
    { kind: 'tag', phase: 'read', prompt: 'Τι ξέρουμε;' },
    { kind: 'choice', phase: 'plan', prompt: 'Πράξη;', options: ['25 + 3', '25 : 3'], correctIndex: 1 },
    { kind: 'numbers', phase: 'solve', prompt: 'Λύνουμε', rows: [{ label: 'Μπαλόνια', answer: 8 }, { label: 'Ρέστα', answer: 1 }] },
    { kind: 'order', phase: 'check', prompt: 'Σειρά', items: ['πρώτο', 'δεύτερο', 'τρίτο'] }
  ]
};
const solved: unknown[] = [['known', 'known', 'extra', 'sought'], 1, [8, 1], ['πρώτο', 'δεύτερο', 'τρίτο']];
const pools = path.join(dir, 'pools');
mkdirSync(pools);
// Γ΄: five problems; Δ΄: two, so they run out
const g3 = ['g1', 'g2', 'g3', 'g4', 'g5'];
writeFileSync(path.join(pools, 'g.json'), JSON.stringify({ grades: [3], exercises: g3.map(id => ({ ...balloons, id })) }));
writeFileSync(path.join(pools, 'd.json'), JSON.stringify({ grades: [4], exercises: ['d1', 'd2'].map(id => ({ ...balloons, id })) }));
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
process.env.EXERCISE_POOLS_DIR = pools;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { reloadConfig } = require('../src/config') as typeof import('../src/config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { server } = require('../src/server') as typeof import('../src/server');
if (reloadConfig()?.type !== 'updated') throw new Error('test config rejected');
const { store } = db;
before(() => server.ready());

const starsOf = (userId: string) => db.usersWithStars().find(u => u.id === userId)!.stars;
const answer = (id: string, step: number, value: unknown) => db.answerExerciseAssignment(id, { step, value });
const finish = async (id: string) => {
  const from = store.exerciseAssignments.get(id)!.stepIndex ?? 0;
  for (let i = from; i < solved.length; i++) await answer(id, i, solved[i]);
};
// What she has pending today, daily and extra
const pendingToday = (userId: string) =>
  store.exerciseAssignments.all("userId = ? AND status = 'pending'", userId).filter(a => a.date !== '2000-01-01');
const ask = (userId: string) => server.inject({ method: 'POST', url: '/api/exercise-assignments/extra', payload: { userId } });

test('asking while an extra is pending gives a different problem; the first keeps its step and mistakes, and pays when finished', async () => {
  await db.ensureDailyAssignments();
  const [daily] = store.exerciseAssignments.all('userId = ?', 'u1');

  const first = await db.startExtraProblem('u1');
  // A wrong try on the reading step, then right: she is at step 2 with one mistake, and leaves it (✕ calls nothing)
  await answer(first.id, 0, ['known', 'known', 'known', 'sought']);
  await answer(first.id, 0, solved[0]);
  const left = store.exerciseAssignments.get(first.id)!;
  assert.deepEqual([left.status, left.stepIndex, left.mistakes?.[0]], ['pending', 1, 1]);

  const second = await db.startExtraProblem('u1');
  assert.notEqual(second.id, first.id);
  assert.ok(![daily.exerciseId, first.exerciseId].includes(second.exerciseId), 'a problem she doesn\'t have today');
  assert.deepEqual(store.exerciseAssignments.get(first.id), left, 'the first is untouched');
  assert.deepEqual(db.extraProblemsToday('u1'), { used: 2, limit: 10 });

  // She comes back to the first later: it goes on from step 2 and pays ⭐3 less the step gone wrong
  const before = starsOf('u1');
  await finish(first.id);
  assert.equal(store.exerciseAssignments.get(first.id)!.status, 'completed');
  assert.equal(starsOf('u1'), before + 2);
});

test(`at most ${MAX_SET_ASIDE} extras wait at once: the next is a 400 with a Greek reason, and changes nothing`, async () => {
  // Pending: the second from above; two more make three
  await db.startExtraProblem('u1');
  await db.startExtraProblem('u1');
  const extras = () => store.exerciseAssignments.all('userId = ? AND extra = 1', 'u1');
  assert.equal(extras().filter(a => a.status === 'pending').length, MAX_SET_ASIDE);
  const count = extras().length;

  const r = await ask('u1');
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.json(), { error: extraRefusals.setAside });
  assert.equal(extras().length, count);

  // She finishes one of them: she may ask again
  await finish(extras().find(a => a.status === 'pending')!.id);
  const next = await ask('u1');
  assert.equal(next.statusCode, 200);
});

test('never a problem she has pending today: when every one of her grade is, a 400 with a Greek reason', async () => {
  // Every Γ΄ problem was had today (five: the daily and four extras), so the last ask above took one
  // already finished today, never a pending one
  const pending = pendingToday('u1');
  assert.equal(new Set(pending.map(a => a.exerciseId)).size, pending.length, 'no problem twice among her pending ones');

  // Δ΄ has two problems: the daily one and one extra take both
  await db.startExtraProblem('u2');
  assert.deepEqual(pendingToday('u2').map(a => a.exerciseId).sort(), ['d1', 'd2']);
  const r = await ask('u2');
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.json(), { error: extraRefusals.noneLeft });
});

test('the day\'s limit counts every extra started, finished or set aside', async () => {
  const { used } = db.extraProblemsToday('u1');
  writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ ...cfg, settings: { ...cfg.settings, extraProblemsPerDay: used } }));
  assert.equal(reloadConfig()?.type, 'updated');
  await assert.rejects(db.startExtraProblem('u1'), /No more extra problems today/);
  writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
  assert.equal(reloadConfig()?.type, 'updated');
});

test('midnight: an extra left yesterday is not today\'s, nor counted against today', async () => {
  const today = db.extraProblemsToday('u2');
  store.exerciseAssignments.put({
    id: 'old', userId: 'u2', exerciseId: 'd1', date: '2000-01-01', status: 'pending', attempts: 0,
    assignedAt: '2000-01-01T08:00:00.000Z', extra: true, stepIndex: 1
  });
  assert.deepEqual(db.extraProblemsToday('u2'), today);
  assert.ok(!(await db.getExerciseAssignments('u2')).some(a => a.id === 'old'));
});
