import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, ProblemExercise, ProblemStep } from '../../shared/types';
import { tempDir } from './helpers';
import { applyOp, checkCalc, checkPaint, paintSentences, paintStrays, readCalculation, storyWords, targetsFromMarks, workedAnswer, type CalcLine, type CalcWorld } from '../../shared/problems';

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

// The story painted in whole sentences: each word of a sentence takes the colour of the phrase in it
// nearest to it; a sentence of unneeded facts only, ⚪ (on "paint-all") or nothing; with `factless`, the
// sentences with no fact in them 🟢 too. A sentence that holds a needed and an unneeded fact is
// painted phrase by phrase: around an unneeded fact is too much (33 Γ΄ and 224 Ε΄ problems).
function sentencePainting(ex: ProblemExercise, unneeded: boolean, factless = false) {
  const read = ex.steps.find(s => s.kind === 'tag' || s.kind === 'paint')!;
  const targets = read.kind === 'paint' ? read.targets : targetsFromMarks(ex.story);
  const v = { known: [] as number[], sought: [] as number[], extra: [] as number[] };
  const dist = (w: number, t: (typeof targets)[number]) => (w < t.span[0] ? t.span[0] - w : w > t.span[1] ? w - t.span[1] : 0);
  const nearest = <T extends (typeof targets)[number]>(w: number, ts: T[]) => ts.reduce((a, b) => (dist(w, b) < dist(w, a) ? b : a));
  for (const [a, b] of paintSentences(storyWords(ex.story))) {
    const ts = targets.filter(t => t.span[0] <= b && t.span[1] >= a);
    const needed = ts.filter(t => t.role !== 'extra');
    const mixed = needed.length && needed.length < ts.length;
    for (let w = a; w <= b; w++) {
      if (!ts.length) { if (factless) v.known.push(w); continue; }
      const t = nearest(w, ts);
      if (mixed && dist(w, t) > 0) continue;
      if (t.role !== 'extra') v[t.role].push(w);
      else if (unneeded) v.extra.push(w);
    }
  }
  return unneeded ? v : { known: v.known, sought: v.sought };
}

test('every shipped problem: whole sentences pass on both rungs; the whole story fails where something is not needed (#50)', () => {
  const shipped = pool.loadPools(path.join(__dirname, '..', 'exercise-pools'));
  let problems = 0, withExtra = 0;
  for (const ex of shipped.flatMap(p => p.exercises)) {
    if (ex.type !== 'problem') continue;
    const i = ex.steps.findIndex(s => s.kind === 'tag' || s.kind === 'paint');
    for (const reading of ['paint', 'paint-all'] as const) {
      const unneeded = reading === 'paint-all';
      assert.deepEqual(db.checkProblemStep(ex, i, sentencePainting(ex, unneeded), reading), { correct: true }, `${ex.id} whole sentences on ${reading}`);
      assert.deepEqual(db.checkProblemStep(ex, i, sentencePainting(ex, unneeded, true), reading), { correct: true }, `${ex.id} whole sentences and the ones with no fact, on ${reading}`);
    }
    // The whole story 🟢, the question's sentence 🟡: wrong on the unneeded fact, wherever there is one
    const words = storyWords(ex.story);
    const sentences = paintSentences(words);
    const read = ex.steps[i];
    const targets = read.kind === 'paint' ? read.targets : targetsFromMarks(ex.story);
    const [qa, qb] = sentences.find(([a, b]) => targets.some(t => t.role === 'sought' && t.words[0] >= a && t.words[0] <= b))!;
    const all = words.map((_, w) => w);
    const story = { known: all.filter(w => w < qa || w > qb), sought: all.filter(w => w >= qa && w <= qb) };
    const extras = targets.flatMap((t, k) => (t.role === 'extra' ? [k] : []));
    const r = db.checkProblemStep(ex, i, story, 'paint');
    if (extras.length) {
      withExtra++;
      assert.equal(r.correct, false, `${ex.id}: the whole story`);
      assert.ok(extras.some(k => r.wrong?.includes(k)), `${ex.id}: the whole story is wrong on an unneeded fact`);
    }
    problems++;
  }
  assert.ok(problems > 1000 && withExtra > 1000, `${problems} problems, ${withExtra} with an unneeded fact`);
});

test('every shipped plain exercise: the server takes its own key and refuses a wrong answer', () => {
  const shipped = pool.loadPools(path.join(__dirname, '..', 'exercise-pools'));
  let n = 0;
  for (const ex of shipped.flatMap(p => p.exercises)) {
    const [right, wrong] = ((): [unknown, unknown] => {
      switch (ex.type) {
        case 'multiple-choice': return [ex.correctIndex, (ex.correctIndex + 1) % ex.options.length];
        case 'true-false': return [ex.correctValue, !ex.correctValue];
        case 'number-input': return [ex.correctValue, ex.correctValue + 1];
        case 'match-pairs': return [ex.pairs, ex.pairs.map((p, i) => ({ left: p.left, right: ex.pairs[(i + 1) % ex.pairs.length].right }))];
        case 'ordering': return [ex.items.map(i => i.id), [...ex.items].reverse().map(i => i.id)];
        case 'fill-blank': return [ex.correctAnswers, ex.correctAnswers.map(a => ex.options.find(o => o !== a))];
        case 'problem': return [undefined, undefined];
      }
    })();
    if (ex.type === 'problem') continue;
    assert.equal(db.checkExerciseAnswer(ex, right), true, `${ex.id}: its own key`);
    assert.equal(db.checkExerciseAnswer(ex, wrong), false, `${ex.id}: a wrong answer`);
    n++;
  }
  assert.ok(n > 0, 'no plain exercises shipped');
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

test('a plain pool exercise names its textbook chapter, as a problem does', () => {
  const plain = path.join(dir, 'plain');
  mkdirSync(plain);
  const source = 'Μαθηματικά Γ΄, κεφ. 4: Πολλαπλασιασμός, προπαίδεια (Ι)';
  const base = { category: 'Μαθηματικά', title: 'x', stars: 1, source };
  writeFileSync(path.join(plain, 'x.json'), JSON.stringify({ grades: [3], exercises: [
    { ...base, id: 'n', type: 'number-input', question: 'Πόσο κάνει 6 × 7;', correctValue: 42 },
    { ...base, id: 'c', type: 'multiple-choice', question: 'Πόσο κάνει 6 × 7;', options: ['42', '48'], correctIndex: 0 },
    { ...base, id: 't', type: 'true-false', question: 'Το 6 × 7 είναι 42.', correctValue: true },
    { ...base, id: 'm', type: 'match-pairs', pairs: [{ left: '6 × 7', right: '42' }, { left: '6 × 8', right: '48' }] },
    { ...base, id: 'o', type: 'ordering', items: [{ id: 'a', content: '42' }, { id: 'b', content: '48' }] },
    { ...base, id: 'f', type: 'fill-blank', textWithGaps: '6 × {0} = 42', options: ['7', '8'], correctAnswers: ['7'] },
  ] }));
  const [loaded] = pool.loadPools(plain);
  assert.deepEqual(loaded.exercises.map(e => e.source), Array(6).fill(source));
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
  const n = storyWords(story);
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
  assert.equal(checkPaint(noNumber, storyWords('Στο τέλος θα έχουν τον ίδιο αριθμό. Πόσες κάρτες δίνει;'), { known: [4, 6], sought: [7, 8] }).correct, true);
  assert.equal(checkPaint(noNumber, storyWords('Στο τέλος θα έχουν τον ίδιο αριθμό. Πόσες κάρτες δίνει;'), { known: [5], sought: [7, 8] }).correct, false);
  const story0 = Array.from({ length: 11 }, (_, i) => i);
  assert.deepEqual(checkPaint(targets, n, { known: story0, sought: [11, 12, 13, 14] }), { correct: false, wrong: [2] }, 'the whole story: the age is painted');
});

test('painting a needed fact\'s whole sentence is fine; around an unneeded fact it is too much (#50)', () => {
  // Sentences end at . ; · ! ? …, before closing » ) ”; «9.238» and «3,5» end nothing
  assert.deepEqual(paintSentences(['Έχει', '9.238', 'ευρώ.', 'Πήρε', '3,5·', 'μετά', 'είπε', '«Φτάνει!»', '(Ναι.)', 'Πόσα', 'έμειναν;']),
    [[0, 2], [3, 4], [5, 7], [8, 8], [9, 10]]);
  assert.deepEqual(paintSentences(['Έχει', '5', 'ευρώ']), [[0, 2]], 'the last sentence needs no full stop');
  assert.deepEqual(paintSentences(['Τι', 'λες;', 'Ναι']), [[0, 1], [2, 2]], 'the Greek question mark (U+037E) too');

  const story = 'Είναι Σάββατο πρωί. Στο μαγαζί της γειτονιάς μια μπάλα κοστίζει [18 ευρώ|known]. '
    + 'Στο ράφι της βιτρίνας, δίπλα στην πόρτα, υπάρχουν [23 παιχνίδια|extra]. Η Ζωή [πληρώνει με 100 ευρώ|known]· [πόσα ρέστα θα πάρει|sought];';
  const words = storyWords(story);
  const targets = targetsFromMarks(story); // 0: 18 ευρώ, 1: 23 παιχνίδια (unneeded), 2: 100 ευρώ, 3: the question
  const ss = paintSentences(words);
  assert.equal(ss.length, 5);
  const [none, price, toys, paid, question] = ss.map(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));
  const ok = { correct: true };
  const sentences = { known: [...price, ...paid], sought: question };
  assert.deepEqual(checkPaint(targets, words, sentences), ok, 'each needed sentence whole, the unneeded one left alone');
  assert.deepEqual(checkPaint(targets, words, { ...sentences, extra: toys }, { unneeded: true }), ok, '…and on paint-all, the unneeded one ⚪ whole');
  assert.deepEqual(checkPaint(targets, words, { ...sentences, known: [...none, ...sentences.known] }), ok, 'a sentence with no fact, painted: nothing there is wrong');
  assert.deepEqual(checkPaint(targets, words, { ...sentences, extra: [...none, ...toys] }, { unneeded: true }), ok, '⚪ is never too much');
  // The whole story: the unneeded fact is painted (named), and its sentence around it is too much
  assert.deepEqual(checkPaint(targets, words, { known: [...none, ...price, ...toys, ...paid], sought: question }), { correct: false, wrong: [1, -1] });
  // Around the unneeded fact, beyond the margin, in its sentence: strays (the frames on screen)
  const around = toys.slice(2, 8); // «της βιτρίνας, δίπλα στην πόρτα, υπάρχουν»
  assert.deepEqual(paintStrays(targets, words, { ...sentences, known: [...sentences.known, ...toys.slice(0, 8)] }), around, 'two words after «18 ευρώ.» are within the margin');
  assert.deepEqual(checkPaint(targets, words, { ...sentences, known: [...sentences.known, ...around] }), { correct: false, wrong: [-1] });
  assert.deepEqual(checkPaint(targets, words, { ...sentences, known: [...sentences.known, ...around.slice(0, 3)] }), ok, 'up to PAINT_SLACK forgiven');

  // Still wrong: an unneeded fact inside a needed sentence painted with it (named)…
  const age = 'Η Υπατία είναι [7 χρονών|known] και ζυγίζει [26 κιλά|extra]. [Σε πόσα χρόνια|sought] θα είναι 10;';
  const ageWords = storyWords(age);
  assert.deepEqual(checkPaint(targetsFromMarks(age), ageWords, { known: [0, 1, 2, 3, 4, 5, 6, 7, 8], sought: [9, 10, 11, 12, 13, 14] }), { correct: false, wrong: [1] });
  assert.deepEqual(checkPaint(targetsFromMarks(age), ageWords, { known: [0, 1, 2, 3, 4, 5, 6], sought: [9, 10, 11, 12, 13, 14] }), ok, 'without it');
  // …and a question sharing its sentence with a needed fact, painted all 🟡: the fact is missed
  const ifPaid = 'Αν η Ζωή πληρώνει με [100 ευρώ|known], [πόσα ρέστα θα πάρει|sought];';
  assert.deepEqual(checkPaint(targetsFromMarks(ifPaid), storyWords(ifPaid), { known: [], sought: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }), { correct: false, wrong: [0] });
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

test('a problem regenerated under its id (#50): progress that no longer fits it starts again at step 0', async () => {
  // p-balloons has 4 steps. Progress stored for an older version of the problem: a step past
  // the end, or mistakes counted for another number of steps
  const today = (await db.getExerciseAssignments('u4'))[0].date;
  const put = (exerciseId: string, stepIndex: number, mistakes: number[]) => {
    const a = { ...assign('u4', exerciseId), date: today, stepIndex, mistakes, attempts: 3 };
    store.exerciseAssignments.put(a);
    return a;
  };
  const past = put('p-balloons', 4, [0, 1, 0, 0]);
  const other = put('p-two', 1, [1, 0]);
  const fits = put('p-three', 2, [1, 0, 0, 0]);
  const shown = new Map((await db.getExerciseAssignments('u4')).map(a => [a.id, a]));
  assert.deepEqual([shown.get(past.id)!.stepIndex, shown.get(past.id)!.mistakes], [0, undefined], 'shown from the start');
  assert.deepEqual([shown.get(other.id)!.stepIndex, shown.get(other.id)!.mistakes], [0, undefined]);
  assert.deepEqual([shown.get(fits.id)!.stepIndex, shown.get(fits.id)!.mistakes], [2, [1, 0, 0, 0]], 'progress that fits is kept');

  // Answered from step 0, with mistakes counted afresh
  let r = await db.answerExerciseAssignment(past.id, { step: 0, value: ['known', 'known', 'extra', 'sought'] });
  assert.deepEqual([r.correct, r.assignment.stepIndex, r.assignment.mistakes], [true, 1, [0, 0, 0, 0]]);
  r = await db.answerExerciseAssignment(other.id, { step: 0, value: ['known', 'known', 'known', 'sought'] });
  assert.deepEqual([r.correct, r.assignment.stepIndex ?? 0, r.assignment.mistakes], [false, 0, [1, 0, 0, 0]]);
  // A fitting one goes on where it was: step 0 again is a repeat
  r = await db.answerExerciseAssignment(fits.id, { step: 0, value: ['known', 'known', 'extra', 'sought'] });
  assert.deepEqual([r.correct, r.assignment.stepIndex, r.assignment.mistakes], [true, 2, [1, 0, 0, 0]]);
});
