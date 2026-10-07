// npm test (frontend): where a fill-blank's taps go (#50 part 6). A full sentence waits for «Έλεγχος
// Πρότασης»: no tap on a word or a gap checks it, and a word tapped on a full sentence replaces the
// word in the active gap, so a mis-tap is one more tap to fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyBlanks, isFull, place, tapGap, type Blanks } from './fillBlank.ts';

const play = (b: Blanks, ...taps: (string | number)[]) =>
  taps.reduce((s, t) => (typeof t === 'number' ? tapGap(s, t) : place(s, t)), b);

test('one gap: the word fills it, and the full sentence is not checked by the tap', () => {
  const b = place(emptyBlanks(1), 'κρύβετε');
  assert.deepEqual(b, { gaps: ['κρύβετε'], active: 0 });
  assert.ok(isFull(b), 'ready for «Έλεγχος»: only the button sends it');
});

test('a word on a full sentence replaces the active gap\'s word: the mis-tap is fixed in one tap', () => {
  assert.deepEqual(play(emptyBlanks(1), 'κρύβετε', 'κρύβεται'), { gaps: ['κρύβεται'], active: 0 });
  // Two gaps: the active one is the last filled
  assert.deepEqual(play(emptyBlanks(2), 'παίζουν', 'χέροντε', 'χαίρονται'), { gaps: ['παίζουν', 'χαίρονται'], active: 1 });
});

test('words fill the gaps in order, from the active one', () => {
  const one = place(emptyBlanks(2), 'παίζουν');
  assert.deepEqual(one, { gaps: ['παίζουν', null], active: 1 });
  assert.ok(!isFull(one));
  // She taps the second gap first: the word goes there, and the next one to the first
  assert.deepEqual(play(emptyBlanks(2), 1, 'χαίρονται'), { gaps: [null, 'χαίρονται'], active: 0 });
  assert.deepEqual(play(emptyBlanks(2), 1, 'χαίρονται', 'παίζουν'), { gaps: ['παίζουν', 'χαίρονται'], active: 0 });
});

test('a tap on a filled gap empties it and makes it the active one; the sentence is no longer full', () => {
  const full = play(emptyBlanks(2), 'παίζουν', 'χαίρονται');
  const opened = tapGap(full, 0);
  assert.deepEqual(opened, { gaps: [null, 'χαίρονται'], active: 0 });
  assert.ok(!isFull(opened));
  // The next word goes back there, and the one after replaces it (the last filled)
  assert.deepEqual(play(opened, 'παίζει'), { gaps: ['παίζει', 'χαίρονται'], active: 0 });
  assert.deepEqual(play(opened, 'παίζει', 'παίζουν'), { gaps: ['παίζουν', 'χαίρονται'], active: 0 });
});

test('a word already in a gap stays where it is', () => {
  const b = play(emptyBlanks(2), 'παίζουν');
  assert.equal(place(b, 'παίζουν'), b);
  const full = play(b, 'χαίρονται');
  assert.equal(place(full, 'παίζουν'), full);
});
