import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProblemExercise } from '../../shared/types';
import { paysNow, plainStars, plainTries, problemStars, stepHelp, wrongTryCounts } from '../../shared/forgiveness';

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
  assert.equal(problemStars(problem, undefined, 'forgiving'), 4);
  assert.equal(problemStars(problem, [0, 0, 0, 0, 0], 'forgiving'), 4);
  assert.equal(problemStars(problem, [0, 5, 0, 0, 0], 'forgiving'), 3, 'a step costs at most one star');
  assert.equal(problemStars(problem, [1, 1, 0, 0, 0], 'forgiving'), 2);
  // Forgiving never goes below 1, unforgiving goes down to 0
  assert.equal(problemStars(problem, [1, 1, 1, 0, 1], 'forgiving'), 1);
  assert.equal(problemStars(problem, [1, 1, 1, 0, 1], 'unforgiving'), 0);
  assert.equal(problemStars(problem, [1, 1, 1, 0, 0], 'unforgiving'), 1);
  assert.equal(problemStars({ ...problem, stars: 1 }, [1, 0, 0, 0, 0], 'forgiving'), 1);
});

test('every step\'s wrong try counts, paint and calc too; a calc slip only when the arithmetic is wrong (#50)', () => {
  const paint = { kind: 'paint' as const, phase: 'read' as const, prompt: '', targets: [] };
  for (const step of [...problem.steps, paint]) assert.equal(wrongTryCounts(step), true, step.kind);
  // On a calc step: a wrong sum and the smaller number first count; a right sum that means nothing
  // here brings hints only (some right ways, a net change, read as nothing)
  assert.equal(wrongTryCounts(problem.steps[3], 'math'), true);
  assert.equal(wrongTryCounts(problem.steps[3], 'order'), true);
  assert.equal(wrongTryCounts(problem.steps[3], 'nothing'), false);
  // The reading step and the calc step cost a star each, like any step
  assert.equal(problemStars(problem, [3, 0, 0, 7, 0], 'unforgiving'), 2);
  assert.equal(problemStars(problem, [1, 0, 0, 1, 0], 'forgiving'), 2);
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
  const at = (rung: 'forgiving' | 'unforgiving', kind: 'choice' | 'paint' | 'calc' = 'choice') =>
    [0, 1, 2, 3, 4].map(n => stepHelp(rung, kind, n)).map(h => [h.hint, h.outline, h.canShow, h.worked]);
  // Forgiving: the hint after the 1st, the wrong parts outlined from the 2nd, «Δείξε μου» from the 3rd
  assert.deepEqual(at('forgiving'), [
    [false, false, false, false], [true, false, false, false], [true, true, false, false], [true, true, true, false], [true, true, true, false],
  ]);
  assert.deepEqual(at('forgiving', 'paint'), at('forgiving'));
  // Unforgiving: the hint after the 1st, no outlines, then the step worked after the 2nd
  assert.deepEqual(at('unforgiving'), [
    [false, false, false, false], [true, false, false, false], [true, true, false, true], [true, true, false, true], [true, true, false, true],
  ]);
  // …but a painting's frames show from the 1st, so she sees what was wrong before her last try
  assert.deepEqual(at('unforgiving', 'paint'), [
    [false, false, false, false], [true, true, false, false], [true, true, false, true], [true, true, false, true], [true, true, false, true],
  ]);
  // A calc step: every slip brings help, only the counted ones end it on unforgiving
  assert.deepEqual(stepHelp('unforgiving', 'calc', 4, 1).worked, false, 'four slips, one of them in the arithmetic');
  assert.deepEqual(stepHelp('unforgiving', 'calc', 2, 2).worked, true);
  assert.deepEqual(stepHelp('forgiving', 'calc', 3, 0).canShow, true, '«Δείξε μου» after three slips of any kind');
});

test('what an exercise pays now: what it paid once done, else what it pays if the rest goes right', () => {
  const plain = { id: 'n', type: 'number-input' as const, category: 'x', title: 'x', question: '1 + 1', correctValue: 2, stars: 1 };
  assert.equal(paysNow({ status: 'pending', attempts: 0 }, plain), 1);
  assert.equal(paysNow({ status: 'pending', attempts: 1 }, plain), 0);
  assert.equal(paysNow({ status: 'completed', attempts: 1, starsAwarded: 1 }, plain), 1);
  assert.equal(paysNow({ status: 'completed', attempts: 3, starsAwarded: 0 }, plain), 0);
  assert.equal(paysNow({ status: 'pending', attempts: 2, mistakes: [1, 1, 0, 0, 0] }, problem), 2);
  assert.equal(paysNow({ status: 'pending', attempts: 4, mistakes: [1, 0, 0, 3, 0] }, problem), 2, 'the reading step and the calc step, like any step');
  assert.equal(paysNow({ status: 'pending', attempts: 9, mistakes: [1, 1, 1, 0, 1] }, problem, { forgiveness: 'unforgiving' }), 0);
});
