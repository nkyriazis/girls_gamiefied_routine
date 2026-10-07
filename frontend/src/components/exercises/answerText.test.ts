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
  assert.equal(answerText({ ...base, type: 'ordering', items: [{ id: 'a', content: '1' }, { id: 'b', content: '2' }] }), '1 → 2');
  assert.equal(answerText({ ...base, type: 'match-pairs', pairs: [{ left: 'α', right: 'β' }] }), 'α – β');
});
