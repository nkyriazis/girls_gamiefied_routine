import { useState } from 'react';

// A random number generator from a string (FNV-1a, then mulberry32): the same seed, the same numbers
function seeded(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates. With a seed, always the same order for that seed.
export function shuffle<T>(xs: readonly T[], seed?: string): T[] {
  const random = seed === undefined ? Math.random : seeded(seed);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
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

/**
 * The positions 0..n-1 in an order fixed by `seed` (an assignment and its step, or an
 * exercise): the options of a choice stay where they are after a wrong try, a reload, or
 * on a second device, and the right one isn't always first (#48).
 */
export const useSeededOrder = (n: number, seed: string): number[] =>
  useShuffled(Array.from({ length: n }, (_, i) => i), `${seed}#${n}`, xs => shuffle(xs, seed));

/** The letter of the option in this place on screen: Α, Β, Γ, Δ… */
export const optionLetter = (place: number) => String.fromCharCode(0x391 + place);
