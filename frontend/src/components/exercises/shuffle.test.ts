// npm test (frontend): options shuffled the same way for the same seed (#48)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle } from '../../../../shared/shuffle.ts';

const four = [0, 1, 2, 3];

test('a seed gives the same order every time: a remount, a reload, a second device', () => {
  assert.deepEqual(shuffle(four, 'a1b2:1'), shuffle(four, 'a1b2:1'));
  assert.deepEqual([...shuffle(four, 'a1b2:1')].sort(), four, 'the same options');
  // Another step, another assignment: another order (most of the time)
  const orders = new Set(Array.from({ length: 50 }, (_, i) => shuffle(four, `a1b2:${i}`).join()));
  assert.ok(orders.size > 10, `${orders.size} orders`);
});

test('across seeds the right answer lands anywhere, about evenly', () => {
  const at = [0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) at[shuffle(four, `assignment-${i}:2`).indexOf(0)]++;
  for (const n of at) assert.ok(n > 850 && n < 1150, `positions ${at}`);
});
