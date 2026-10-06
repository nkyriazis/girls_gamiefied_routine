import { useState } from 'react';

// Fisher-Yates
export function shuffle<T>(xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

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
