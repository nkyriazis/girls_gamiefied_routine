// npm test (frontend): the owl shows the widget it points at, inside a list that scrolls (#67)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revealBy } from './reveal.ts';

const box = { top: 100, bottom: 500 };

test('a widget in view: the list stays', () => {
  assert.equal(revealBy({ top: 200, bottom: 260 }, box), 0);
});

test('below the edge: the list scrolls down just enough, with room around it', () => {
  assert.equal(revealBy({ top: 480, bottom: 540 }, box), 52);
});

test('above the edge: the list scrolls up', () => {
  assert.equal(revealBy({ top: 60, bottom: 120 }, box), -52);
});

test('taller than the list: its top shows', () => {
  assert.equal(revealBy({ top: 300, bottom: 900 }, box), 188);
});
