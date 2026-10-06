import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, ProblemExercise, ProblemStep } from '../../shared/types';
import { tempDir } from './helpers';
import { applyOp, checkCalc, checkPaint, readCalculation, storyWords, targetsFromMarks, workedAnswer, type CalcLine, type CalcWorld } from '../../shared/problems';

// db.ts and the pool provider read their files from the environment when they
// load, so point them at a temp dir first and load them afterwards.
const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [
    { id: 'u1', name: 'A', avatar: icon, color: 'red', grade: 5 },
    { id: 'u2', name: 'B', avatar: icon, color: 'blue', grade: 3 },
    { id: 'u3', name: 'C', avatar: icon, color: 'green' },
    { id: 'u4', name: 'D', avatar: icon, color: 'gold', grade: 3, forgiveness: 'unforgiving' },
    { id: 'u5', name: 'E', avatar: icon, color: 'pink', grade: 5, forgiveness: 'unforgiving', problemReading: 'paint' }
  ],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [],
  settings: { timezone: 'Europe/Athens', exercisesPerDay: 2, extraProblemsPerDay: 2 }
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
// Three copies of the same problem, so draws can be told apart by id
const gradeThree = ['p-balloons', 'p-two', 'p-three'].map(id => ({ ...balloons, id }));
writeFileSync(path.join(pools, 'g.json'), JSON.stringify({ grades: [3], exercises: gradeThree }));
writeFileSync(path.join(pools, 'e.json'), JSON.stringify({
  grades: [5],
  exercises: [
    ...[1, 2, 3].map(n => ({ id: `e-${n}`, type: 'number-input', category: 'Μαθηματικά', title: 'x', question: `${n} + ${n}`, correctValue: 2 * n, stars: 1 })),
    { id: 'e-tf', type: 'true-false', category: 'Μαθηματικά', title: 'x', question: '2 + 2 = 4', correctValue: true, stars: 1 },
    { ...balloons, id: 'e-balloons' },
  ]
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
    case 'paint': return painting(ex, true);
    case 'calc': return { lines: workOut(step), slips: 0 };
  }
}

// The story painted as a careful kid would, whole phrases (the unneeded ones too, for "paint-all")
function painting(ex: ProblemExercise, unneeded: boolean) {
  const read = ex.steps.find(s => s.kind === 'tag' || s.kind === 'paint')!;
  const targets = read.kind === 'paint' ? read.targets : targetsFromMarks(ex.story);
  const words = (role: string) => targets.filter(t => t.role === role)
    .flatMap(t => Array.from({ length: t.span[1] - t.span[0] + 1 }, (_, i) => t.span[0] + i));
  return { known: words('known'), sought: words('sought'), ...(unneeded ? { extra: words('extra') } : {}) };
}

// Every calculation the story allows, from what it gives, until the answer turns up.
function workOut(w: CalcWorld): CalcLine[] {
  const value = new Map(w.quantities.map(q => [q.id, q.value]));
  const have = new Set(w.given);
  const lines: CalcLine[] = [];
  for (let changed = true; changed && !have.has(w.sought);) {
    changed = false;
    for (const r of w.relations) {
      const missing = [r.out, r.a, r.b].filter(id => !have.has(id));
      if (missing.length !== 1) continue;
      const [t] = missing;
      const back = { '+': '−', '−': '+', '×': ':', ':': '×' } as const;
      const [op, x, y] = t === r.out ? [r.op, r.a, r.b]
        : t === r.a ? [back[r.op], r.out, r.b]
          : r.op === '+' || r.op === '×' ? [r.op === '+' ? '−' : ':', r.out, r.a] as const : [r.op, r.a, r.out] as const;
      const line = { x: value.get(x)!, op, y: value.get(y)!, result: applyOp(op, value.get(x)!, value.get(y)!) };
      lines.push(line);
      have.add(t);
      changed = true;
    }
  }
  return lines;
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
      // The reading step plays on every rung of the ladder
      if (step.kind === 'tag' || step.kind === 'paint') {
        assert.deepEqual(db.checkProblemStep(ex, i, pool.storyMarks(ex.story).map(m => m.role), 'marked'), { correct: true }, `${ex.id} marked`);
        assert.deepEqual(db.checkProblemStep(ex, i, painting(ex, false), 'paint'), { correct: true }, `${ex.id} paint`);
        assert.deepEqual(db.checkProblemStep(ex, i, painting(ex, true), 'paint-all'), { correct: true }, `${ex.id} paint-all`);
        const hasExtra = pool.storyMarks(ex.story).some(m => m.role === 'extra');
        assert.equal(db.checkProblemStep(ex, i, painting(ex, false), 'paint-all').correct, !hasExtra, `${ex.id} paint-all needs the unneeded painted`);
      }
    });
  }
});

test('«Δείξε μου»: every step of every shipped problem, shown worked, passes its check on every rung', () => {
  const shipped = pool.loadPools(path.join(__dirname, '..', 'exercise-pools'));
  let steps = 0;
  for (const ex of shipped.flatMap(p => p.exercises)) {
    if (ex.type !== 'problem') continue;
    for (const reading of ['marked', 'paint', 'paint-all'] as const) {
      ex.steps.forEach((_, i) => {
        assert.deepEqual(db.checkProblemStep(ex, i, workedAnswer(ex, i, reading), reading), { correct: true }, `${ex.id} step ${i} on ${reading}`);
        steps++;
      });
    }
  }
  assert.ok(steps > 3000, `${steps} steps`);
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
  assert.equal(of('u2').length, 2);
  assert.ok(of('u2').every(a => a.exerciseId.startsWith('p-') && !a.extra));
  assert.equal(of('u3').length, 0);
});

// An assignment of its own, on another day, so today's sets stay as drawn
const assign = (userId: string, exerciseId: string) => {
  const a = { id: `${userId}-${exerciseId}-${Math.random()}`, userId, exerciseId, date: '2000-01-01', status: 'pending' as const, attempts: 0, assignedAt: new Date().toISOString() };
  store.exerciseAssignments.put(a);
  return a;
};
const starsOf = (userId: string) => db.usersWithStars().find(u => u.id === userId)!.stars;

test('a problem is answered step by step: wrong tries count, the last step pays a star less per step gone wrong', async () => {
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
  // ⭐3, less one for each of the three steps gone wrong: forgiving pays at least 1
  assert.deepEqual([r.correct, r.starsAwarded, r.assignment.status, r.assignment.stepIndex], [true, 1, 'completed', 4]);
  assert.deepEqual(r.assignment.mistakes, [1, 1, 1, 0]);
  assert.equal(db.usersWithStars().find(u => u.id === 'u2')!.stars, starsBefore + 1);

  // Stored as answered, and read back the same after a restart
  assert.deepEqual(store.exerciseAssignments.get(assignment.id), r.assignment);
  await assert.rejects(answer(3, ['πρώτο', 'δεύτερο', 'τρίτο']), /already completed/);
});

test('extra problems: fresh ones first, one open at a time, up to the day\'s limit', async () => {
  const daily = store.exerciseAssignments.all('userId = ?', 'u2').map(a => a.exerciseId);
  const first = await db.startExtraProblem('u2');
  assert.equal(first.extra, true);
  assert.equal(first.exercise?.type, 'problem');
  assert.ok(!daily.includes(first.exerciseId), 'the one problem not drawn today');

  // Asking again while it is open returns the same one
  assert.equal((await db.startExtraProblem('u2')).id, first.id);

  const starsBefore = db.usersWithStars().find(u => u.id === 'u2')!.stars;
  for (const [i, step] of balloons.steps.entries()) await db.answerExerciseAssignment(first.id, { step: i, value: solution(balloons, step) });
  assert.equal(db.usersWithStars().find(u => u.id === 'u2')!.stars, starsBefore + 3);

  // All three were had today: the next is one of the daily ones, seen before the extra
  // (both were drawn at the same moment, so either)
  const second = await db.startExtraProblem('u2');
  assert.notEqual(second.id, first.id);
  assert.ok(daily.includes(second.exerciseId));
  assert.deepEqual(db.extraProblemsToday('u2'), { used: 2, limit: 2, open: store.exerciseAssignments.get(second.id) });
  for (const [i, step] of balloons.steps.entries()) await db.answerExerciseAssignment(second.id, { step: i, value: solution(balloons, step) });
  await assert.rejects(db.startExtraProblem('u2'), /No more extra problems today/);

  // Extras don't count as the daily set: nothing is drawn again
  assert.equal(await db.ensureDailyAssignments(), false);
  await assert.rejects(db.startExtraProblem('u3'), /class/);
});

test('unforgiving: a problem can pay nothing, and a painted reading step costs nothing', async () => {
  const before = starsOf('u4');
  const a = assign('u4', 'p-balloons');
  const answer = (step: number, value: unknown) => db.answerExerciseAssignment(a.id, { step, value });
  // Two wrong tries on each of three steps, then each shown worked (the right answer)
  await answer(0, ['known', 'known', 'known', 'sought']);
  await answer(0, ['known', 'known', 'known', 'sought']);
  await answer(0, ['known', 'known', 'extra', 'sought']);
  await answer(1, 0); await answer(1, 0); await answer(1, 1);
  await answer(2, [1, 1]); await answer(2, [1, 1]); await answer(2, [8, 1]);
  let r = await answer(3, ['πρώτο', 'δεύτερο', 'τρίτο']);
  assert.deepEqual([r.correct, r.starsAwarded, r.assignment.status], [true, 0, 'completed']);
  assert.deepEqual(r.assignment.mistakes, [2, 2, 2, 0]);
  assert.equal(starsOf('u4'), before);

  // u5 paints: wrong paintings are free (until #50), a wrong choice is not
  const b = assign('u5', 'e-balloons');
  const before5 = starsOf('u5');
  const painted = { known: [1, 2, 5, 6], sought: [8, 9] };
  assert.equal((await db.answerExerciseAssignment(b.id, { step: 0, value: { known: [], sought: [] } })).correct, false);
  assert.equal((await db.answerExerciseAssignment(b.id, { step: 0, value: painted })).correct, true);
  await db.answerExerciseAssignment(b.id, { step: 1, value: 0 });
  await db.answerExerciseAssignment(b.id, { step: 1, value: 1 });
  await db.answerExerciseAssignment(b.id, { step: 2, value: [8, 1] });
  r = await db.answerExerciseAssignment(b.id, { step: 3, value: ['πρώτο', 'δεύτερο', 'τρίτο'] });
  assert.deepEqual([r.starsAwarded, r.assignment.mistakes], [2, [1, 1, 0, 0]]);
  assert.equal(starsOf('u5'), before5 + 2);
});

test('a plain exercise: a wrong first try loses the star; unforgiving closes it after its tries', async () => {
  // Forgiving: she may try again (it pays nothing now), as often as she likes
  const before1 = starsOf('u1');
  const a = assign('u1', 'e-2');
  let r = await db.answerExerciseAssignment(a.id, 5);
  assert.deepEqual([r.correct, r.assignment.status], [false, 'pending']);
  r = await db.answerExerciseAssignment(a.id, 3);
  assert.deepEqual([r.correct, r.assignment.status], [false, 'pending']);
  r = await db.answerExerciseAssignment(a.id, 4);
  assert.deepEqual([r.correct, r.starsAwarded, r.assignment.status, r.assignment.starsAwarded], [true, 0, 'completed', 0]);
  const b = assign('u1', 'e-3');
  r = await db.answerExerciseAssignment(b.id, 6);
  assert.deepEqual([r.correct, r.starsAwarded], [true, 1]);
  assert.equal(starsOf('u1'), before1 + 1);

  // Unforgiving: true/false gets one try, the rest two; then it is closed, paying nothing
  const before5 = starsOf('u5');
  const tf = assign('u5', 'e-tf');
  r = await db.answerExerciseAssignment(tf.id, false);
  assert.deepEqual([r.correct, r.starsAwarded, r.assignment.status, r.assignment.starsAwarded], [false, 0, 'completed', 0]);
  await assert.rejects(db.answerExerciseAssignment(tf.id, true), /already completed/);
  const n = assign('u5', 'e-1');
  r = await db.answerExerciseAssignment(n.id, 3);
  assert.deepEqual([r.correct, r.assignment.status], [false, 'pending']);
  r = await db.answerExerciseAssignment(n.id, 2);
  assert.deepEqual([r.correct, r.starsAwarded, r.assignment.status], [true, 0, 'completed']);
  const m = assign('u5', 'e-2');
  await db.answerExerciseAssignment(m.id, 1);
  r = await db.answerExerciseAssignment(m.id, 1);
  assert.deepEqual([r.correct, r.assignment.status, r.assignment.attempts], [false, 'completed', 2]);
  assert.equal(starsOf('u5'), before5);
});

test('«Δείξε μου» on a plain exercise: only after a wrong try, and it closes it paying nothing', async () => {
  const a = assign('u1', 'e-1');
  await assert.rejects(db.revealExerciseAssignment(a.id), /wrong try first/);
  await db.answerExerciseAssignment(a.id, 7);
  const before = starsOf('u1');
  const shown = await db.revealExerciseAssignment(a.id);
  assert.deepEqual([shown.status, shown.starsAwarded], ['completed', 0]);
  assert.equal(starsOf('u1'), before);
  await assert.rejects(db.revealExerciseAssignment(a.id), /already completed/);
  const p = assign('u2', 'p-balloons');
  await db.answerExerciseAssignment(p.id, { step: 0, value: [] });
  await assert.rejects(db.revealExerciseAssignment(p.id), /step by step/);
});

test('painting freehand forgives a sloppy stroke, not a wrong fact', () => {
  // «Η Άννα είχε 40 ευρώ. Ξόδεψε 15 ευρώ. Είναι 9 χρονών. Πόσα ευρώ της έμειναν;»
  const story = 'Η Άννα είχε [40 ευρώ|known]. Ξόδεψε [15 ευρώ|known]. Είναι [9 χρονών|extra]. [Πόσα ευρώ της έμειναν|sought];';
  assert.equal(storyWords(story).length, 15);
  const targets = [
    { role: 'known' as const, words: [3], span: [3, 4] as [number, number] },
    { role: 'known' as const, words: [6], span: [6, 7] as [number, number] },
    { role: 'extra' as const, words: [9], span: [9, 10] as [number, number] },
    { role: 'sought' as const, words: [11, 12], span: [11, 14] as [number, number] },
  ];
  const n = 15;
  assert.deepEqual(checkPaint(targets, n, { known: [3, 6], sought: [11, 12] }), { correct: true });
  assert.deepEqual(checkPaint(targets, n, { known: [2, 3, 4, 5, 6, 7], sought: [11, 12, 13, 14] }), { correct: true }, 'a word around is fine');
  assert.deepEqual(checkPaint(targets, n, { known: [3], sought: [11, 12] }), { correct: false, wrong: [1] }, 'a fact missed');
  assert.deepEqual(checkPaint(targets, n, { known: [3, 6, 9], sought: [11, 12] }), { correct: false, wrong: [2] }, 'the age is not needed');
  assert.deepEqual(checkPaint(targets, n, { known: [3, 6], sought: [13] }), { correct: false, wrong: [3] }, 'the question missed');
  // "paint-all": the unneeded fact must be painted as such
  assert.deepEqual(checkPaint(targets, n, { known: [3, 6], sought: [11, 12] }, { unneeded: true }), { correct: false, wrong: [2] });
  assert.deepEqual(checkPaint(targets, n, { known: [3, 6], sought: [11, 12], extra: [9, 10] }, { unneeded: true }), { correct: true });
  assert.deepEqual(checkPaint(targets, n, { known: [3], sought: [11, 12], extra: [6, 9] }, { unneeded: true }), { correct: false, wrong: [1] }, 'a needed fact painted as unneeded');
  // From the marks: the number is the core; a fact without one, any two of its words
  const derived = targetsFromMarks(story);
  assert.deepEqual(derived, targets);
  const noNumber = targetsFromMarks('Στο τέλος [θα έχουν τον ίδιο αριθμό|known]. [Πόσες κάρτες δίνει|sought];');
  assert.deepEqual(noNumber[0], { role: 'known', words: [2, 3, 4, 5, 6], span: [2, 6], need: 2 });
  assert.equal(checkPaint(noNumber, 11, { known: [4, 6], sought: [7, 8] }).correct, true);
  assert.equal(checkPaint(noNumber, 11, { known: [5], sought: [7, 8] }).correct, false);
  const all = Array.from({ length: n }, (_, i) => i).filter(i => i !== 9);
  assert.equal(checkPaint(targets, n, { known: all, sought: [11, 12] }).wrong?.includes(-1), true, 'painting everything is too much');
});

test('working it out: each calculation is read back, the answer ends it', () => {
  const w: CalcWorld = {
    quantities: [
      { id: 's0', value: 22, label: 'Ευρώ στην αρχή' }, { id: 'e1', value: 16, label: 'Τιμή της μπάλας' },
      { id: 's1', value: 6, label: 'Ευρώ μετά την αγορά' }, { id: 'e2', value: 25, label: 'Ευρώ από τον θείο' },
      { id: 's2', value: 31, label: 'Ευρώ τώρα' }, { id: 'd', value: 2, label: 'Φορές' }, { id: 'f', value: 62, label: 'Ευρώ του Άρη' },
      { id: 'z', value: 13, label: 'Ευρώ του Πυθαγόρα' },
    ],
    relations: [{ out: 's1', op: '−', a: 's0', b: 'e1' }, { out: 's2', op: '+', a: 's1', b: 'e2' }, { out: 'f', op: '×', a: 's2', b: 'd' }],
    given: ['s0', 'e1', 'e2', 'd', 'z'], sought: 's2',
  };
  assert.equal(readCalculation(w, 22, '−', 16)?.label, 'Ευρώ μετά την αγορά');
  assert.equal(readCalculation(w, 25, '+', 6)?.id, 's2', 'either order for +');
  assert.equal(readCalculation(w, 22, '+', 13), null, 'means nothing here');
  const right = [{ x: 22, op: '−', y: 16, result: 6 }, { x: 6, op: '+', y: 25, result: 31 }] as CalcLine[];
  assert.deepEqual(checkCalc(w, right), { correct: true });
  assert.deepEqual(checkCalc(w, right.slice(0, 1)), { correct: false }, 'not there yet');
  assert.deepEqual(checkCalc(w, [{ x: 22, op: '−', y: 16, result: 5 }]), { correct: false, wrong: [0] }, 'miscounted');
  assert.deepEqual(checkCalc(w, [{ x: 6, op: '+', y: 25, result: 31 }]), { correct: false, wrong: [0] }, '6 is not hers yet');
});
