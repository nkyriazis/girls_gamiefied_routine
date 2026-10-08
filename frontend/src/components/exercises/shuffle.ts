import { useState } from 'react';
import { shuffle } from '@shared/shuffle';

// The seeded shuffle itself is shared/shuffle.ts (the server's tests draw the same orders)
export { shuffle };

/**
 * `items` in a random order, drawn once per `key` (the exercise's id). Every STATE brings
 * the same exercise again as a new array: drawing again on it would move the words she is
 * looking at while she answers.
 */
export function useShuffled<T>(items: readonly T[], key: string, draw: (xs: readonly T[]) => T[] = shuffle): T[] {
  const [drawn, setDrawn] = useState(() => ({ key, order: draw(items) }));
  if (drawn.key === key) return drawn.order;
  // Another exercise in the same place (the group game's next one): draw for it
  const next = { key, order: draw(items) };
  setDrawn(next);
  return next.order;
}

/**
 * The positions 0..n-1 in an order fixed by `seed` (an assignment and its step, or an
 * exercise): the options of a choice stay where they are after a wrong try, a reload, or
 * on a second device, and the right one isn't always first (#48).
 */
export const useSeededOrder = (n: number, seed: string): number[] =>
  useShuffled(Array.from({ length: n }, (_, i) => i), `${seed}#${n}`, xs => shuffle(xs, seed));

/** The letter of the option in this place on screen: Α, Β, Γ, Δ… */
export const optionLetter = (place: number) => String.fromCharCode(0x391 + place);
