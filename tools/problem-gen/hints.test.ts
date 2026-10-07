// Nothing on a step shows an answer still to work out (#50 part 5d), run with Node 24 alone:
//   node --test tools/problem-gen/hints.test.ts
// The audit fails it over every pool and gen.ts drops such a draft; these are the pieces on their own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProblemStep } from '../../shared/types.ts';
import { builder, hintShows, rng, rowsHint } from './lib.ts';

const NUM = /(?<![\d.])(?:\d{1,3}(?:\.\d{3})+|\d+)(?![\d.]*\d)/g;
const numbers = (s: string) => (s.match(NUM) ?? []).map(x => Number(x.replace(/\./g, '')));
/** The answers a hint shows: any after «=», and from 10 up anywhere */
const told = (hint: string, answers: number[]) => [
  ...[...hint.matchAll(/=\s*(\d{1,3}(?:\.\d{3})+|\d+)/g)].map(m => Number(m[1].replace(/\./g, ''))).filter(n => answers.includes(n)),
  ...numbers(hint).filter(n => n >= 10 && answers.includes(n)),
];

test('rowsHint never states a row\'s answer, not even as a part of the calculation', () => {
  for (const rows of [
    [{ label: '23 − 13 =', answer: 10 }],                    // the split «23 − 10 = 13» names 10
    [{ label: '66 − 29 =', answer: 37 }],
    [{ label: 'Πόσα το καθένα', answer: 500, eq: '2.502 : 5' }], // a trial below the quotient, not 5 × 500
    [{ label: '14 + 32 + 32 =', answer: 78 }],               // a chain
    [{ label: '345 + 27 =', answer: 372 }, { label: 'Πριν', answer: 399, eq: '372 + 27' }],
  ]) {
    const hint = rowsHint(rows);
    assert.ok(hint, `a hint for ${rows.map(r => r.label).join(' | ')}`);
    assert.deepEqual(told(hint, rows.map(r => r.answer)), [], `«${hint}» for ${rows.map(r => `${r.label} [${r.answer}]`).join(' | ')}`);
  }
  // 23 − 13 is counted up instead of split
  assert.equal(rowsHint([{ label: '23 − 13 =', answer: 10 }]), 'Μετράμε από το 13 ως το 23: πρώτα ως το 20, και μετά ως το 23.');
});

test('b.numbers lists a step it can write no fair hint for, and never throws (gen.ts drops the draft)', () => {
  const b = builder(rng(1), '');
  // Every wording names a row's answer: «Στο 20 βάζουμε 2 δεκάδες» (20 is the half), «… στο 40;» (40 the sum)
  const step = b.numbers('solve', 'Λύνουμε.', [{ label: '20 + 20 =', answer: 40 }, { label: 'Τα μισά', answer: 20, eq: '40 : 2' }]);
  assert.equal(step.hint, '');
  assert.equal(b.hintless.length, 1);
});

const numbersStep = (rows: [string, number][], hint = 'Λύνουμε.'): ProblemStep =>
  ({ kind: 'numbers', phase: 'solve', prompt: 'Λύνουμε.', hint, rows: rows.map(([label, answer]) => ({ label, answer })) });
const choice = (options: string[], correctIndex: number, hint: string): ProblemStep =>
  ({ kind: 'choice', phase: 'plan', prompt: 'Τι κάνουμε;', options, correctIndex, hint });

test('hintShows: a hint that works its own step out (A and B of the evidence)', () => {
  const A = {
    story: 'Ένα φυτώριο έχει [785 δέντρα|known]. [Τα 340 είναι ελιές|known] …',
    steps: [numbersStep([['Λεμονιές και πορτοκαλιές μαζί', 445], ['Ομάδες των 5', 89], ['Πορτοκαλιές', 89], ['Λεμονιές', 356]],
      '785 − 340 = 445. Κάθε ομάδα έχει 5: 445 : 5 = 89.')],
  };
  assert.deepEqual(hintShows(A).map(s => [s.where, s.number, s.answerOf]), [['hint', 445, 0], ['hint', 89, 0]]);
  const B = { story: 'Έχει [66 ευρώ|known] και ξοδεύει [29 ευρώ|known].', steps: [numbersStep([['66 − 29 =', 37]], 'Αφαιρούμε πρώτα 20 και μετά 9: 66 − 20 = 46, 46 − 9 = 37.')] };
  assert.deepEqual(hintShows(B).map(s => s.number), [37]);
  // The same with the rewritten hint: nothing
  B.steps = [numbersStep([['66 − 29 =', 37]], 'Αφαιρούμε πρώτα το 20: 66 − 20 = 46. Από το 46 βγάζουμε και το 9.')];
  assert.deepEqual(hintShows(B), []);
});

test('hintShows: a hint that answers a later step, and a label that names the row above (C of the evidence)', () => {
  const C = {
    story: 'Η Ζωή είναι [12 χρονών|known]. Ο παππούς της είναι [78 χρονών|known].',
    steps: [
      choice(['104, μεγαλώνουν και οι δύο', '97, περνούν 7 χρόνια'], 0, 'Σε 7 χρόνια: 12 + 7 = 19 και 78 + 7 = 85.'),
      numbersStep([['Η Ζωή σε 7 χρόνια', 19], ['Ο παππούς της σε 7 χρόνια', 85], ['19 + 85 =', 104]]),
    ],
  };
  assert.deepEqual(hintShows(C).map(s => [s.step, s.where, s.number, s.answerOf]),
    [[0, 'hint', 19, 1], [0, 'hint', 85, 1], [1, 'row 2', 19, 1], [1, 'row 2', 85, 1]]);
});

test('hintShows: what she has settled is no longer an answer to work out', () => {
  // The right option of an earlier choice («Κάνω 2.556 : 20») settles 2.556 for the steps after it
  const ex = {
    story: 'Τη Δευτέρα [1.157 αυγά|known] και την Τρίτη [1.399|known].',
    steps: [
      choice(['Κάνω 2.556 : 20', 'Κάνω 2.556 × 20'], 0, 'Σε κάθε κούτα μπαίνουν 20.'),
      numbersStep([['Αυγά και τις δύο ημέρες', 2556], ['Γεμάτες κούτες (2.556 : 20, το πηλίκο)', 127]]),
    ],
  };
  assert.deepEqual(hintShows(ex), []);
  // An earlier step's row settles its answer too, and the story its numbers
  const later = { story: 'Είχε [36 ευρώ|known] και πήρε [19 ακόμα|known].', steps: [numbersStep([['36 + 19 =', 55]]), numbersStep([['55 − 36 =', 19]], 'Από το 55 βγάζουμε το 36.')] };
  assert.deepEqual(hintShows(later), []);
});

test('hintShows: small numbers count after «=», and in a label when a row above asks for them', () => {
  // «12 : 4 = 3, άρα 3 κουτιά των 4»: 3 after «=»
  assert.deepEqual(hintShows({ story: 'Θέλει [12 αυγά|known] σε [κουτιά των 4|known].', steps: [numbersStep([['Κουτιά', 3]], '12 : 4 = 3, άρα 3 κουτιά των 4.')] }).map(s => s.number), [3]);
  // «3 × 7 =» under «Πόσα παιδιά είναι [3]»
  assert.deepEqual(hintShows({ story: 'Το εισιτήριο κοστίζει [7 €|known].', steps: [numbersStep([['Πόσα παιδιά είναι', 3], ['Τα παιδιά: 3 × 7 =', 21]])] }).map(s => [s.where, s.number]), [['row 1', 3]]);
  // A digit of the story's number beside a remainder of 1 is no answer; nor a small number in words
  assert.deepEqual(hintShows({ story: 'Έχει [2.167 λουλούδια|known].', steps: [numbersStep([['Άθροισμα ψηφίων: 2 + 1 + 6 + 7 =', 16], ['Περισσεύουν', 1]], 'Μένει 1 ή 2;')] }), []);
});
