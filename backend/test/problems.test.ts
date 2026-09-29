import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, ProblemExercise, ProblemStep } from '../../shared/types';
import { tempDir } from './helpers';

// db.ts and the pool provider read their files from the environment when they
// load, so point them at a temp dir first and load them afterwards.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [
    { id: 'u1', name: 'A', avatar: icon, color: 'red', grade: 5 },
    { id: 'u2', name: 'B', avatar: icon, color: 'blue', grade: 3 },
    { id: 'u3', name: 'C', avatar: icon, color: 'green' }
  ],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [],
  settings: { timezone: 'Europe/Athens', exercisesPerDay: 2 }
};

const balloons: ProblemExercise = {
  id: 'p-balloons', type: 'problem', category: 'Προβλήματα', title: 'Μπαλόνια', stars: 3,
  story: 'Έχει [25 ευρώ|known]. Κάθε μπαλόνι [3 ευρώ|known], [κόκκινο|extra]. [Πόσα μπαλόνια|sought];',
  steps: [
    { kind: 'tag', phase: 'read', prompt: 'Τι ξέρουμε;' },
    { kind: 'choice', phase: 'plan', prompt: 'Πράξη;', options: ['25 + 3', '25 : 3'], correctIndex: 1 },
    { kind: 'numbers', phase: 'solve', prompt: 'Λύνουμε', rows: [{ label: 'Μπαλόνια', answer: 8 }, { label: 'Ρέστα', answer: 1 }] },
    { kind: 'order', phase: 'check', prompt: 'Σειρά', items: ['πρώτο', 'δεύτερο', 'τρίτο'] }
  ]
};
const pools = path.join(dir, 'pools');
mkdirSync(pools);
writeFileSync(path.join(pools, 'g.json'), JSON.stringify({ grades: [3], exercises: [balloons] }));
writeFileSync(path.join(pools, 'e.json'), JSON.stringify({
  grades: [5],
  exercises: [1, 2, 3].map(n => ({ id: `e-${n}`, type: 'number-input', category: 'Μαθηματικά', title: 'x', question: `${n} + ${n}`, correctValue: 2 * n, stars: 1 }))
}));
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
const pool = require('../src/exercisePool') as typeof import('../src/exercisePool');
const change = reloadConfig();
if (change?.type !== 'updated') throw new Error(`test config rejected: ${JSON.stringify(change)}`);
const { store } = db;

// The answer that solves a step, as the kid's screen would send it.
function solution(ex: ProblemExercise, step: ProblemStep): unknown {
  switch (step.kind) {
    case 'tag': return pool.storyMarks(ex.story).map(m => m.role);
    case 'choice': return step.correctIndex;
    case 'numbers': return step.rows.map(r => r.answer);
    case 'order': return step.items;
  }
}

test('every shipped pool is valid, and every problem can be solved step by step', () => {
  const shipped = pool.loadPools(path.join(__dirname, '..', 'exercise-pools'));
  assert.ok(shipped.length >= 4);
  for (const grade of [3, 5] as const) {
    assert.ok(shipped.some(p => p.grades.includes(grade) && p.exercises.some(e => e.type === 'problem')), `problems for grade ${grade}`);
  }
  for (const ex of shipped.flatMap(p => p.exercises)) {
    if (ex.type !== 'problem') continue;
    ex.steps.forEach((step, i) => {
      assert.deepEqual(db.checkProblemStep(ex, i, solution(ex, step)), { correct: true }, `${ex.id} step ${i}`);
    });
  }
});

test('a broken pool file is refused', () => {
  const bad = path.join(dir, 'bad');
  mkdirSync(bad);
  const noSought = { ...balloons, story: 'Έχει [25 ευρώ|known].' };
  writeFileSync(path.join(bad, 'x.json'), JSON.stringify({ grades: [3], exercises: [noSought] }));
  assert.throws(() => pool.loadPools(bad), /sought/);
  writeFileSync(path.join(bad, 'x.json'), JSON.stringify({ grades: [3], exercises: [{ ...balloons, steps: [{ kind: 'dance' }] }] }));
  assert.throws(() => pool.loadPools(bad), /Invalid exercise pool/);
  writeFileSync(path.join(bad, 'x.json'), JSON.stringify({ grades: [3], exercises: [balloons] }));
  writeFileSync(path.join(bad, 'y.json'), JSON.stringify({ grades: [5], exercises: [balloons] }));
  assert.throws(() => pool.loadPools(bad), /duplicate exercise id p-balloons/);
});

test('each kid draws exercisesPerDay from the pools of their grade; no grade, no exercises', async () => {
  const all = await db.getExerciseAssignments();
  const of = (userId: string) => all.filter(a => a.userId === userId);
  assert.equal(of('u1').length, 2);
  assert.ok(of('u1').every(a => a.exerciseId.startsWith('e-')));
  assert.deepEqual(of('u2').map(a => a.exerciseId), ['p-balloons']); // the pool has only one
  assert.equal(of('u3').length, 0);
});

test('a problem is answered step by step: wrong tries count, the last step pays', async () => {
  const [assignment] = store.exerciseAssignments.all('userId = ?', 'u2');
  const answer = (step: number, value: unknown) => db.answerExerciseAssignment(assignment.id, { step, value });
  const starsBefore = db.usersWithStars().find(u => u.id === 'u2')!.stars;

  // Tag: the extra phrase tagged as known is pointed out
  let r = await answer(0, ['known', 'known', 'known', 'sought']);
  assert.deepEqual([r.correct, r.wrong, r.assignment.stepIndex ?? 0], [false, [2], 0]);
  r = await answer(0, ['known', 'known', 'extra', 'sought']);
  assert.deepEqual([r.correct, r.assignment.stepIndex], [true, 1]);

  // A repeat of a solved step (a second device) changes nothing
  r = await answer(0, ['known', 'known', 'extra', 'sought']);
  assert.deepEqual([r.correct, r.assignment.stepIndex, r.assignment.attempts], [true, 1, 2]);

  r = await answer(1, 0);
  assert.equal(r.correct, false);
  r = await answer(1, 1);
  r = await answer(2, [8, 2]);
  assert.deepEqual(r.wrong, [1]);
  r = await answer(2, [8, 1]);
  assert.equal(r.assignment.status, 'pending');
  r = await answer(3, ['πρώτο', 'δεύτερο', 'τρίτο']);
  assert.deepEqual([r.correct, r.starsAwarded, r.assignment.status, r.assignment.stepIndex], [true, 3, 'completed', 4]);
  assert.deepEqual(r.assignment.mistakes, [1, 1, 1, 0]);
  assert.equal(db.usersWithStars().find(u => u.id === 'u2')!.stars, starsBefore + 3);

  // Stored as answered, and read back the same after a restart
  assert.deepEqual(store.exerciseAssignments.get(assignment.id), r.assignment);
  await assert.rejects(answer(3, ['πρώτο', 'δεύτερο', 'τρίτο']), /already completed/);
});
