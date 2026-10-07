import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { DataConfig, Exercise, SchoolGrade } from '../../shared/types';
import { tempDir } from './helpers';

// The daily set (#49): a pool's `grades` are the grades it is written for; `revision`
// grades get it only when their own grade has nothing in a category. The set follows
// DAILY_MIX (problem, maths, language), freshest first within each category.

const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [
    { id: 'g3', name: 'Γ', avatar: icon, color: 'blue', grade: 3 },
    { id: 'g4', name: 'Δ', avatar: icon, color: 'red', grade: 4 },
    { id: 'g1', name: 'Α', avatar: icon, color: 'green', grade: 1 },
  ],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [],
  settings: { timezone: 'Europe/Athens' }
};

const plain = (id: string, category: string): Exercise =>
  ({ id, type: 'number-input', category, title: id, question: '1 + 1', correctValue: 2, stars: 1 });
const problem = (id: string): Exercise => ({
  id, type: 'problem', category: 'Προβλήματα', title: id, stars: 3,
  story: 'Έχει [25 ευρώ|known]. [Πόσα μπαλόνια|sought];',
  steps: [{ kind: 'choice', phase: 'plan', prompt: 'Πράξη;', options: ['25 + 3', '25 : 3'], correctIndex: 1 }]
});
const many = (prefix: string, n: number, make: (id: string) => Exercise) => Array.from({ length: n }, (_, i) => make(`${prefix}${i + 1}`));

const pools = path.join(dir, 'pools');
mkdirSync(pools);
// Γ΄: problems and maths of its own, no language; Β΄ revision has maths and language
writeFileSync(path.join(pools, 'g.json'), JSON.stringify({ grades: [3], exercises: [...many('P', 5, problem), ...many('M', 4, id => plain(id, 'Μαθηματικά'))] }));
writeFileSync(path.join(pools, 'b.json'), JSON.stringify({
  grades: [2], revision: [3],
  exercises: [...many('rM', 3, id => plain(id, 'Μαθηματικά')), ...many('rL', 3, id => plain(id, 'Γλώσσα'))]
}));
// Δ΄: maths and language, no problems
writeFileSync(path.join(pools, 'd.json'), JSON.stringify({
  grades: [4], exercises: [...many('dM', 4, id => plain(id, 'Μαθηματικά')), ...many('dL', 4, id => plain(id, 'Γλώσσα'))]
}));
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

const loaded = pool.loadPools(pools);
const of = (grade: SchoolGrade) => pool.poolsForGrade(loaded, grade);
const draw = (grade: SchoolGrade, count: number, seen = new Map<string, string>(), turn = 0) => pool.drawDailySet(of(grade), count, seen, turn);
const ids = (grade: SchoolGrade, count: number, turn = 0) => draw(grade, count, undefined, turn).drawn.map(e => e.id);
const kind = (id: string) => id.replace(/\d+$/, '');

test('a pool is written for its grades and serves its revision grades apart', () => {
  assert.deepEqual(of(3).own.map(e => e.id).sort(), [...many('M', 4, id => plain(id, '')), ...many('P', 5, problem)].map(e => e.id).sort());
  assert.deepEqual(of(3).revision.map(e => e.id).sort(), ['rL1', 'rL2', 'rL3', 'rM1', 'rM2', 'rM3']);
  assert.equal(of(2).own.length, 6);
  assert.equal(of(2).revision.length, 0);
  assert.deepEqual(of(1), { own: [], revision: [] });
});

test('a pool may not list a grade both as written for and as revision', () => {
  const bad = path.join(dir, 'bad');
  mkdirSync(bad);
  writeFileSync(path.join(bad, 'x.json'), JSON.stringify({ grades: [2, 3], revision: [3], exercises: [plain('x1', 'Γλώσσα')] }));
  assert.throws(() => pool.loadPools(bad), /grade 3 .*both/);
});

test('the set follows the mix: problem, then maths, then language', () => {
  assert.deepEqual(pool.DAILY_MIX, ['Προβλήματα', 'Μαθηματικά', 'Γλώσσα']);
  for (let day = 0; day < 20; day++) assert.deepEqual(ids(3, 3).map(kind), ['P', 'M', 'rL']);
});

test('own items before revision; revision only for a category the grade lacks', () => {
  const { drawn, revision } = draw(3, 3);
  assert.equal(drawn[1].category, 'Μαθηματικά');
  assert.ok(drawn[1].id.startsWith('M'), 'maths of its own grade, though the revision maths is as fresh');
  assert.deepEqual(revision, [drawn[2].id]);
  // Even when every own maths item was seen today and the revision ones never
  const seen = new Map(many('M', 4, id => plain(id, '')).map(e => [e.id, new Date().toISOString()]));
  assert.equal(kind(draw(3, 3, seen).drawn[1].id), 'M');
});

test('more slots cycle through the mix; at 1 always a problem, at 2 no language', () => {
  assert.deepEqual(ids(3, 1).map(kind), ['P']);
  assert.deepEqual(ids(3, 2).map(kind), ['P', 'M']);
  assert.deepEqual(ids(3, 5).map(kind), ['P', 'M', 'rL', 'P', 'M']);
});

test('a category a grade lacks passes its slot on, rotating through the mix', () => {
  assert.deepEqual(ids(4, 3).map(kind), ['dM', 'dL', 'dM']);
  assert.deepEqual(ids(4, 4).map(kind), ['dM', 'dL', 'dM', 'dL']);
  // A category that runs out within the day passes its slots on too
  assert.deepEqual(ids(3, 12).map(kind), ['P', 'M', 'rL', 'P', 'M', 'rL', 'P', 'M', 'rL', 'P', 'M', 'P']);
  assert.equal(ids(3, 20).length, 12, 'never the same item twice in a day');
});

test('with no problems the round starts one further each day; with problems the problem stays first', () => {
  // Δ΄ at the default 3: the double slot moves between maths and language
  assert.deepEqual(ids(4, 3, 0).map(kind), ['dM', 'dL', 'dM']);
  assert.deepEqual(ids(4, 3, 1).map(kind), ['dL', 'dM', 'dL']);
  assert.deepEqual(ids(4, 3, 2).map(kind), ['dM', 'dL', 'dM']);
  assert.deepEqual(ids(4, 6, 1).map(kind), ['dL', 'dM', 'dL', 'dM', 'dL', 'dM']);
  for (let turn = 0; turn < 6; turn++) assert.deepEqual(ids(3, 3, turn).map(kind), ['P', 'M', 'rL']);
  // On average the table's slots per day: 1.5 each for Δ΄, 1 each for Γ΄
  assert.deepEqual([...pool.mixSlots([...of(4).own], 3)], [['Μαθηματικά', 1.5], ['Γλώσσα', 1.5]]);
  assert.deepEqual([...pool.mixSlots([...of(3).own, ...of(3).revision], 3)], [['Προβλήματα', 1], ['Μαθηματικά', 1], ['Γλώσσα', 1]]);
});

test('a grade with no pools gets nothing', () => {
  assert.deepEqual(draw(1, 3), { drawn: [], revision: [] });
});

test('with k items in a category and one slot a day, an item comes back after k days', () => {
  const seen = new Map<string, string>();
  const days: string[] = [];
  for (let d = 0; d < 9; d++) {
    const [math] = draw(4, 1, seen).drawn;    // Δ΄ at 1 a day: maths every day, 4 items
    days.push(math.id);
    seen.set(math.id, new Date(Date.UTC(2026, 0, 1 + d)).toISOString());
  }
  assert.equal(new Set(days.slice(0, 4)).size, 4);
  assert.deepEqual(days.slice(4, 8), days.slice(0, 4));
});

test('the daily set is stored in mix order, revision items marked, and the draw logged', async () => {
  const all = await db.getExerciseAssignments();
  const mine = all.filter(a => a.userId === 'g3');
  assert.deepEqual(mine.map(a => kind(a.exerciseId)), ['P', 'M', 'rL']);
  assert.deepEqual(mine.map(a => !!a.revision), [false, false, true]);
  assert.deepEqual(all.filter(a => a.userId === 'g4').map(a => kind(a.exerciseId)), ['dM', 'dL', 'dM']);
  assert.equal(all.filter(a => a.userId === 'g1').length, 0);
  const details = store.recentLogs(50).filter(l => l.type === 'EXERCISE_ASSIGNMENTS_CREATED')
    .map(l => l.details as { userId: string; revision?: string[] }).find(d => d.userId === 'g3');
  assert.deepEqual(details?.revision, [mine[2].exerciseId]);
  // The same flag in the state every screen renders
  const state = await db.appState();
  assert.deepEqual(state.exerciseAssignments.filter(a => a.userId === 'g3').map(a => !!a.revision), [false, false, true]);
});

test('the next day the Δ΄ kid starts one further round the mix, the Γ΄ kid with the problem again', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.now() + 86400_000 });
  try {
    const next = await db.getExerciseAssignments();
    assert.deepEqual(next.filter(a => a.userId === 'g4').map(a => kind(a.exerciseId)), ['dL', 'dM', 'dL']);
    assert.deepEqual(next.filter(a => a.userId === 'g3').map(a => kind(a.exerciseId)), ['P', 'M', 'rL']);
  } finally {
    mock.timers.reset();
  }
});

// ---------------------------------------------------------------------------
// The shipped pools: per grade and mix category, how many items each has and how
// many days pass before one comes back. For the grades the kids are in (KIDS_GRADES)
// a mix category filled from revision, or coming back under NO_REPEAT_DAYS, fails;
// for the other grades it only warns.

const NO_REPEAT_DAYS = 30;
/**
 * The grades the family's kids are in this school year. Move it every September, when they
 * go up a grade (and write that grade's pools first, or npm test fails).
 */
const KIDS_GRADES: SchoolGrade[] = [3, 5];

test('shipped pools: days before a daily item comes back, per grade and category', t => {
  const shipped = pool.loadPools(path.join(__dirname, '..', 'exercise-pools'));
  const perDay = pool.DEFAULT_EXERCISES_PER_DAY;   // slots/day: on average, over the days a kid with no problems goes round
  const extras = db.DEFAULT_EXTRA_PROBLEMS_PER_DAY;
  const rows: string[] = [`daily set: ${perDay} a day, plus up to ${extras} extra problems; under ${NO_REPEAT_DAYS} days fails for grades ${KIDS_GRADES.join(', ')}, warns for the rest`,
    'grade  category     own  rev  slots/day  days to repeat'];
  const warnings: string[] = [], failures: string[] = [];
  for (const grade of [1, 2, 3, 4, 5, 6] as SchoolGrade[]) {
    const { own, revision } = pool.poolsForGrade(shipped, grade);
    if (own.length + revision.length === 0) {
      rows.push(`${grade}      (no pools)`);
      (KIDS_GRADES.includes(grade) ? failures : warnings).push(`grade ${grade}: no pools, no daily exercises`);
      continue;
    }
    const slots = pool.mixSlots([...own, ...revision], perDay);
    const others = pool.mixOrder([...own, ...revision]).filter(c => !(pool.DAILY_MIX as readonly string[]).includes(c));
    for (const category of [...pool.DAILY_MIX, ...others]) {
      const ownN = own.filter(e => e.category === category).length;
      const revN = revision.filter(e => e.category === category).length;
      // Extra problems draw from the same problems, freshest first, so at full use they count as slots
      const perDayHere = (slots.get(category) ?? 0) + (category === 'Προβλήματα' && ownN ? extras : 0);
      const days = perDayHere ? Math.floor((ownN || revN) / perDayHere) : undefined;
      rows.push(`${grade}      ${category.padEnd(11)}  ${String(ownN).padStart(3)}  ${String(revN).padStart(3)}  ${String(+perDayHere.toFixed(2)).padStart(9)}  ${days ?? '-'}`);
      const why = [
        ...(days === undefined ? ['none, its slot passes on'] : []),
        ...(days !== undefined && !ownN ? [`none of its own, ${revN} revision items`] : []),
        ...(days !== undefined && days < NO_REPEAT_DAYS ? [`an item comes back after ${days} days`] : []),
      ];
      if (!why.length) continue;
      const mixed = (pool.DAILY_MIX as readonly string[]).includes(category);
      (KIDS_GRADES.includes(grade) && mixed ? failures : warnings).push(`grade ${grade} ${category}: ${why.join('; ')}`);
    }
  }
  console.log(rows.join('\n'));
  for (const w of warnings) t.diagnostic(`warning: ${w}`);
  // A kid's grade: every category of the mix her own, lasting NO_REPEAT_DAYS
  assert.deepEqual(failures, [], `the kids' grades (KIDS_GRADES ${KIDS_GRADES.join(', ')}) need every mix category of their own, lasting ${NO_REPEAT_DAYS} days`);
  // The problems, written per grade, must be there for both grades with a kid in them
  for (const grade of [3, 5] as SchoolGrade[]) assert.ok(pool.poolsForGrade(shipped, grade).own.some(e => e.type === 'problem'));
});
