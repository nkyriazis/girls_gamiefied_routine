// Where a fill-blank's taps go, as plain data (fillBlank.test.ts). No tap checks the sentence: only
// «Έλεγχος Πρότασης» sends it, once it is full (#50 part 6).

/** The words in the gaps (null: empty) and the active gap: where the next word goes, or which word it replaces */
export interface Blanks { gaps: (string | null)[]; active: number }

export const emptyBlanks = (n: number): Blanks => ({ gaps: new Array(n).fill(null), active: 0 });

export const isFull = (b: Blanks) => b.gaps.every(g => g !== null);

/**
 * A word tapped in the bank. It fills the active gap, or the next empty one after it (then the first);
 * the active gap moves to the next empty one. On a full sentence it replaces the active gap's word (the
 * last filled, or the one she emptied and filled again), and that word goes back to the bank. A word
 * already in a gap stays where it is.
 */
export function place(b: Blanks, word: string): Blanks {
  if (b.gaps.includes(word)) return b;
  const gaps = [...b.gaps];
  if (isFull(b)) {
    gaps[b.active] = word;
    return { gaps, active: b.active };
  }
  let target = gaps.findIndex((g, i) => i >= b.active && g === null);
  if (target === -1) target = gaps.findIndex(g => g === null);
  gaps[target] = word;
  const after = gaps.findIndex((g, i) => i > target && g === null);
  const next = after !== -1 ? after : gaps.findIndex(g => g === null);
  return { gaps, active: next !== -1 ? next : target };
}

/** A gap tapped: a filled one is emptied (its word goes back to the bank); either way it becomes the active one */
export function tapGap(b: Blanks, i: number): Blanks {
  if (b.gaps[i] === null) return { ...b, active: i };
  const gaps = [...b.gaps];
  gaps[i] = null;
  return { gaps, active: i };
}
