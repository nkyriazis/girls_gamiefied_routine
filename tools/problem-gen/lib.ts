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
// Options that don't give the answer away. The screen shuffles them, so their length is the
// only tell left, and it has two sides.
//
// In one choice (lengthTell): at both ends no option stands out by length, the longest at most
// 30 % longer than the next, in code points, or at most 5 longer («Δεν τους χρειαζόμαστε» beside
// «Τους προσθέτουμε» doesn't show), and the shortest at most 30 % or 5 shorter than the next.
// Options that are all numbers («12», «1.229 €») are compared by their digits instead: the right
// one is never the only one with the most digits. builder.choice flags a choice that breaks this,
// gen.ts drops the draft, and audit.ts fails it in every pool.
//
// Across a prompt's choices (#50 part 5c, the place rule): a fixed wording puts the right option
// at the same place by length in every problem, so a child who taps «the middle one» or «the
// longest» without reading wins. A rule per choice can't fix that (never the only longest nor the
// only shortest makes the right one the middle one, every time). So the place is a rule per
// prompt. An option may list several wordings of itself (`Wording`: a wrong one, the same typical
// mistake said shorter or longer; a right one, only the book's own shorter wording), never longer
// than the longest first wording. builder.choice works out which places by length the valid
// wordings can give the right option, mixes them so that every place is as near to 1/n as they
// allow (evenest), and the problem's seed (placeSeed: from its id, so a dropped draft changes only
// its own problem) picks one. The audit counts the places (places(): options within 2 code points
// of each other look the same length, ties split) per family, prompt (promptKey) and number of
// options, and fails a prompt from 6 choices on where one place wins more than a fair die would
// (placeLimit), a warning from 3. `gen.ts --places` lists the prompts whose wordings can't spread
// it evenly. The curated pools, whose prompts are asked too rarely for that, keep the rule per
// choice that the right one is never the only longest, and the old per-prompt rule for the only
// shortest (onlyShortest).

export const STAND_OUT = 1.3;
const STAND_OUT_MIN = 6;
const NUMERIC_OPTION = /^\d{1,3}(?:\.\d{3})*(?:\s+[^\d\s]+){0,2}$/;
const codePoints = (s: string) => [...s].length;

/**
 * What gives the right option away by its length in one choice, or null. With `onlyLongest` (the
 * curated pools) also the right one being the only longest.
 */
export function lengthTell(options: string[], correctIndex: number, { onlyLongest = false } = {}): string | null {
  const opts = options.map(o => o.trim());
  if (opts.every(o => NUMERIC_OPTION.test(o))) {
    const d = opts.map(o => o.replace(/\D/g, '').length);
    return d.every((x, j) => j === correctIndex || x < d[correctIndex])
      ? `the right number «${opts[correctIndex]}» is the only one with ${d[correctIndex]} digits` : null;
  }
  const L = opts.map(codePoints);
  const others = L.filter((_, j) => j !== correctIndex);
  if (onlyLongest && others.every(x => x < L[correctIndex])) return `the right option «${opts[correctIndex]}» is the only longest (${L[correctIndex]} code points, the next ${Math.max(...others)})`;
  const [first, second] = [...L].sort((a, b) => b - a);
  if (first > STAND_OUT * second && first - second >= STAND_OUT_MIN) return `«${opts[L.indexOf(first)]}» stands out by its length (${first} code points, the next ${second})`;
  const [low, low2] = [...L].sort((a, b) => a - b);
  if (low2 > STAND_OUT * low && low2 - low >= STAND_OUT_MIN) return `«${opts[L.indexOf(low)]}» stands out by its shortness (${low} code points, the next ${low2})`;
  return null;
}

/** Whether the right option is the only shortest (code points): the curated pools' per-prompt rule. */
export function onlyShortest(options: string[], correctIndex: number): boolean {
  const L = options.map(o => codePoints(o.trim()));
  return L.every((x, j) => j === correctIndex || x > L[correctIndex]);
}

/** The most a curated prompt may have its right option as the only shortest: half its choices. */
export const SHORTEST_SHARE = 0.5;
/** A curated prompt counts from this many choices on. */
export const SHORTEST_MIN_CHOICES = 3;

/** Options within this many code points of each other count as the same length (the measure chosen for #50 part 5c; on screen 2 can still show). */
export const PLACE_TOLERANCE = 2;

/**
 * Where the right option sits by length, as the eye sees it: P[k] is the chance that it is the k-th
 * shortest (k = 0 … n − 1) when the options within PLACE_TOLERANCE code points of it count as tied
 * with it and ties are broken at random. Tapping «the k-th by length» wins P[k] of the choice.
 */
export function places(options: string[], correctIndex: number): number[] {
  const L = options.map(o => codePoints(o.trim())), x = L[correctIndex];
  const below = L.filter((y, j) => j !== correctIndex && y < x - PLACE_TOLERANCE).length;
  const same = L.filter((y, j) => j !== correctIndex && Math.abs(y - x) <= PLACE_TOLERANCE).length + 1;
  return L.map((_, k) => (k >= below && k < below + same ? 1 / same : 0));
}

/**
 * The most choices of N that one place may win, with n options: a fair die (each place 1/n) goes over
 * it in less than 1 prompt in 100 (the binomial tail). From PLACE_MIN_CHOICES choices a prompt over it
 * fails the audit; from PLACE_WARN_CHOICES it is a warning.
 */
export function placeLimit(N: number, n: number): number {
  const p = 1 / n;
  const pmf: number[] = [];
  for (let k = 0, c = 1; k <= N; c = (c * (N - k)) / (k + 1), k++) pmf.push(c * p ** k * (1 - p) ** (N - k));
  let above = 0, c = N;
  while (c > 0 && above + pmf[c] <= 0.01) above += pmf[c--];
  return c;
}
export const PLACE_MIN_CHOICES = 6;
export const PLACE_WARN_CHOICES = 3;

// A prompt asked of many stories, with its names and numbers blanked out
/** Every form of every name (Νίκος, Νίκου, Νίκο), longest first. */
export const NAMES = new RegExp(`(${[...new Set(PEOPLE.flatMap(p => [p.bare, p.gen.split(' ')[1], p.acc.split(' ')[1]]))]
  .sort((a, b) => b.length - a.length).join('|')})`, 'g');
const NUMBERS = /\d{1,3}(?:\.\d{3})+|\d+/g;
/** Prompts that ask the same thing with the same options, by the key of the first. */
const SAME_PROMPT: Record<string, string> = {
  'Πώς οργανώνουμε τη λύση;': 'Ποιο εργαλείο μας βοηθά;', // growth-chain's plan
  'Κάτι λείπει από την ιστορία. Τι χρειαζόμαστε ακόμη;': 'Μπορούμε να απαντήσουμε; Τι μας λείπει;', // Γ΄ missing-info
  'Τι γράφουμε στη θέση μιας συσκευασίας που δεν υπάρχει;': 'Τι γράφουμε στις θέσεις που δεν αναφέρονται;', // place-value
};

/** The key of a prompt for the place rule: names (with their article) as @, numbers as #, synonyms (SAME_PROMPT) as one. */
export function promptKey(prompt: string): string {
  const k = prompt.replace(NAMES, '@').replace(/(?<!\p{L})(?:[ΟοΗη]|τ(?:ου|ης|ον|ην|η)) @/gu, '@').replace(NUMBERS, '#');
  return SAME_PROMPT[k] ?? k;
}

const GOLDEN = (Math.sqrt(5) - 1) / 2;
/**
 * Where a problem falls, in [0, 1), among the problems of its family that ask a prompt, from its id
 * alone: a start for the family's prompt (a hash of the id's family part and the prompt key) plus the
 * problem's number times the golden ratio. The problems of a family so walk through [0, 1) evenly
 * (cut into n places, a prompt every problem asks gets every place about as often, within two), and
 * a dropped draft changes only its own problem. builder.choice turns it into the wordings to take.
 */
export function placeSeed(id: string, key: string): number {
  const m = id.match(/^(.*)-(\d+)$/);
  const [base, k] = m ? [m[1], Number(m[2])] : [id, 0];
  return (hash(`${base}|${key}`) / 2 ** 32 + k * GOLDEN) % 1;
}

/**
 * One option, or the same option in several wordings of different lengths, the first the usual
 * one. A wrong option's variant is the same typical mistake in other words; a right option's comes
 * from the book's own wordings. builder.choice never takes a variant longer than the longest of the
 * first wordings (nothing new wraps).
 */
export type Wording = string | readonly string[];

// Wordings that recur across families. The Ε΄ book's strategies by their names in κεφ. 1.3
// («Παρουσιάζω το πρόβλημα», «Εργάζομαι αντίστροφα», «Αναζητώ ένα μοτίβο», «Λύνω ένα πιο απλό
// πρόβλημα»), first with what they mean here; and the «not wrong» options of a check that asks what
// someone did wrong or forgot.
export const STRATEGY = {
  draw: ['Παρουσιάζω το πρόβλημα με σχέδιο', 'Παρουσιάζω το πρόβλημα'],
  backwards: ['Εργάζομαι αντίστροφα: από το τέλος', 'Εργάζομαι αντίστροφα'],
  pattern: ['Αναζητώ ένα μοτίβο στους αριθμούς', 'Αναζητώ ένα μοτίβο'],
  simpler: ['Λύνω πρώτα ένα πιο απλό πρόβλημα', 'Λύνω ένα πιο απλό πρόβλημα'],
} as const;
/** «What did they do wrong?» — nothing. */
export const NO_MISTAKE: readonly string[] = ['Κανένα λάθος, είναι σωστό', 'Κανένα λάθος', 'Δεν έκανε λάθος', 'Κανένα λάθος, όλα είναι σωστά', 'Δεν έκανε λάθος, είναι όλα σωστά', 'Δεν έκανε κανένα λάθος, είναι σωστό'];
/** «What did they forget?» — nothing. */
export const NOTHING_FORGOTTEN: readonly string[] = ['Τίποτα, η απάντηση στέκει', 'Τίποτα, στέκει', 'Δεν ξέχασε τίποτα', 'Τίποτα, η απάντηση είναι σωστή', 'Δεν ξέχασε τίποτα, η απάντηση στέκει'];

/** At most this many combinations of wordings per choice. */
const MAX_COMBINATIONS = 256;

/**
 * The weights over place vectors (each one choice's P, from places()) whose mix is closest to every
 * place 1/n (the least sum of squares; Frank–Wolfe with exact line search).
 */
function evenest(V: number[][]): number[] {
  const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k], 0);
  let w: number[] = V.map((_, i) => (i === 0 ? 1 : 0));
  let x = [...V[0]];
  for (let t = 0; t < 1000; t++) {
    const i = V.reduce((best, v, j) => (dot(x, v) < dot(x, V[best]) ? j : best), 0);
    const d = V[i].map((v, k) => v - x[k]);
    const dd = dot(d, d);
    if (dd < 1e-12) break;
    const g = Math.min(1, Math.max(0, -dot(x, d) / dd));
    if (g < 1e-9) break;
    w = w.map((y, j) => (1 - g) * y + (j === i ? g : 0));
    x = x.map((y, k) => y + g * d[k]);
  }
  return w;
}

/**
 * The wordings for a choice: `sets[i]` are option i's wordings (0 is the right one), `slot` the
 * shuffled order (slot[j] is the option on screen at j). Valid: no repeats, no lengthTell, no variant
 * longer than the longest first wording. Without a seed, the first valid one. With a seed in [0, 1)
 * (placeSeed): the valid ones give the right option a few places by length (places()); the builder
 * mixes them so that, over the problems of a prompt, every place is as near to 1/n as these wordings
 * allow (evenest), and the seed picks one from that mix; among those that give the same places, the
 * smallest spread of lengths, then the first wordings. `busiest`: the busiest place of that mix (1/n
 * when the wordings can spread it evenly). Null when none is valid.
 */
function chooseWordings(sets: string[][], slot: number[], seed: number | undefined): { options: string[]; busiest: number } | null {
  const total = sets.reduce((n, s) => n * s.length, 1);
  if (total > MAX_COMBINATIONS) throw new Error(`${total} combinations of wordings (at most ${MAX_COMBINATIONS}): ${JSON.stringify(sets)}`);
  const cap = Math.max(...sets.map(s => codePoints(s[0].trim())));
  const correct = slot.indexOf(0);
  const valid: { options: string[]; P: number[]; spread: number }[] = [];
  for (let c = 0; c < total; c++) {
    let rest = c;
    // The last option's wordings vary fastest; combination 0 is every option's first wording
    const pick = new Array<string>(sets.length);
    for (let i = sets.length - 1; i >= 0; i--) { pick[i] = sets[i][rest % sets[i].length]; rest = Math.floor(rest / sets[i].length); }
    const options = slot.map(i => pick[i]);
    const L = options.map(o => codePoints(o.trim()));
    if (new Set(options).size !== options.length || Math.max(...L) > cap || lengthTell(options, correct)) continue;
    valid.push({ options, P: places(options, correct), spread: Math.max(...L) - Math.min(...L) });
  }
  if (!valid.length) return null;
  if (seed === undefined || valid.length === 1) return { options: valid[0].options, busiest: Math.max(...valid[0].P) };
  // The different place vectors, in the order first met, and the mix that spreads them most evenly
  const key = (P: number[]) => P.map(p => p.toFixed(6)).join(',');
  const vectors = [...new Map(valid.map(v => [key(v.P), v.P])).values()];
  const w = evenest(vectors);
  const mix = vectors[0].map((_, k) => vectors.reduce((s, v, i) => s + w[i] * v[k], 0));
  let at = vectors.length - 1;
  for (let i = 0, acc = 0; i < vectors.length; i++) if (seed < (acc += w[i])) { at = i; break; }
  const want = key(vectors[at]);
  const chosen = valid.filter(v => key(v.P) === want).reduce((a, v) => (v.spread < a.spread ? v : a));
  return { options: chosen.options, busiest: Math.max(...mix) };
}

// ---------------------------------------------------------------------------
// Hints that fit their numbers: how to start a calculation, without its result. b.numbers
// writes one from its rows when the family gives none (a row's equation is its label's
// «76 − 35 =», or `eq` for a row that only names its quantity).

const NUMBER = String.raw`\d{1,3}(?:\.\d{3})+|\d+`;
const EXPRESSION = new RegExp(String.raw`\(?(?:${NUMBER})\)?(?:\s+[+−×:]\s+\(?(?:${NUMBER})\)?)+`);
const toNumber = (s: string) => Number(s.replace(/\./g, ''));
/** The numbers of a text, as written (1.229 is one) */
const numbersOf = (s: string) => [...s.matchAll(new RegExp(String.raw`(?<![\d.])(?:${NUMBER})(?![\d.]*\d)`, 'g'))].map(x => toNumber(x[0]));
/** 368 → [300, 68]; 2.900 → [2.000, 900] */
const topSplit = (n: number): [number, number] => {
  const p = 10 ** (String(n).length - 1);
  return [Math.floor(n / p) * p, n % p];
};
const PLACES = ['μονάδες', 'δεκάδες', 'εκατοντάδες', 'χιλιάδες'];
const PLACE = ['μονάδα', 'δεκάδα', 'εκατοντάδα', 'χιλιάδα'];
/** 300 → «3 εκατοντάδες», 1.000 → «1 χιλιάδα»; null unless one digit and zeros (and below 10.000) */
const roundPart = (n: number): string | null => {
  const [hi, rest] = topSplit(n);
  const place = String(n).length - 1;
  if (rest || n < 10 || place > 3) return null;
  const d = hi / 10 ** place;
  return `${d} ${d === 1 ? PLACE[place] : PLACES[place]}`;
};
const trailingZeros = (n: number) => { let z = 0; while (n && n % 10 === 0) { n /= 10; z++; } return z; };
const zeros = (z: number) => (z === 1 ? 'το μηδενικό' : `τα ${z} μηδενικά`);

function addHint(a: number, b: number): string {
  const [big, small] = a >= b ? [a, b] : [b, a];
  if (big > 9_999) {
    const s = (a % 10) + (b % 10);
    return `Ξεκινάμε από τις μονάδες: ${a % 10} + ${b % 10} = ${s}${s >= 10 ? `, γράφουμε ${s % 10} και κρατάμε 1` : ''}.`;
  }
  if (big < 10) {
    return big + small > 10 ? `${big} + ${10 - big} = 10, και μετά ${small - (10 - big)} ακόμα.` : `Ξεκινάμε από το ${big} και μετράμε ${small} ακόμα.`;
  }
  if (small < 10) {
    const u = big % 10;
    if (!u) return `Στο ${fmt(big)} βάζουμε ${small} ${small === 1 ? 'μονάδα' : 'μονάδες'}.`;
    return u + small > 10 ? `${fmt(big)} + ${10 - u} = ${fmt(big + 10 - u)}, και μετά ${small - (10 - u)} ακόμα.`
      : `Προσθέτουμε τις μονάδες: ${u} + ${small}.`;
  }
  // A round number: «Στο 250 βάζουμε 1 εκατοντάδα»; else split the second: 27 + 36 is 27 + 30 and 6 more
  for (const [x, y] of [[a, b], [b, a]]) if (roundPart(y)) return `Στο ${fmt(x)} βάζουμε ${roundPart(y)}.`;
  for (const [x, y] of [[a, b], [b, a]]) {
    const [hi, rest] = topSplit(y);
    if (rest) return `${fmt(x)} + ${fmt(hi)} = ${fmt(x + hi)}, και μετά ${fmt(rest)} ακόμα.`;
  }
  const [pa, pb] = [String(big).length - 1, String(small).length - 1];
  return pa === pb ? `Προσθέτουμε μόνο τις ${PLACES[pa] ?? 'μεγάλες θέσεις'}: ${big / 10 ** pa} + ${small / 10 ** pb}.`
    : `Γράφουμε το ${fmt(small)} στη θέση των ${PLACES[pb]} του ${fmt(big)}.`;
}

function subHint(a: number, b: number): string {
  if (a > 9_999) {
    const [au, bu] = [a % 10, b % 10];
    return au >= bu ? `Ξεκινάμε από τις μονάδες: ${au} − ${bu} = ${au - bu}.`
      : `Ξεκινάμε από τις μονάδες: ${au} − ${bu} δεν γίνεται, άρα δανειζόμαστε μια δεκάδα: ${au + 10} − ${bu} = ${au + 10 - bu}.`;
  }
  if (b < 10 && a >= 10) {
    const au = a % 10;
    return au >= b ? `Από τις μονάδες: ${au} − ${b}.` : `${fmt(a)} − ${au} = ${fmt(a - au)}, και μετά βγάζουμε ${b - au} ακόμα.`;
  }
  if (roundPart(b)) return `Από το ${fmt(a)} βγάζουμε ${roundPart(b)}.`;
  const [hi, rest] = topSplit(b);
  if (b >= 10 && rest && hi) return `${fmt(a)} − ${fmt(hi)} = ${fmt(a - hi)}, και μετά βγάζουμε ${fmt(rest)} ακόμα.`;
  return countUp(a, b);
}

/** 23 − 13 counted up: «Μετράμε από το 13 ως το 23: πρώτα ως το 20, και μετά ως το 23.» (to the next round number on the way) */
function countUp(a: number, b: number): string {
  const next = [1000, 100, 10].map(p => Math.ceil((b + 1) / p) * p).find(n => n < a);
  if (b >= 10 && next !== undefined) return `Μετράμε από το ${fmt(b)} ως το ${fmt(a)}: πρώτα ως το ${fmt(next)}, και μετά ως το ${fmt(a)}.`;
  return `Πόσα λείπουν από το ${fmt(b)} για να φτάσουμε στο ${fmt(a)};`;
}

function mulHint(a: number, b: number): string {
  const [k, m] = a <= b ? [a, b] : [b, a];
  const first = (x: number, y: number) => (a <= b ? `${fmt(x)} × ${fmt(y)}` : `${fmt(y)} × ${fmt(x)}`);
  if (m <= 10) {
    if (k === 1) return `Μία φορά το ${m}.`;
    if (k <= 3) return `${fmt(a)} × ${fmt(b)} είναι ${Array(k).fill(m).join(' + ')}.`;
    return `Μετράμε ανά ${m}: ${m}, ${2 * m}, ${3 * m}, …`;
  }
  if (k <= 10) {
    const [hi, rest] = topSplit(m);
    if (rest) return `${first(k, hi)} = ${fmt(k * hi)}, και μετά ${first(k, rest)}.`;
    // Not the product: «5 × 3 = 15, και μετά βάζουμε το μηδενικό» is 5 × 30 = 150 with its zero left off
    const z = trailingZeros(m);
    return `Πόσο κάνει ${first(k, m / 10 ** z)}; Μετά βάζουμε ${zeros(z)}.`;
  }
  const [za, zb] = [trailingZeros(a), trailingZeros(b)];
  if (za + zb) return `Πόσο κάνει ${fmt(a / 10 ** za)} × ${fmt(b / 10 ** zb)}; Μετά βάζουμε ${zeros(za + zb)}.`;
  const [hi, rest] = topSplit(k);
  return `${first(hi, m)} = ${fmt(hi * m)}, και μετά ${first(rest, m)}.`;
}

function divHint(a: number, b: number): string {
  const ask = `Πόσες φορές χωράει το ${fmt(b)} στο ${fmt(a)};`;
  if (a <= 100 && b <= 10) return `${ask} Σκεφτόμαστε την προπαίδεια του ${b}.`;
  const q = Math.floor(a / b);
  // A trial below the quotient, never the quotient itself (2.502 : 5 tries 5 × 400, not 5 × 500)
  const top = q >= 10 ? topSplit(q)[0] : q === 5 ? 4 : 5;
  const t = top !== q ? top : top - 10 ** (String(q).length - 1) || q / 2;
  return `${ask} Δοκιμάζουμε ${fmt(b)} × ${fmt(t)} = ${fmt(b * t)}.`;
}

/**
 * How to start working out `expr` («27 + 36», «2.900 × 40», «(146 : 2) − 35», «14 + 32 + 32»), fitted
 * to its numbers, without its result: a sub-calculation at most. Null when it isn't arithmetic.
 */
export function workHint(expr: string): string | null {
  const m = expr.match(EXPRESSION);
  if (!m) return null;
  const tokens = m[0].replace(/[()]/g, '').trim().split(/\s+/);
  const nums = tokens.filter((_, i) => i % 2 === 0).map(toNumber);
  const ops = tokens.filter((_, i) => i % 2 === 1);
  if (nums.some(n => !Number.isFinite(n))) return null;
  if (ops.length === 1) {
    const [a, b] = nums;
    return ops[0] === '+' ? addHint(a, b) : ops[0] === '−' ? subHint(a, b) : ops[0] === '×' ? mulHint(a, b) : divHint(a, b);
  }
  // Several: the first operation the order of operations asks for (inside a parenthesis, or a × or :), then the rest
  const paren = m[0].match(/\(([^)]+)\)/);
  const firstIdx = paren ? -1 : ops.findIndex(o => o === '×' || o === ':');
  if (paren) return `Πρώτα κάνουμε την πράξη μέσα στην παρένθεση: ${paren[1].trim()}.`;
  if (firstIdx >= 0 && ops.some(o => o === '+' || o === '−')) {
    return `Πρώτα ${fmt(nums[firstIdx])} ${ops[firstIdx]} ${fmt(nums[firstIdx + 1])}, και μετά ${ops.filter((_, i) => i !== firstIdx).map((o, i) => `${o} ${fmt(nums.filter((_, j) => j !== firstIdx && j !== firstIdx + 1)[i])}`).join(' ')}.`;
  }
  return chainHints(nums, ops)[0];
}

/** For a chain «14 + 32 + 32»: the first step worked out, or (when that partial is a row's answer) only named. */
function chainHints(nums: number[], ops: string[]): string[] {
  const value = (o: string, x: number, y: number) => (o === '+' ? x + y : o === '−' ? x - y : o === '×' ? x * y : x / y);
  const v = value(ops[0], nums[0], nums[1]);
  const rest = nums.slice(2);
  const then = ops[1] === '+' ? 'βάζουμε' : ops[1] === '−' ? 'βγάζουμε' : ops[1] === '×' ? 'πολλαπλασιάζουμε με' : 'διαιρούμε με';
  const list = rest.length === 1 ? `και το ${fmt(rest[0])}` : `και τα ${rest.slice(0, -1).map(fmt).join(', ')} και ${fmt(rest[rest.length - 1])}`;
  return [
    `Πρώτα ${fmt(nums[0])} ${ops[0]} ${fmt(nums[1])} = ${fmt(v)}, και μετά ${then} ${list}.`,
    `Με τη σειρά: πρώτα ${fmt(nums[0])} ${ops[0]} ${fmt(nums[1])}, και μετά ${then} ${list}.`,
  ];
}

/**
 * Every hint workHint could give for `expr`, the preferred first (rowsHint takes the first that keeps the
 * answers back): a part worked out may be a row's answer, so each «x − 20 = 46, και μετά …» also comes
 * with the part only named («Πρώτα x − 20, και μετά …»), and a subtraction counted up.
 */
function workHints(expr: string): string[] {
  const h = workHint(expr);
  if (!h) return [];
  const m = expr.match(EXPRESSION)!;
  const tokens = m[0].replace(/[()]/g, '').trim().split(/\s+/);
  const nums = tokens.filter((_, i) => i % 2 === 0).map(toNumber);
  const ops = tokens.filter((_, i) => i % 2 === 1);
  if (ops.length > 1 && !/\(/.test(m[0]) && !(ops.some(o => o === '×' || o === ':') && ops.some(o => o === '+' || o === '−'))) {
    return chainHints(nums, ops);
  }
  const named = h.match(new RegExp(String.raw`^((?:${NUMBER}) [+−×] (?:${NUMBER})) = (?:${NUMBER}), και μετά (.+)$`));
  return [h, ...(named ? [`Πρώτα ${named[1]}, και μετά ${named[2]}`] : []), ...(ops.length === 1 && ops[0] === '−' ? [countUp(nums[0], nums[1])] : []),
    ...(ops.length === 1 && ops[0] === '×' ? [unitsFirst(nums[0], nums[1])].filter((x): x is string => !!x) : [])];
}

/** 4 × 35 by its digits, no number from 10 up: «Ξεκινάμε από τις μονάδες: 4 × 5. …» (when its split names an answer) */
function unitsFirst(a: number, b: number): string | null {
  const [k, m] = a <= b ? [a, b] : [b, a];
  if (k < 2 || k > 9 || m < 10 || m > 999 || m % 10 === 0) return null;
  return `Ξεκινάμε από τις μονάδες: ${k} × ${m % 10}. Μετά οι δεκάδες${m >= 100 ? ' και οι εκατοντάδες' : ''}, μαζί με τα κρατούμενα.`;
}

/** The hint b.numbers writes from its rows: how to start the first row it can say something about. */
export function rowsHint(rows: { label: string; answer: number; eq?: string }[]): string | null {
  const answers = new Set(rows.map(r => r.answer));
  // A hint that states a row's answer gives it away (hintShows' rule): any of them after «=», and from
  // 10 up anywhere, even as a part of the calculation («23 − 10 = 13, και μετά βγάζουμε 3 ακόμα» when
  // 23 − 13 is 10: the count up says it instead) or a trial («Δοκιμάζουμε 5 × 500» when 2.502 : 5 is
  // 500: it tries 5 × 400). A digit is a step of the way («13 − 3 = 10, και μετά βγάζουμε 5 ακόμα» for 13 − 8).
  // (A product one zero short of the answer, «5 × 3 = 15» for 5 × 30, is that answer too: mulHint asks it instead.)
  const fair = (h: string) => ![...h.matchAll(new RegExp(String.raw`=\s*(${NUMBER})(?![\d.]*\d)`, 'g'))].some(x => answers.has(toNumber(x[1])))
    && !numbersOf(h).some(n => n >= 10 && answers.has(n));
  // A row worked from the answer of a row above it waits for that one: its hint would work on a number
  // she hasn't found («200 × 2 = 400, και μετά 60 × 2» for 260 × 2, under the row that asks 260), and
  // help with a later row while she is stuck on the first.
  const hints = rows.map((r, i) => {
    const expr = r.eq ?? r.label;
    if (numbersOf(expr).some(n => rows.slice(0, i).some(above => above.answer === n))) return undefined;
    return workHints(expr).find(fair);
  }).filter((h): h is string => !!h);
  return hints[0] ?? null;
}

// ---------------------------------------------------------------------------
// Nothing on a step shows an answer still to work out (#50 part 5d). A hint shows after a wrong try,
// and a hint that works the row out is copied on the second; a row label that names the row above's
// answer («Περίπου: 69.000 − 58.000 =» under «Το 69.348») gives that row away, since every row of a
// step is on screen at once. Showing the step is «Δείξε μου»'s job.

/** A number on a step that she hasn't worked out yet, where it is and which step asks for it. */
export interface Shown { step: number; where: string; text: string; number: number; answerOf: number; /** a choice's hint, with a number only its right option has */ points?: true }

const MARKED = /\[([^\]|]+)\|(?:known|sought|extra)\]/g;

/**
 * What each step of a problem shows (its prompt, its hint, its rows' labels) that is an answer still to
 * work out: a number that a numbers row of this step or a later one asks for and she hasn't settled.
 * Settled: what the story (or an earlier step's own story) gives, the answers of earlier steps' rows,
 * and the numbers of earlier choices' right options (she picked them). In a prompt or a hint a number
 * below 10 counts only after «=»: written words meet small numbers by chance («4 παιδικά» beside a
 * price of 4 €). A row label counts a small one too when a row above it asks for it: its numbers are
 * its calculation («3 × 7 =» under «Πόσα παιδιά είναι [3]»), and a digit of its own («2 + 1 + 6 + 7 =»
 * beside a remainder of 1) is not a row's answer. A choice's hint also has no number, of any size, that
 * its right option has, no wrong option has and isn't settled: it would point at that option (#50 part 6).
 */
export function hintShows(ex: { story: string; steps: ProblemStep[] }): Shown[] {
  const settled = new Set(numbersOf(ex.story.replace(MARKED, '$1')));
  const out: Shown[] = [];
  ex.steps.forEach((step, i) => {
    if (step.story) for (const n of numbersOf(step.story)) settled.add(n);
    // Asked at this step or later, and not settled before it: the first step that asks
    const asked = new Map<number, number>();
    ex.steps.forEach((s, j) => {
      if (j >= i && s.kind === 'numbers') for (const r of s.rows) if (!settled.has(r.answer) && !asked.has(r.answer)) asked.set(r.answer, j);
    });
    // [where, text, the small numbers that count there: a label's, the rows above it ask for]
    const texts: [string, string, Set<number>][] = [['prompt', step.prompt, new Set()], ['hint', step.hint ?? '', new Set()]];
    if (step.kind === 'numbers') step.rows.forEach((r, k) => texts.push([`row ${k}`, r.label, new Set(step.rows.slice(0, k).map(x => x.answer))]));
    for (const [where, text, above] of texts) {
      const after = new Set([...text.matchAll(new RegExp(String.raw`=\s*(${NUMBER})(?![\d.]*\d)`, 'g'))].map(x => toNumber(x[1])));
      const seen = new Set<number>();
      for (const n of numbersOf(text)) {
        if (seen.has(n) || !asked.has(n) || (n < 10 && !after.has(n) && !above.has(n))) continue;
        seen.add(n);
        out.push({ step: i, where, text, number: n, answerOf: asked.get(n)! });
      }
    }
    // A choice's hint points at its right option with a number only that option has, of any size
    // («Τα κέρματα δεν αξίζουν 1 € το καθένα.» above «Μέτρησε κάθε κέρμα σαν 1 €»)
    if (step.kind === 'choice' && step.hint) {
      const right = new Set(numbersOf(step.options[step.correctIndex] ?? ''));
      const wrong = new Set(step.options.filter((_, k) => k !== step.correctIndex).flatMap(numbersOf));
      const told = new Set(out.filter(s => s.step === i && s.where === 'hint').map(s => s.number));
      for (const n of new Set(numbersOf(step.hint))) {
        if (right.has(n) && !wrong.has(n) && !settled.has(n) && !told.has(n)) out.push({ step: i, where: 'hint', text: step.hint, number: n, answerOf: i, points: true });
      }
    }
    if (step.kind === 'numbers') for (const r of step.rows) settled.add(r.answer);
    if (step.kind === 'choice') for (const n of numbersOf(step.options[step.correctIndex] ?? '')) settled.add(n);
  });
  return out;
}

/** «step 2 hint «…» shows 445, the answer of step 2», or «step 3 hint «…» points at the right option: 1 is in it and in no other» */
export const shownText = (s: Shown) => s.points
  ? `step ${s.step} hint «${s.text}» points at the right option: ${fmt(s.number)} is in it and in no other`
  : `step ${s.step} ${s.where} «${s.text}» shows ${fmt(s.number)}, the answer of step ${s.answerOf}`;

// ---------------------------------------------------------------------------
// Steps. Choices are shuffled here, so a family lists the right answer first.

export interface Row { label: string; answer: number; unit?: string; /** how it is worked out («27 + 36»), when the label doesn't say */ eq?: string }

export interface Builder {
  tag(prompt?: string, hint?: string): ProblemTagStep;
  /** Each option one wording or several (Wording): the ones that put the right option at the problem's place for this prompt. */
  choice(phase: ProblemPhase, prompt: string, right: Wording, wrong: Wording[], hint?: string, story?: string): ProblemChoiceStep;
  /** Without `hint`, one is written from the rows' equations (rowsHint); a step it can't write a fair one for is listed in `hintless`. */
  numbers(phase: ProblemPhase, prompt: string, rows: Row[], hint?: string): ProblemNumbersStep;
  order(phase: ProblemPhase, prompt: string, items: string[], hint?: string): ProblemOrderStep;
  /** What the choices give away (lengthTell), or options repeated: gen.ts drops such a draft. */
  tells: string[];
  /** Numbers steps with no hint of their own and none rowsHint could write without an answer: gen.ts drops such a draft. */
  hintless: string[];
  /** The prompts (promptKey) whose wordings can't spread the right option evenly over the places, with the busiest place's share: gen.ts --places lists them. */
  uneven: { key: string; busiest: number }[];
}

export const READ_PROMPT_G3 = 'Τι ξέρουμε και τι ψάχνουμε;';
export const READ_PROMPT_E5 = 'Τι προσπαθούμε να βρούμε; Τι γνωρίζουμε;';

/**
 * `seedFor(key)`: where this problem falls among its family's problems for a prompt (placeSeed, from
 * the problem's id); without it, each option's first valid wording.
 */
export function builder(r: Rng, readPrompt: string, seedFor?: (key: string) => number): Builder {
  const tells: string[] = [];
  const hintless: string[] = [];
  const uneven: { key: string; busiest: number }[] = [];
  return {
    tells, hintless, uneven,
    tag: (prompt = readPrompt, hint) => ({ kind: 'tag', phase: 'read', prompt, ...(hint ? { hint } : {}) }),
    choice: (phase, prompt, right, wrong, hint, story) => {
      const sets = [right, ...wrong].map(w => (typeof w === 'string' ? [w] : [...w]));
      // The only draw: the order on screen (as before wordings, so stories and slots stay)
      const slot = r.shuffle(sets.map((_, i) => i));
      const correctIndex = slot.indexOf(0);
      const chosen = chooseWordings(sets, slot, seedFor?.(promptKey(prompt)));
      let options = chosen?.options;
      if (chosen && seedFor && chosen.busiest > 1 / sets.length + 0.02) uneven.push({ key: promptKey(prompt), busiest: chosen.busiest });
      if (!options) {
        options = slot.map(i => sets[i][0]);
        tells.push(`${prompt} ${new Set(options).size !== options.length ? `repeated options ${JSON.stringify(options)}` : lengthTell(options, correctIndex) ?? 'no wording fits'}`);
      }
      return {
        kind: 'choice', phase, prompt, options, correctIndex,
        ...(hint ? { hint } : {}), ...(story ? { story } : {}),
      };
    },
    numbers: (phase, prompt, rows, hint) => {
      const h = hint ?? rowsHint(rows);
      if (!h) hintless.push(`«${prompt}» (${rows.map(row => `${row.label} [${row.answer}]`).join(' | ')})`);
      return {
        kind: 'numbers', phase, prompt,
        rows: rows.map(row => ({ label: row.label, answer: row.answer, ...(row.unit ? { unit: row.unit } : {}) })),
        hint: h ?? '',
      };
    },
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
