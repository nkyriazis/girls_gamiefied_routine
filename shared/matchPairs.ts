// A match-pairs on the kids' screen, as plain data (#86): where her taps go, what the screen sends, and
// the order of its right column. MatchPairsRenderer holds a Matching; no tap checks it, only «Έλεγχος
// Ζευγαριών» sends it, once every item is matched. backend/test/matchPairs.test.ts holds it against the
// server's checkExerciseAnswer and every shipped match-pairs.
import type { MatchPairsExercise } from './types';
import { shuffle } from './shuffle';

/** One pair she made, by index: `left` a row of the left column, `right` the pair whose right text she chose */
export interface Pair { left: number; right: number }

/** The pairs she has made, and the left item waiting for its right one. Indexes keep equal texts (two «10») apart. */
export interface Matching { pairs: Pair[]; selected: number | null }

export const emptyMatching = (): Matching => ({ pairs: [], selected: null });

export const isComplete = (m: Matching, n: number) => m.pairs.length === n;

/** The pair an item is in, if any */
export const pairOf = (m: Matching, side: 'left' | 'right', i: number): Pair | undefined =>
  m.pairs.find(p => p[side] === i);

/**
 * A left item tapped. A matched one is un-matched and selected, so the next right one pairs it again (a
 * mis-tap is fixed in two taps). A free one is selected, or let go when it was the selected one.
 */
export function tapLeft(m: Matching, i: number): Matching {
  if (pairOf(m, 'left', i)) return { pairs: m.pairs.filter(p => p.left !== i), selected: i };
  return { pairs: m.pairs, selected: m.selected === i ? null : i };
}

/**
 * A right item tapped. With a left selected it pairs with it, even when it was matched: it moves there and
 * its old left goes free. With none selected, a matched one is un-matched and a free one does nothing.
 */
export function tapRight(m: Matching, j: number): Matching {
  if (m.selected === null) {
    return pairOf(m, 'right', j) ? { pairs: m.pairs.filter(p => p.right !== j), selected: null } : m;
  }
  const left = m.selected;
  return { pairs: [...m.pairs.filter(p => p.right !== j && p.left !== left), { left, right: j }], selected: null };
}

/** What the screen sends: the texts of her pairs, in the left column's order (checkExerciseAnswer reads texts) */
export const answerPairs = (m: Matching, ex: Pick<MatchPairsExercise, 'pairs'>) =>
  [...m.pairs].sort((a, b) => a.left - b.left).map(p => ({ left: ex.pairs[p.left].left, right: ex.pairs[p.right].right }));

/** How many rows show the left item's own right text next to it (by text: two «10» read the same) */
export const straightAcross = (ex: Pick<MatchPairsExercise, 'pairs'>, order: readonly number[]) =>
  order.filter((j, row) => ex.pairs[j].right === ex.pairs[row].right).length;

/**
 * The right column's order (pair indexes, top to bottom), fixed by the exercise: the same on every try,
 * reload and device. Never half or more of the pairs straight across, which would read as the answer: such
 * a draw is drawn again from `<id>#1`, `<id>#2`…, and after 20 the right column turns down by one row.
 */
export function rightOrder(ex: Pick<MatchPairsExercise, 'id' | 'pairs'>): number[] {
  const n = ex.pairs.length;
  const fine = (order: number[]) => straightAcross(ex, order) < n / 2;
  for (let k = 0; k <= 20; k++) {
    const order = shuffle([...ex.pairs.keys()], k === 0 ? ex.id : `${ex.id}#${k}`);
    if (fine(order)) return order;
  }
  return [...ex.pairs.keys()].map(i => (i + n - 1) % n);
}
