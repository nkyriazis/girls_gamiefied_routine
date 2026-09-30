// Building blocks for problem families: a seeded random source, Greek names and
// counted nouns in the cases a story needs, and builders for each kind of step.
//
// A family writes a story with numbers it picked, and computes every answer from
// those numbers, so the answers are right by construction. audit.ts checks the
// output independently (equations, marks, ranges, duplicates, variety).

import type {
  ProblemChoiceStep, ProblemNumbersStep, ProblemOrderStep, ProblemPhase, ProblemStep, ProblemTagStep
} from '../../shared/types.ts';

// ---------------------------------------------------------------------------
// Randomness (mulberry32): the same seed gives the same pool, so a rerun only
// changes what the families changed.

export interface Rng {
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
  /** Integer in [min, max] that is a multiple of `step`. */
  step(min: number, max: number, step: number): number;
  pick<T>(xs: readonly T[]): T;
  /** `n` different items. */
  sample<T>(xs: readonly T[], n: number): T[];
  shuffle<T>(xs: readonly T[]): T[];
  chance(p: number): boolean;
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r: Rng = {
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    step: (min, max, s) => s * r.int(Math.ceil(min / s), Math.floor(max / s)),
    pick: xs => xs[Math.floor(next() * xs.length)],
    shuffle: xs => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: (xs, n) => r.shuffle(xs).slice(0, n),
    chance: p => next() < p,
  };
  return r;
}

/** A hash of a string, to seed each family differently. */
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Numbers as the books write them: 1.229, 12.453.089

export const fmt = (n: number) => n.toLocaleString('el-GR');

// ---------------------------------------------------------------------------
// Marks for the tag step: what we know, what we seek, what the story says but isn't needed.

export const known = (text: string) => `[${text}|known]`;
export const sought = (text: string) => `[${text}|sought]`;
export const extra = (text: string) => `[${text}|extra]`;

// ---------------------------------------------------------------------------
// People. Each form carries its article: Nom "Ο Νίκος", nom "ο Νίκος", gen "του Νίκου",
// acc "τον Νίκο"; bare is the name alone (for "ο Νίκος και η Δανάη" built by hand).

export interface Person {
  bare: string;
  female: boolean;
  Nom: string;
  nom: string;
  gen: string;
  acc: string;
  /** "του" / "της": his or her, after a noun ("τα χρήματά της"). */
  his: string;
  /** "αυτός" / "αυτή" */
  he: string;
}

// "την" before a vowel and before κ, π, τ, ξ, ψ (and γκ, μπ, ντ); "τη" otherwise.
const keepsN = (word: string) => /^[αάεέηήιίοόυύωώκπτξψ]|^(γκ|μπ|ντ)/i.test(word.normalize('NFC'));

function person(bare: string, gen: string, acc: string, female: boolean): Person {
  const art = female ? { nom: 'η', gen: 'της', acc: keepsN(acc) ? 'την' : 'τη' } : { nom: 'ο', gen: 'του', acc: 'τον' };
  return {
    bare, female,
    Nom: `${art.nom[0].toUpperCase()}${art.nom.slice(1)} ${bare}`,
    nom: `${art.nom} ${bare}`,
    gen: `${art.gen} ${gen}`,
    acc: `${art.acc} ${acc}`,
    his: female ? 'της' : 'του',
    he: female ? 'αυτή' : 'αυτός',
  };
}

export const GIRLS: Person[] = [
  person('Δανάη', 'Δανάης', 'Δανάη', true),
  person('Χαρά', 'Χαράς', 'Χαρά', true),
  person('Υπατία', 'Υπατίας', 'Υπατία', true),
  person('Κορίνα', 'Κορίνας', 'Κορίνα', true),
  person('Ελένη', 'Ελένης', 'Ελένη', true),
  person('Σοφία', 'Σοφίας', 'Σοφία', true),
  person('Άννα', 'Άννας', 'Άννα', true),
  person('Ζωή', 'Ζωής', 'Ζωή', true),
  person('Μυρτώ', 'Μυρτώς', 'Μυρτώ', true),
  person('Αγγελική', 'Αγγελικής', 'Αγγελική', true),
  person('Μαρίνα', 'Μαρίνας', 'Μαρίνα', true),
  person('Κατερίνα', 'Κατερίνας', 'Κατερίνα', true),
];

export const BOYS: Person[] = [
  person('Νίκος', 'Νίκου', 'Νίκο', false),
  person('Γιώργος', 'Γιώργου', 'Γιώργο', false),
  person('Φώτης', 'Φώτη', 'Φώτη', false),
  person('Μάρκος', 'Μάρκου', 'Μάρκο', false),
  person('Αντρέι', 'Αντρέι', 'Αντρέι', false),
  person('Πέτρος', 'Πέτρου', 'Πέτρο', false),
  person('Αλέξης', 'Αλέξη', 'Αλέξη', false),
  person('Στέλιος', 'Στέλιου', 'Στέλιο', false),
  person('Θοδωρής', 'Θοδωρή', 'Θοδωρή', false),
  person('Άρης', 'Άρη', 'Άρη', false),
  person('Μιχάλης', 'Μιχάλη', 'Μιχάλη', false),
  person('Πυθαγόρας', 'Πυθαγόρα', 'Πυθαγόρα', false),
];

export const PEOPLE = [...GIRLS, ...BOYS];

/** `n` different people. */
export const people = (r: Rng, n: number) => r.sample(PEOPLE, n);

// ---------------------------------------------------------------------------
// Counted things. Use them with numbers of 2 or more (the plural); `one` is for 1.
// Masculine nouns differ in the accusative plural (βόλοι / βόλους).

export type Gender = 'm' | 'f' | 'n';

export interface Thing {
  one: string;
  many: string;
  manyAcc: string;
  g: Gender;
}

export const thing = (one: string, many: string, g: Gender, manyAcc = many): Thing => ({ one, many, manyAcc, g });

/** "5 μπαλόνια", "1 μπαλόνι" (nominative), accusative with acc = true. */
export const count = (n: number, t: Thing, acc = false) => `${fmt(n)} ${n === 1 ? t.one : acc ? t.manyAcc : t.many}`;

/** "πόσα" / "πόσες" / "πόσοι" / "πόσους", for the thing's gender and case. */
export function howMany(t: Thing, acc = true): string {
  return t.g === 'n' ? 'πόσα' : t.g === 'f' ? 'πόσες' : acc ? 'πόσους' : 'πόσοι';
}

/** With a capital: "Πόσα", "Πόσες", ... */
export const HowMany = (t: Thing, acc = true) => cap(howMany(t, acc));

/** "τα" / "τις" / "τους" / "οι": the plural article. */
export function the(t: Thing, acc = true): string {
  return t.g === 'n' ? 'τα' : t.g === 'f' ? (acc ? 'τις' : 'οι') : acc ? 'τους' : 'οι';
}

export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Steps. Choices are shuffled here, so a family lists the right answer first.

export interface Builder {
  tag(prompt?: string, hint?: string): ProblemTagStep;
  choice(phase: ProblemPhase, prompt: string, right: string, wrong: string[], hint?: string, story?: string): ProblemChoiceStep;
  numbers(phase: ProblemPhase, prompt: string, rows: { label: string; answer: number; unit?: string }[], hint?: string): ProblemNumbersStep;
  order(phase: ProblemPhase, prompt: string, items: string[], hint?: string): ProblemOrderStep;
}

export const READ_PROMPT_G3 = 'Τι ξέρουμε και τι ψάχνουμε;';
export const READ_PROMPT_E5 = 'Τι προσπαθούμε να βρούμε; Τι γνωρίζουμε;';

export function builder(r: Rng, readPrompt: string): Builder {
  return {
    tag: (prompt = readPrompt, hint) => ({ kind: 'tag', phase: 'read', prompt, ...(hint ? { hint } : {}) }),
    choice: (phase, prompt, right, wrong, hint, story) => {
      const options = r.shuffle([right, ...wrong]);
      return {
        kind: 'choice', phase, prompt, options, correctIndex: options.indexOf(right),
        ...(hint ? { hint } : {}), ...(story ? { story } : {}),
      };
    },
    numbers: (phase, prompt, rows, hint) => ({
      kind: 'numbers', phase, prompt,
      rows: rows.map(row => ({ label: row.label, answer: row.answer, ...(row.unit ? { unit: row.unit } : {}) })),
      ...(hint ? { hint } : {}),
    }),
    order: (phase, prompt, items, hint) => ({ kind: 'order', phase, prompt, items, ...(hint ? { hint } : {}) }),
  };
}

// ---------------------------------------------------------------------------
// Families

export interface Draft {
  title: string;
  story: string;
  steps: ProblemStep[];
}

export interface Family {
  /** Short, unique, kebab-case: part of every problem id. */
  id: string;
  grade: 3 | 5;
  /** The textbook unit whose skills it needs (the pool can later be limited to units done). */
  unit: number;
  /** Where in the textbooks this kind of problem comes from. */
  source: string;
  /** One problem, or null to skip these numbers (the generator then tries again). */
  make(r: Rng, b: Builder): Draft | null;
}

/** Wrong options near the right number: different from it and from each other, all positive. */
export function near(r: Rng, right: number, n: number, spread = Math.max(2, Math.round(right * 0.2))): number[] {
  const out = new Set<number>();
  for (let guard = 0; out.size < n && guard < 200; guard++) {
    const d = r.int(1, spread) * (r.chance(0.5) ? 1 : -1);
    const v = right + d;
    if (v > 0 && v !== right) out.add(v);
  }
  return [...out];
}
