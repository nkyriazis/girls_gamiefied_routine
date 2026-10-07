import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, ProblemExercise, ProblemStep } from '../../shared/types';
import { tempDir } from './helpers';
import { applyOp, checkCalc, checkPaint, paintSentences, paintStrays, readCalculation, readLines, runLabel, smallerFirst, storyWords, targetsFromMarks, workedAnswer, workedCalc, type CalcLine, type CalcWorld } from '../../shared/problems';

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
// A calc step: 25 − 7 = 18 spent, 18 + 10 = 28 now (a pool of its own, for a grade no kid is in)
const pocket: ProblemExercise = {
  id: 'p-pocket', type: 'problem', category: 'Προβλήματα', title: 'Χαρτζιλίκι', stars: 3,
  story: 'Η Άννα είχε [25 ευρώ|known]. Ξόδεψε [7 ευρώ|known]. Πήρε [10 ευρώ|known]. [Πόσα ευρώ έχει τώρα|sought];',
  steps: [
    { kind: 'tag', phase: 'read', prompt: 'Τι ξέρουμε;' },
    {
      kind: 'calc', phase: 'solve', prompt: 'Λύνουμε',
      quantities: [{ id: 'a', value: 25, label: 'Στην αρχή' }, { id: 'b', value: 7, label: 'Ξόδεψε' }, { id: 'c', value: 18, label: 'Μετά' },
        { id: 'd', value: 10, label: 'Πήρε' }, { id: 'e', value: 28, label: 'Τώρα' }],
      relations: [{ out: 'c', op: '−', a: 'a', b: 'b' }, { out: 'e', op: '+', a: 'c', b: 'd' }],
      given: ['a', 'b', 'd'], sought: 'e',
    },
    { kind: 'choice', phase: 'check', prompt: 'Έλεγχος', options: ['28 − 10 = 18', '28 + 10 = 38'], correctIndex: 0 },
  ],
};
writeFileSync(path.join(pools, 'd.json'), JSON.stringify({ grades: [4], exercises: [pocket] }));
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
    case 'calc': return { lines: workOut(step) };
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
// painted phrase by phrase, or with `whole`, whole but the unneeded fact: a word nearest the unneeded
// fact takes the colour of the needed phrase nearest to it.
function sentencePainting(ex: ProblemExercise, unneeded: boolean, factless = false, whole = false) {
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
      if (mixed && dist(w, t) > 0) {
        if (whole) v[nearest(w, needed).role as 'known' | 'sought'].push(w);
        continue;
      }
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

test('every shipped problem: a sentence with both kinds painted whole but the unneeded fact passes on both rungs (#50)', () => {
  // Only the clause holding the unneeded fact is strict (paintStrays), so this right painting passes everywhere
  const shipped = pool.loadPools(path.join(__dirname, '..', 'exercise-pools'));
  let problems = 0;
  for (const ex of shipped.flatMap(p => p.exercises)) {
    if (ex.type !== 'problem') continue;
    const i = ex.steps.findIndex(s => s.kind === 'tag' || s.kind === 'paint');
    for (const reading of ['paint', 'paint-all'] as const) {
      assert.deepEqual(db.checkProblemStep(ex, i, sentencePainting(ex, reading === 'paint-all', false, true), reading), { correct: true }, `${ex.id} whole sentences but the unneeded fact, on ${reading}`);
    }
    problems++;
  }
  assert.ok(problems > 1000, `${problems} problems`);
});

test('every shipped problem on paint-all: the whole story ⚪ with the needed phrases painted over it is too much (#50)', () => {
  // ⚪ is forgiven only in an unneeded fact's own sentence. So the sweep passes only where every needed
  // fact's and the question's sentence has at most PAINT_SLACK words more than 2 (MARGIN) from a phrase:
  // there the sweep is a right painting.
  const shipped = pool.loadPools(path.join(__dirname, '..', 'exercise-pools'));
  let problems = 0, passed = 0;
  for (const ex of shipped.flatMap(p => p.exercises)) {
    if (ex.type !== 'problem') continue;
    const i = ex.steps.findIndex(s => s.kind === 'tag' || s.kind === 'paint');
    const read = ex.steps[i];
    const targets = read.kind === 'paint' ? read.targets : targetsFromMarks(ex.story);
    const words = storyWords(ex.story);
    const inSpan = (w: number, role: string) => targets.some(t => t.role === role && w >= t.span[0] && w <= t.span[1]);
    const known = words.map((_, w) => w).filter(w => inSpan(w, 'known'));
    const sought = words.map((_, w) => w).filter(w => inSpan(w, 'sought') && !known.includes(w));
    const extra = words.map((_, w) => w).filter(w => !known.includes(w) && !sought.includes(w));
    const r = db.checkProblemStep(ex, i, { known, sought, extra }, 'paint-all');
    problems++;
    if (!r.correct) { assert.ok(r.wrong?.includes(-1), `${ex.id}: the sweep is too much`); continue; }
    passed++;
    const far = paintSentences(words).filter(([a, b]) => targets.some(t => t.role !== 'extra' && t.span[0] <= b && t.span[1] >= a))
      .flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k))
      .filter(w => !targets.some(t => w >= t.span[0] - 2 && w <= t.span[1] + 2));
    assert.ok(far.length <= 3, `${ex.id}: the sweep passed with ${far.length} words ⚪ away from every phrase in a needed sentence`);
    assert.ok(!ex.id.startsWith('g3-gen-'), `${ex.id}: the sweep passed on a Γ΄ generated problem`);
  }
  assert.ok(problems > 1000 && passed / problems < 0.05, `the sweep passes on ${passed} of ${problems}`);
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

test('unforgiving: a problem can pay nothing, and a painted reading step costs a star like any step', async () => {
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

  // u5 paints: a wrong painting costs a star, as a wrong choice does (#50)
  const b = assign('u5', 'e-balloons');
  const before5 = starsOf('u5');
  const painted = { known: [1, 2, 5, 6], sought: [8, 9] };
  assert.equal((await db.answerExerciseAssignment(b.id, { step: 0, value: { known: [], sought: [] } })).correct, false);
  assert.equal((await db.answerExerciseAssignment(b.id, { step: 0, value: painted })).correct, true);
  await db.answerExerciseAssignment(b.id, { step: 1, value: 0 });
  await db.answerExerciseAssignment(b.id, { step: 1, value: 1 });
  await db.answerExerciseAssignment(b.id, { step: 2, value: [8, 1] });
  r = await db.answerExerciseAssignment(b.id, { step: 3, value: ['πρώτο', 'δεύτερο', 'τρίτο'] });
  assert.deepEqual([r.starsAwarded, r.assignment.mistakes], [1, [1, 1, 0, 0]]);
  assert.equal(starsOf('u5'), before5 + 1);
});

test('a calc slip goes to the server as it happens: a wrong sum or the smaller number first costs, a right sum that means nothing does not (#50)', async () => {
  const lines = [{ x: 25, op: '−', y: 7, result: 18 }, { x: 18, op: '+', y: 10, result: 28 }];
  const play = async (userId: string, slips: object[]) => {
    const a = assign(userId, 'p-pocket');
    const answer = (step: number, value: unknown) => db.answerExerciseAssignment(a.id, { step, value });
    await answer(0, ['known', 'known', 'known', 'sought']);
    const counted: number[] = [];
    for (const slip of slips) {
      const r = await answer(1, { lines: lines.slice(0, 1), slip });
      assert.deepEqual([r.correct, r.assignment.stepIndex], [false, 1], 'a slip is not an answer');
      counted.push(r.assignment.mistakes![1]);
    }
    assert.equal((await answer(1, { lines, slips: 9 })).correct, true, 'the old count of slips taken back is ignored');
    return { counted, paid: await answer(2, 0) };
  };
  const before = starsOf('u2');
  // After 25 − 7 = 18: 18 + 10 = 27 (math), 10 − 18 (order), 25 + 10 = 35 (right, but nothing here)
  let { counted, paid } = await play('u2', [{ x: 18, op: '+', y: 10, result: 27 }, { x: 10, op: '−', y: 18, result: 8 }, { x: 25, op: '+', y: 10, result: 35 }]);
  assert.deepEqual(counted, [1, 2, 2]);
  assert.deepEqual([paid.starsAwarded, paid.assignment.mistakes], [2, [0, 2, 0]]);
  // Only right sums that mean nothing: the full price
  ({ counted, paid } = await play('u2', [{ x: 25, op: '+', y: 10, result: 35 }, { x: 25, op: '+', y: 7, result: 32 }]));
  assert.deepEqual([counted, paid.starsAwarded], [[0, 0], 3]);
  assert.equal(starsOf('u2'), before + 5);
  // Unforgiving: two counted slips, then the step is shown worked (its lines pass), and it costs its star
  ({ counted, paid } = await play('u4', [{ x: 18, op: '+', y: 10, result: 29 }, { x: 18, op: '+', y: 10, result: 27 }]));
  assert.deepEqual([counted, paid.starsAwarded], [[1, 2], 2]);
  // A slip for a step already solved changes nothing
  const a = assign('u2', 'p-pocket');
  await db.answerExerciseAssignment(a.id, { step: 0, value: ['known', 'known', 'known', 'sought'] });
  await db.answerExerciseAssignment(a.id, { step: 1, value: { lines } });
  const r = await db.answerExerciseAssignment(a.id, { step: 1, value: { lines, slip: { x: 18, op: '+', y: 10, result: 27 } } });
  assert.deepEqual(r.assignment.mistakes, [0, 0, 0]);
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
  // ⚪ is forgiven only in an unneeded fact's own sentence: elsewhere it counts like any stroke
  assert.deepEqual(checkPaint(targets, words, { ...sentences, extra: [...none, ...toys] }, { unneeded: true }), ok, '⚪ on a short sentence with no fact: within PAINT_SLACK');
  const sweep = { known: words.map((_, w) => w).filter(w => targets.some(t => t.role === 'known' && w >= t.span[0] && w <= t.span[1])), sought: targets[3].words };
  const rest = words.map((_, w) => w).filter(w => !sweep.known.includes(w) && !sweep.sought.includes(w));
  assert.deepEqual(checkPaint(targets, words, { ...sweep, extra: rest }, { unneeded: true }), { correct: false, wrong: [-1] }, 'the whole story ⚪, the needed phrases painted over it');
  assert.deepEqual(paintStrays(targets, words, { known: [], sought: [], extra: price }), price, '⚪ over a needed fact\'s sentence: every word of it, «18 ευρώ» too');
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

test('a sentence with a needed and an unneeded fact: only the clause holding the unneeded one is strict (#50)', () => {
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const ok = { correct: true };
  // «Η βιβλιοθήκη του σχολείου, [που έχει 3 ράφια], δάνεισε τον Οκτώβριο [390 βιβλία]. …»: the needed
  // sentences painted whole, the unneeded clause «που έχει 3 ράφια,» left out
  const library = 'Η βιβλιοθήκη του σχολείου, [που έχει 3 ράφια|extra], δάνεισε τον Οκτώβριο [390 βιβλία|known]. [Τα 250 ήταν παραμύθια|known] και τα υπόλοιπα κόμικ και βιβλία γνώσεων. '
    + 'Ξέρουμε ακόμα ότι [τα κόμικ ήταν τριπλάσια από τα βιβλία γνώσεων|known]. [Πόσα κόμικ|sought] και [πόσα βιβλία γνώσεων|sought];';
  const words = storyWords(library), targets = targetsFromMarks(library);
  const whole = { known: [...range(0, 3), ...range(8, 34)], sought: range(35, 40) };
  assert.deepEqual(paintStrays(targets, words, whole), [], '«Η βιβλιοθήκη του σχολείου, … δάνεισε» is not around the unneeded fact');
  assert.deepEqual(checkPaint(targets, words, whole), ok);
  assert.deepEqual(checkPaint(targets, words, { ...whole, extra: range(4, 7) }, { unneeded: true }), ok, '…and on paint-all, the clause ⚪');
  // The unneeded fact painted with its sentence: named, as before
  assert.deepEqual(checkPaint(targets, words, { ...whole, known: range(0, 34) }), { correct: false, wrong: [0] });

  // In the clause holding the unneeded fact, the words around it are still too much
  const shop = 'Η Ζωή έχει [18 ευρώ|known], και στο ράφι της βιτρίνας δίπλα στην πόρτα υπάρχουν [23 παιχνίδια|extra]. [Πόσα ευρώ|sought] της λείπουν για [μια μπάλα των 25 ευρώ|known];';
  const shopWords = storyWords(shop), shopTargets = targetsFromMarks(shop);
  assert.equal(shopWords[14], '23');
  const painted = { known: [...range(0, 13), ...range(21, 25)], sought: range(16, 20) };
  assert.deepEqual(paintStrays(shopTargets, shopWords, painted), range(7, 13), '«στο ράφι της βιτρίνας δίπλα στην πόρτα υπάρχουν», less the margin');
  assert.deepEqual(checkPaint(shopTargets, shopWords, painted), { correct: false, wrong: [-1] });

  // A colon ends a clause too: a table's intro is not around its first row
  const table = 'Ο πίνακας δείχνει πόσους επισκέπτες είχε ένα μουσείο κάθε χρονιά: [2019: 245.301|extra], [2020: 198.004|known], [2021: 300.250|known]. [Πόσους επισκέπτες είχε το 2020 και το 2021 μαζί|sought];';
  const tableWords = storyWords(table), tableTargets = targetsFromMarks(table);
  assert.deepEqual(checkPaint(tableTargets, tableWords, { known: [...range(0, 9), ...range(12, 15)], sought: range(16, 24) }), ok);
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

// Lines as she writes them: '58 − 9 = 49, 49 − 9 = 40'
const L = (s: string): CalcLine[] => s.split(',').map(t => {
  const [x, op, y, , r] = t.trim().split(' ');
  return { x: +x, op: op as CalcLine['op'], y: +y, result: +r };
});
// g3-world-022: four envelopes of 9 stamps, now 58: how many at first (9 × 4 = 36, 58 − 36 = 22)
const stamps: CalcWorld = {
  quantities: [
    { id: 's0', value: 22, label: 'Γραμματόσημα στην αρχή', unit: 'γραμματόσημα' }, { id: 'e1n', value: 4, label: 'Φάκελοι', unit: 'φάκελοι' },
    { id: 'e1m', value: 9, label: 'Γραμματόσημα σε κάθε φάκελο', unit: 'γραμματόσημα' }, { id: 'e1', value: 36, label: 'Γραμματόσημα στους φακέλους', unit: 'γραμματόσημα' },
    { id: 's1', value: 58, label: 'Γραμματόσημα τώρα', unit: 'γραμματόσημα' }, { id: 'z', value: 13, label: 'Γραμματόσημα της Ελένης', unit: 'γραμματόσημα' },
  ],
  relations: [{ out: 'e1', op: '×', a: 'e1n', b: 'e1m' }, { out: 's1', op: '+', a: 's0', b: 'e1' }],
  given: ['e1n', 'e1m', 's1', 'z'], sought: 's0',
};
// g3-world-139: 68 cards, two packs of 8: how many now (2 × 8 = 16, 68 + 16 = 84)
const cards: CalcWorld = {
  quantities: [
    { id: 's0', value: 68, label: 'Κάρτες στην αρχή', unit: 'κάρτες' }, { id: 'e1n', value: 2, label: 'Πακέτα', unit: 'πακέτα' },
    { id: 'e1m', value: 8, label: 'Κάρτες σε κάθε πακέτο', unit: 'κάρτες' }, { id: 'e1', value: 16, label: 'Κάρτες στα πακέτα', unit: 'κάρτες' },
    { id: 's1', value: 84, label: 'Κάρτες τώρα', unit: 'κάρτες' },
  ],
  relations: [{ out: 'e1', op: '×', a: 'e1n', b: 'e1m' }, { out: 's1', op: '+', a: 's0', b: 'e1' }],
  given: ['s0', 'e1n', 'e1m'], sought: 's1',
};
const ok = { correct: true };

test('working it out: the same quantity taken away again and again reads back, up to the count (#50)', () => {
  // One envelope at a time: each step short of 4 is a run step, the 4th is where it was heading
  const r = readLines(stamps, L('58 − 9 = 49, 49 − 9 = 40, 40 − 9 = 31, 31 − 9 = 22'));
  assert.deepEqual(r.lines.map(l => l?.kind), ['run', 'run', 'run', 'quantity']);
  assert.deepEqual(r.lines.slice(0, 3).map(l => (l?.kind === 'run' ? runLabel(l.run) : null)), ['58 − 9', '58 − 9 − 9', '58 − 9 − 9 − 9']);
  assert.equal(r.lines[0]?.kind === 'run' && r.lines[0].run.target.id, 's0', 'heading for 58 − 36');
  assert.equal(r.lines[3]?.kind === 'quantity' && r.lines[3].q.id, 's0');
  assert.deepEqual(checkCalc(stamps, L('58 − 9 = 49, 49 − 9 = 40, 40 − 9 = 31, 31 − 9 = 22')), ok);
  // Only the run's latest value is hers to use: 49 is gone once 40 is there
  const two = readLines(stamps, L('58 − 9 = 49, 49 − 9 = 40'));
  assert.ok(two.have.has(40) && !two.have.has(49));
  assert.deepEqual(checkCalc(stamps, L('58 − 9 = 49, 49 − 9 = 40, 49 − 9 = 40')), { correct: false, wrong: [2] });
  // Past the count, it means nothing
  assert.deepEqual(checkCalc(stamps, L('58 − 9 = 49, 49 − 9 = 40, 40 − 9 = 31, 31 − 9 = 22, 22 − 9 = 13')), { correct: false, wrong: [4] });
  // Lines in between don't break a run: it follows its latest value
  assert.deepEqual(checkCalc(stamps, L('58 − 9 = 49, 9 × 4 = 36, 49 − 9 = 40, 40 − 9 = 31, 31 − 9 = 22')), ok);
  // Added up, then taken off: 9 + 9 + 9 + 9 is the stamps in the envelopes
  const up = readLines(stamps, L('9 + 9 = 18, 18 + 9 = 27, 27 + 9 = 36'));
  assert.deepEqual(up.lines.map(l => (l?.kind === 'run' ? runLabel(l.run) : l?.kind === 'quantity' ? l.q.id : null)), ['9 + 9', '9 + 9 + 9', 'e1']);
  assert.deepEqual(checkCalc(stamps, L('9 + 9 = 18, 18 + 9 = 27, 27 + 9 = 36, 58 − 36 = 22')), ok);
  // Mixed: two envelopes added (18), taken off the stock at once, then one at a time or two again
  assert.deepEqual(checkCalc(stamps, L('9 + 9 = 18, 58 − 18 = 40, 40 − 9 = 31, 31 − 9 = 22')), ok);
  assert.deepEqual(checkCalc(stamps, L('9 + 9 = 18, 58 − 18 = 40, 40 − 18 = 22')), ok);
  const mixed = readLines(stamps, L('9 + 9 = 18, 58 − 18 = 40'));
  assert.equal(mixed.lines[1]?.kind === 'run' && runLabel(mixed.lines[1].run), '58 − 9 − 9');
  assert.deepEqual(checkCalc(stamps, L('9 + 9 = 18, 58 − 18 = 40, 40 − 18 = 22, 22 − 9 = 13')), { correct: false, wrong: [3] }, 'one too many');
  // Still nothing: the count added, a run heading nowhere, a number not hers
  assert.deepEqual(checkCalc(stamps, L('4 + 4 = 8')), { correct: false, wrong: [0] });
  assert.deepEqual(checkCalc(stamps, L('13 + 9 = 22')), { correct: false, wrong: [0] }, '13 + 36 means nothing here');
  assert.deepEqual(checkCalc(stamps, L('58 − 10 = 48')), { correct: false, wrong: [0] });
  // Without the count, no run: she would be counting how many times
  const noCount = { ...stamps, given: ['e1m', 's1', 's0'], sought: 'e1n' };
  assert.equal(readLines(noCount, L('9 + 9 = 18')).lines[0], null);
});

test('working it out: a pack at a time, the two packs added, «διπλάσια» (#50)', () => {
  assert.deepEqual(checkCalc(cards, L('8 + 8 = 16, 68 + 16 = 84')), ok, 'the two packs: the whole product');
  assert.equal(readLines(cards, L('8 + 8 = 16')).lines[0]?.kind === 'quantity' && (readLines(cards, L('8 + 8 = 16')).lines[0] as { q: { label: string } }).q.label, 'Κάρτες στα πακέτα');
  assert.deepEqual(checkCalc(cards, L('68 + 8 = 76, 76 + 8 = 84')), ok, 'a pack at a time');
  assert.deepEqual(checkCalc(cards, L('8 + 68 = 76, 8 + 76 = 84')), ok, 'either order for +');
  assert.deepEqual(checkCalc(cards, L('68 + 8 = 76, 76 + 8 = 84, 84 + 8 = 92')), { correct: false, wrong: [2] }, 'a third pack');
  assert.deepEqual(checkCalc(cards, L('2 + 2 = 4')), { correct: false, wrong: [0] }, 'the count, not the cards');
  const double: CalcWorld = {
    quantities: [{ id: 's2', value: 38, label: 'Ευρώ της Άννας', unit: 'ευρώ' }, { id: 'd', value: 2, label: 'Φορές', unit: 'φορές' }, { id: 'f', value: 76, label: 'Ευρώ του Άρη', unit: 'ευρώ' }],
    relations: [{ out: 'f', op: '×', a: 's2', b: 'd' }], given: ['s2', 'd'], sought: 'f',
  };
  assert.deepEqual(checkCalc(double, L('38 + 38 = 76')), ok);
  // A world without units has no runs (only the relations' own ways)
  const bare = { ...cards, quantities: cards.quantities.map(({ unit: _, ...q }) => q) };
  assert.deepEqual(checkCalc(bare, L('8 + 8 = 16, 68 + 16 = 84')), { correct: false, wrong: [0, 1] });
});

test('working it out: a run step that is also a quantity is read both ways (#50)', () => {
  // 58 − 9 = 49 is a quantity of its own here, and the first step of taking the envelopes off
  const w: CalcWorld = {
    ...stamps,
    quantities: [...stamps.quantities, { id: 'h', value: 49, label: 'Γραμματόσημα χωρίς έναν φάκελο', unit: 'γραμματόσημα' }],
    relations: [...stamps.relations, { out: 'h', op: '−', a: 's1', b: 'e1m' }],
  };
  const r = readLines(w, L('58 − 9 = 49, 49 − 9 = 40, 40 − 9 = 31, 31 − 9 = 22'));
  assert.equal(r.lines[0]?.kind === 'quantity' && r.lines[0].q.id, 'h');
  assert.equal(r.lines[1]?.kind === 'run' && runLabel(r.lines[1].run), '58 − 9 − 9');
  assert.deepEqual(checkCalc(w, L('58 − 9 = 49, 49 − 9 = 40, 40 − 9 = 31, 31 − 9 = 22')), ok);
  // …and a partial that happens to equal a quantity she found: used both ways
  const w2: CalcWorld = {
    ...stamps,
    quantities: [...stamps.quantities, { id: 'k', value: 40, label: 'Γραμματόσημα του Νίκου', unit: 'γραμματόσημα' }, { id: 'k2', value: 53, label: 'Γραμματόσημα μαζί', unit: 'γραμματόσημα' }],
    relations: [...stamps.relations, { out: 'k2', op: '+', a: 'k', b: 'z' }], given: [...stamps.given, 'k'],
  };
  assert.deepEqual(checkCalc(w2, L('58 − 9 = 49, 49 − 9 = 40, 40 + 13 = 53, 40 − 9 = 31, 31 − 9 = 22')), ok);
});

test('the smaller number first, in a subtraction or a division (#50)', () => {
  assert.equal(smallerFirst('−', 36, 58), true);
  assert.equal(smallerFirst('−', 58, 36), false);
  assert.equal(smallerFirst(':', 6, 18), true);
  assert.equal(smallerFirst(':', 18, 6), false);
  assert.equal(smallerFirst('+', 3, 9), false);
  assert.equal(smallerFirst('×', 3, 9), false);
});

test('every shipped world problem with a × on its way: the same way with the × done as a run passes (#50)', () => {
  const shipped = pool.loadPools(path.join(__dirname, '..', 'exercise-pools'));
  let runs = 0, stocks = 0;
  for (const ex of shipped.flatMap(p => p.exercises)) {
    if (ex.type !== 'problem') continue;
    for (const step of ex.steps) {
      if (step.kind !== 'calc') continue;
      const lines = workedCalc(step);
      const at = lines.findIndex(l => l.op === '×');
      if (at < 0) continue;
      const q = new Map(step.quantities.map(x => [x.id, x]));
      const product = lines[at].result;
      const rel = step.relations.find(r => r.op === '×' && q.get(r.out)!.value === product)!;
      const [m, n] = [rel.a, rel.b].map(id => q.get(id)!).sort((a, b) => Number(b.unit === q.get(rel.out)!.unit) - Number(a.unit === q.get(rel.out)!.unit)).map(x => x.value);
      // m + m + … n times, in place of the ×
      const run = Array.from({ length: n - 1 }, (_, i) => ({ x: (i + 1) * m, op: '+' as const, y: m, result: (i + 2) * m }));
      assert.deepEqual(checkCalc(step, [...lines.slice(0, at), ...run, ...lines.slice(at + 1)]), ok, `${ex.id}: ${m} + ${m} … ${n} times`);
      runs++;
      // The product applied to a stock once: the run straight from the stock instead
      const uses = lines.map((l, i) => ({ l, i })).filter(({ l, i }) => i > at && (l.x === product || l.y === product));
      if (uses.length !== 1 || !['+', '−'].includes(uses[0].l.op)) continue;
      const { l, i } = uses[0];
      if (l.op === '−' && l.y !== product) continue;
      const B = l.x === product ? l.y : l.x;
      const fromStock = Array.from({ length: n }, (_, k) => ({ x: applyOp(l.op, B, k * m), op: l.op, y: m, result: applyOp(l.op, B, (k + 1) * m) }));
      const way = [...lines.slice(0, at), ...lines.slice(at + 1, i), ...fromStock, ...lines.slice(i + 1)];
      assert.deepEqual(checkCalc(step, way), ok, `${ex.id}: ${B} ${l.op} ${m} … ${n} times`);
      stocks++;
    }
  }
  assert.ok(runs >= 49 && stocks > 20, `${runs} runs, ${stocks} from a stock`);
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
