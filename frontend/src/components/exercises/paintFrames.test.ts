// npm test (frontend): the frames on the story after a wrong painting, and the line that points at them (#50)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameLine, paintMarks } from './paintFrames.ts';
import type { PaintTarget } from '@shared/problems';
import type { PaintValue } from './problemFreeLogic.ts';

// «Η Άννα είχε 40 ευρώ. Ξόδεψε 15 ευρώ. Ο αδερφός της, που πάει σχολείο, είναι 9 χρονών. Πόσα ευρώ της έμειναν;»
const targets: PaintTarget[] = [
  { role: 'known', words: [3], span: [3, 4] },
  { role: 'known', words: [6], span: [6, 7] },
  { role: 'extra', words: [15], span: [15, 16] },
  { role: 'sought', words: [17, 18], span: [17, 20] },
];
const painting = (known: number[], sought: number[] = [17, 18, 19, 20], extra: number[] = []): PaintValue =>
  Array.from({ length: 21 }, (_, i) => (known.includes(i) ? 'known' : sought.includes(i) ? 'sought' : extra.includes(i) ? 'extra' : null));
const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

test('«Έβαψες πολλά»: the words counted as too much are framed in red, and the line says red', () => {
  const strays = [8, 9, 10, 11];
  const m = paintMarks(targets, [-1], painting([3, 4, 6, 7, 8, 9, 10, 11]), strays);
  assert.deepEqual(sorted(m.wrongWords), strays);
  assert.deepEqual(sorted(m.revealWords), []);
  assert.equal(frameLine(m), ' Κοίτα τις λέξεις με το κόκκινο πλαίσιο.');
});

test('a missed fact: a dashed (yellow) frame, and the line says yellow', () => {
  const m = paintMarks(targets, [1], painting([3, 4]), []);
  assert.deepEqual(sorted(m.revealWords), [6]);
  assert.equal(frameLine(m), ' Κοίτα τις λέξεις με το κίτρινο πλαίσιο.');
});

test('an unneeded fact painted as needed is red, one left unpainted (paint-all) dashed; both: any frame', () => {
  const asNeeded = paintMarks(targets, [2], painting([3, 4, 6, 7, 15, 16]), []);
  assert.deepEqual([sorted(asNeeded.wrongWords), sorted(asNeeded.revealWords)], [[15], []]);
  const left = paintMarks(targets, [2], painting([3, 4, 6, 7]), []);
  assert.deepEqual([sorted(left.wrongWords), sorted(left.revealWords)], [[], [15]]);
  const both = paintMarks(targets, [1, 2, -1], painting([3, 4, 15, 16, 8, 9, 10, 11]), [8, 9, 10, 11]);
  assert.deepEqual([sorted(both.wrongWords), sorted(both.revealWords)], [[8, 9, 10, 11, 15], [6]]);
  assert.equal(frameLine(both), ' Κοίτα τις λέξεις με πλαίσιο.');
});

test('nothing framed, nothing pointed at', () => {
  const m = paintMarks(targets, undefined, painting([3, 4]), [8]);
  assert.equal(m.wrongWords.size + m.revealWords.size, 0);
  assert.equal(frameLine(m), '');
  assert.equal(frameLine(paintMarks(targets, [-1], painting([3, 4]), [])), '', '-1 with no strays given frames nothing');
});
