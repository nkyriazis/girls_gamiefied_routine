// A seeded shuffle, the same on the kids' screen and in the server's tests: the screen draws an
// exercise's order with it, and backend/test checks that order on every shipped exercise (#86).

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
