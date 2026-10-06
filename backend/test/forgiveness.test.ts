import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProblemExercise } from '../../shared/types';
import { paysNow, plainStars, plainTries, problemStars, stepCounts, stepHelp } from '../../shared/forgiveness';

// The forgiveness ladder (#48): what an exercise pays after mistakes, and how many tries a step gets.

const tag = { kind: 'tag' as const, phase: 'read' as const, prompt: '' };
const problem: ProblemExercise = {
  id: 'p', type: 'problem', category: 'x', title: 'x', stars: 4, story: '[1|known] [Πόσα|sought]',
  steps: [
    tag,
    { kind: 'choice', phase: 'plan', prompt: '', options: ['a', 'b'], correctIndex: 0 },
    { kind: 'numbers', phase: 'solve', prompt: '', rows: [{ label: 'x', answer: 1 }] },
    { kind: 'calc', phase: 'solve', prompt: '', quantities: [], relations: [], given: [], sought: 'x' },
    { kind: 'order', phase: 'check', prompt: '', items: ['a', 'b'] },
  ],
};

test('a problem pays one star less for each step with a counted wrong try, however many tries', () => {
  assert.equal(problemStars(problem, undefined, 'marked', 'forgiving'), 4);
  assert.equal(problemStars(problem, [0, 0, 0, 0, 0], 'marked', 'forgiving'), 4);
  assert.equal(problemStars(problem, [0, 5, 0, 0, 0], 'marked', 'forgiving'), 3, 'a step costs at most one star');
  assert.equal(problemStars(problem, [1, 1, 0, 0, 0], 'marked', 'forgiving'), 2);
  // Forgiving never goes below 1, unforgiving goes down to 0
  assert.equal(problemStars(problem, [1, 1, 1, 0, 1], 'marked', 'forgiving'), 1);
  assert.equal(problemStars(problem, [1, 1, 1, 0, 1], 'marked', 'unforgiving'), 0);
  assert.equal(problemStars(problem, [1, 1, 1, 0, 0], 'marked', 'unforgiving'), 1);
  assert.equal(problemStars({ ...problem, stars: 1 }, [1, 0, 0, 0, 0], 'marked', 'forgiving'), 1);
});

test('until #50, wrong paintings and calc slips cost nothing (they still get hints)', () => {
  assert.equal(stepCounts(problem.steps[0], 'marked'), true, 'tapping the marked phrases counts');
  assert.equal(stepCounts(problem.steps[0], 'paint'), false, 'the same step painted does not');
  assert.equal(stepCounts(problem.steps[0], 'paint-all'), false);
  assert.equal(stepCounts({ kind: 'paint', phase: 'read', prompt: '', targets: [] }, 'marked'), false);
  assert.equal(stepCounts(problem.steps[3], 'marked'), false, 'calc');
  for (const i of [1, 2, 4]) assert.equal(stepCounts(problem.steps[i], 'paint'), true);
  // Painted, the reading step's tries are free; the calc step's slips are free on any rung
  assert.equal(problemStars(problem, [3, 0, 0, 7, 0], 'paint', 'unforgiving'), 4);
  assert.equal(problemStars(problem, [3, 0, 0, 7, 0], 'marked', 'unforgiving'), 3);
});

test('a plain exercise loses its star at the first wrong try, on both rungs', () => {
  assert.equal(plainStars(1, 0), 1);
  assert.equal(plainStars(1, 1), 0);
  assert.equal(plainStars(1, 4), 0);
  assert.equal(plainStars(2, 1), 1);
  // Unforgiving closes it after its tries: one for true/false, two for the rest; forgiving never does
  assert.equal(plainTries('unforgiving', 'true-false'), 1);
  assert.equal(plainTries('unforgiving', 'multiple-choice'), 2);
  assert.equal(plainTries('unforgiving', 'number-input'), 2);
  assert.equal(plainTries('forgiving', 'true-false'), Infinity);
});

test('what a step shows after wrong tries, on each rung', () => {
  const at = (rung: 'forgiving' | 'unforgiving', counts: boolean) => [0, 1, 2, 3, 4].map(n => stepHelp(rung, counts, n));
  // Forgiving: the hint after the 1st, the wrong parts outlined from the 2nd, «Δείξε μου» from the 3rd
  assert.deepEqual(at('forgiving', true).map(h => [h.hint, h.outline, h.canShow, h.worked]), [
    [false, false, false, false], [true, false, false, false], [true, true, false, false], [true, true, true, false], [true, true, true, false],
  ]);
  // Unforgiving: the hint after the 1st, no outlines, then the step worked after the 2nd
  assert.deepEqual(at('unforgiving', true).map(h => [h.hint, h.outline, h.canShow, h.worked]), [
    [false, false, false, false], [true, false, false, false], [true, true, false, true], [true, true, false, true], [true, true, false, true],
  ]);
  // A step whose tries don't count plays the forgiving way on both rungs
  assert.deepEqual(at('unforgiving', false), at('forgiving', true));
});

test('what an exercise pays now: what it paid once done, else what it pays if the rest goes right', () => {
  const plain = { id: 'n', type: 'number-input' as const, category: 'x', title: 'x', question: '1 + 1', correctValue: 2, stars: 1 };
  assert.equal(paysNow({ status: 'pending', attempts: 0 }, plain), 1);
  assert.equal(paysNow({ status: 'pending', attempts: 1 }, plain), 0);
  assert.equal(paysNow({ status: 'completed', attempts: 1, starsAwarded: 1 }, plain), 1);
  assert.equal(paysNow({ status: 'completed', attempts: 3, starsAwarded: 0 }, plain), 0);
  assert.equal(paysNow({ status: 'pending', attempts: 2, mistakes: [1, 1, 0, 0, 0] }, problem), 2);
  assert.equal(paysNow({ status: 'pending', attempts: 2, mistakes: [1, 1, 0, 0, 0] }, problem, { problemReading: 'paint' }), 3);
  assert.equal(paysNow({ status: 'pending', attempts: 9, mistakes: [1, 1, 1, 0, 1] }, problem, { forgiveness: 'unforgiving' }), 0);
});
