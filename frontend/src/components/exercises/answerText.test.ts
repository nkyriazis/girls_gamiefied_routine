// npm test (frontend): the right answer of a plain exercise, in words (#48)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerText } from './answerText.ts';

const base = { id: 'x', category: 'x', title: 'x', stars: 1 };

test('each kind of exercise says its right answer', () => {
  assert.equal(answerText({ ...base, type: 'multiple-choice', question: '56 : 8', options: ['6', '7', '8'], correctIndex: 1 }), '7');
  assert.equal(answerText({ ...base, type: 'true-false', question: 'x', correctValue: false }), 'Λάθος');
  assert.equal(answerText({ ...base, type: 'number-input', question: 'x', correctValue: 1250 }), '1.250');
  assert.equal(answerText({ ...base, type: 'fill-blank', textWithGaps: 'Ο {0} τρώει {1}.', options: [], correctAnswers: ['σκύλος', 'κόκαλο'] }), 'Ο σκύλος τρώει κόκαλο.');
});

// #72: a line never starts with «→» (a no-break space before each arrow), and a match is one pair
// per line with «→» between its sides, never «–», which reads as a minus beside numbers
test('an ordering is one run, and no line starts with its arrow', () => {
  assert.equal(answerText({ ...base, type: 'ordering', items: [{ id: 'a', content: '1' }, { id: 'b', content: '2' }, { id: 'c', content: '3' }] }), '1\u00a0→ 2\u00a0→ 3');
});

test('a match is one pair per line, an arrow between its sides', () => {
  const pairs = [{ left: 'όμορφος', right: 'ωραίος' }, { left: '9 × 4', right: '36' }];
  assert.equal(answerText({ ...base, type: 'match-pairs', pairs }), 'όμορφος\u00a0→ ωραίος\n9 × 4\u00a0→ 36');
  assert.doesNotMatch(answerText({ ...base, type: 'match-pairs', pairs }), /[–,]/);
});
