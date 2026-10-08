import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { DataConfig, Exercise, MatchPairsExercise } from '../../shared/types';
import { shuffle } from '../../shared/shuffle';
import { answerPairs, emptyMatching, isComplete, pairOf, rightOrder, straightAcross, tapLeft, tapRight, type Matching } from '../../shared/matchPairs';
import { tempDir } from './helpers';

// A match-pairs on the kids' screen (#86): where her taps go, what the screen sends, and the order of
// its right column. The module is shared/matchPairs.ts, used by MatchPairsRenderer; it lives in shared/
// so this test can hold it against the server's own check (checkExerciseAnswer) and the shipped pools.

const dir = tempDir();
const icon = { type: 'emoji' as const, value: 'x' };
const cfg: DataConfig = {
  users: [{ id: 'u1', name: 'A', avatar: icon, color: 'red', grade: 3 }],
  tasks: [], routines: [], routineTasks: [], routineAssignments: [], flows: [], schedules: [], rewards: [],
  settings: { timezone: 'Europe/Athens' }
};
writeFileSync(path.join(dir, 'data.json'), JSON.stringify(cfg));
process.env.DATA_FILE = path.join(dir, 'data.json');
process.env.EXERCISES_FILE = path.join(dir, 'exercises.json');
process.env.DB_FILE = path.join(dir, 'routine.db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../src/db') as typeof import('../src/db');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pool = require('../src/exercisePool') as typeof import('../src/exercisePool');

// Every match-pairs that ships: the pools, and the group game's exercises.json
const shipped = (): MatchPairsExercise[] => {
  const pools = pool.loadPools(path.join(__dirname, '..', 'exercise-pools')).flatMap(p => p.exercises as Exercise[]);
  const game = (JSON.parse(readFileSync(path.join(__dirname, '..', 'exercises.json'), 'utf-8')) as { exercises: Exercise[] }).exercises;
  return [...pools, ...game].filter((e): e is MatchPairsExercise => e.type === 'match-pairs');
};

// Προπαίδεια του 7 (g3-math-tables-match-b-002): left 0..2, right by the pair's index
const seven: MatchPairsExercise = {
  id: 'seven', type: 'match-pairs', category: 'Μαθηματικά', title: 'Προπαίδεια του 7', stars: 1,
  pairs: [{ left: '7 × 5', right: '35' }, { left: '7 × 9', right: '63' }, { left: '7 × 7', right: '49' }],
};

type Tap = ['L' | 'R', number];
const play = (m: Matching, ...taps: Tap[]) => taps.reduce((s, [side, i]) => (side === 'L' ? tapLeft(s, i) : tapRight(s, i)), m);

test('matching the last pair completes it and nothing more: only «Έλεγχος Ζευγαριών» sends it', () => {
  const m = play(emptyMatching(), ['L', 0], ['R', 0], ['L', 1], ['R', 1], ['L', 2], ['R', 2]);
  assert.deepEqual(m, { pairs: [{ left: 0, right: 0 }, { left: 1, right: 1 }, { left: 2, right: 2 }], selected: null });
  assert.ok(isComplete(m, 3));
  assert.ok(!isComplete(play(emptyMatching(), ['L', 0], ['R', 0], ['L', 1], ['R', 1]), 3));
});

test('a tap on a matched left un-matches it and selects it: the mis-tap is fixed in two taps', () => {
  const wrong = play(emptyMatching(), ['L', 0], ['R', 2]);          // «7 × 5» → «49»
  const undone = tapLeft(wrong, 0);
  assert.deepEqual(undone, { pairs: [], selected: 0 });
  assert.deepEqual(tapRight(undone, 0), { pairs: [{ left: 0, right: 0 }], selected: null }); // → «35»
});

test('a tap on a matched right un-matches its pair when no left is selected', () => {
  const m = play(emptyMatching(), ['L', 0], ['R', 2], ['L', 1], ['R', 1]);
  assert.deepEqual(tapRight(m, 2), { pairs: [{ left: 1, right: 1 }], selected: null });
});

test('with a left selected, a tap on a matched right moves it there and frees its old left', () => {
  const m = play(emptyMatching(), ['L', 0], ['R', 2], ['L', 2]);
  assert.deepEqual(tapRight(m, 2), { pairs: [{ left: 2, right: 2 }], selected: null });
  assert.equal(pairOf(tapRight(m, 2), 'left', 0), undefined);
});

test('selecting: a tap on the selected left lets it go, a tap on another left selects that one', () => {
  assert.deepEqual(play(emptyMatching(), ['L', 1], ['L', 1]), { pairs: [], selected: null });
  assert.deepEqual(play(emptyMatching(), ['L', 1], ['L', 2]), { pairs: [], selected: 2 });
});

test('a free right with no left selected does nothing', () => {
  const m = play(emptyMatching(), ['L', 0], ['R', 0]);
  assert.equal(tapRight(m, 1), m);
});

test('pairOf names the other side of a pair, for the marker both items share', () => {
  const m = play(emptyMatching(), ['L', 0], ['R', 2]);
  assert.deepEqual(pairOf(m, 'left', 0), { left: 0, right: 2 });
  assert.deepEqual(pairOf(m, 'right', 2), { left: 0, right: 2 });
  assert.equal(pairOf(m, 'right', 0), undefined);
});

test('every shipped match-pairs: the screen\'s answer is what the server takes, and a wrong one is refused', () => {
  const all = shipped();
  assert.ok(all.length >= 15, `${all.length} match-pairs shipped`);
  for (const ex of all) {
    const n = ex.pairs.length;
    // She matches each left to its own right, the left items in a scrambled order
    const right = [...ex.pairs.keys()].reverse().reduce((m, i) => play(m, ['L', i], ['R', i]), emptyMatching());
    assert.ok(isComplete(right, n), ex.id);
    assert.equal(db.checkExerciseAnswer(ex, answerPairs(right, ex)), true, `${ex.id}: the right pairs`);
    // Each left to the next one's right
    const wrong = ex.pairs.reduce((m, _, i) => play(m, ['L', i], ['R', (i + 1) % n]), emptyMatching());
    const sameText = ex.pairs.every((p, i) => p.right === ex.pairs[(i + 1) % n].right);
    assert.equal(db.checkExerciseAnswer(ex, answerPairs(wrong, ex)), sameText, `${ex.id}: the pairs shifted by one`);
  }
});

test('two equal right texts (math-tp-1: two «10») are two items: either goes with either sum', () => {
  const ex = shipped().find(e => e.id === 'math-tp-1');
  assert.ok(ex, 'math-tp-1 in exercises.json');
  // «5 + 5» with the second «10», «8 + 2» with the first
  const m = play(emptyMatching(), ['L', 0], ['R', 2], ['L', 1], ['R', 1], ['L', 2], ['R', 0]);
  assert.deepEqual(answerPairs(m, ex), [{ left: '5 + 5', right: '10' }, { left: '3 + 4', right: '7' }, { left: '8 + 2', right: '10' }]);
  assert.equal(db.checkExerciseAnswer(ex, answerPairs(m, ex)), true);
});

test('the right column never shows half or more of the pairs straight across, on every shipped match-pairs', () => {
  for (const ex of shipped()) {
    const order = rightOrder(ex);
    assert.deepEqual([...order].sort((a, b) => a - b), [...ex.pairs.keys()], `${ex.id}: every right item once`);
    assert.deepEqual(rightOrder(ex), order, `${ex.id}: the same order every time (a wrong try, a reload, a second device)`);
    const across = straightAcross(ex, order);
    assert.ok(across < ex.pairs.length / 2, `${ex.id}: ${across} of ${ex.pairs.length} straight across (${order.map(i => ex.pairs[i].right).join(' | ')})`);
  }
});

test('the rule holds for any id, and an order the plain shuffle leaves straight across is redrawn', () => {
  let redrawn = 0;
  for (let n = 2; n <= 6; n++) {
    for (let k = 0; k < 400; k++) {
      const ex = { id: `x-${n}-${k}`, pairs: Array.from({ length: n }, (_, i) => ({ left: `L${i}`, right: `R${i}` })) };
      const order = rightOrder(ex);
      assert.ok(straightAcross(ex, order) < n / 2, `${ex.id}: ${order}`);
      const plain = shuffle([...ex.pairs.keys()], ex.id);
      if (straightAcross(ex, plain) >= n / 2) redrawn++;
      else assert.deepEqual(order, plain, `${ex.id}: a fine order is kept as drawn`);
    }
  }
  assert.ok(redrawn > 100, `${redrawn} orders redrawn`);
});

test('straight across counts by text: an equal right text in the left item\'s row reads as its own', () => {
  const ex = { pairs: [{ left: '5 + 5', right: '10' }, { left: '3 + 4', right: '7' }, { left: '8 + 2', right: '10' }] };
  assert.equal(straightAcross(ex, [2, 1, 0]), 3);
  assert.equal(straightAcross(ex, [1, 0, 2]), 1);
});
