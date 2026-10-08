// Building blocks for plain maths families: the six existing exercise types, Greek
// number words, and the typical mistakes that make good wrong options.
//
// A family picks numbers within its grade's range, writes the item in one of the fixed
// wordings check.ts can read back, and computes the key from those numbers. check.ts then
// re-solves every item from its text, independently of the code here.

import type { Exercise, ProblemExercise } from '../../../shared/types.ts';
import { fmt, type Rng } from '../lib.ts';
import type { Grade } from './curriculum.ts';
import { REVEAL_MATCH_MAX } from './check.ts';

export { fmt };

export type PlainExercise = Exclude<Exercise, ProblemExercise>;
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An item as a family makes it; the generator adds id, category, stars, source and generatorParams. */
export type Draft = DistOmit<PlainExercise, 'id' | 'category' | 'stars' | 'source' | 'generatorParams'>;

export interface MathsFamily {
  /** Short, unique within its grade, kebab-case: part of every item id. */
  id: string;
  grade: Grade;
  /** The chapter of the grade's book it comes from (curriculum.ts): its source and unit. */
  chapter: string;
  /** The wording check.ts reads back (its solvers are keyed by skill). */
  skill: string;
  /** Its share of the grade's items, relative to the others (default 1). */
  weight?: number;
  /** One item, or null to skip these numbers (the generator tries again). */
  make(r: Rng): Draft | null;
}

// ---------------------------------------------------------------------------
// The six types. Options are shuffled here, so a family lists the right one first.

const withBody = (body?: string) => (body ? { body } : {});

export const num = (title: string, question: string, value: number, body?: string): Draft =>
  ({ type: 'number-input', title, ...withBody(body), question, correctValue: value });

export const tf = (title: string, question: string, value: boolean, body?: string): Draft =>
  ({ type: 'true-false', title, ...withBody(body), question, correctValue: value });

/** Multiple choice; null when two options read the same (the family tries other numbers). */
export function mc(r: Rng, title: string, question: string, right: string, wrong: string[], body?: string): Draft | null {
  if (new Set([right, ...wrong]).size !== wrong.length + 1 || wrong.length < 2) return null;
  const options = r.shuffle([right, ...wrong]);
  return { type: 'multiple-choice', title, ...withBody(body), question, options, correctIndex: options.indexOf(right) };
}

/**
 * Match pairs, as many of `pairs` (at least 3) as fit check.ts REVEAL_MATCH_MAX, measured as «Δείξε μου»
 * showed them until #72, in one run, «a – b, c – d, …». The screen now shows one pair per line
 * («a → b»); this measure stays until #72's follow-up relaxes the cap, so the pools don't change yet.
 */
export function match(title: string, body: string, pairs: [string, string][]): Draft | null {
  if (new Set(pairs.map(p => p[0])).size !== pairs.length || new Set(pairs.map(p => p[1])).size !== pairs.length) return null;
  const line = (ps: [string, string][]) => ps.map(([l, r]) => `${l} – ${r}`).join(', ');
  let fit = pairs;
  while (fit.length > 3 && line(fit).length > REVEAL_MATCH_MAX) fit = fit.slice(0, -1);
  if (line(fit).length > REVEAL_MATCH_MAX) return null;
  return { type: 'match-pairs', title, body, pairs: fit.map(([left, right]) => ({ left, right })) };
}

/** Ordering: `items` in the right order. */
export const order = (title: string, body: string, items: string[]): Draft | null =>
  new Set(items).size === items.length
    ? { type: 'ordering', title, body, items: items.map((content, i) => ({ id: String.fromCharCode(97 + i), content })) }
    : null;

/** Fill-blank with one gap, `{0}` in the text. */
export function fill(r: Rng, title: string, body: string, textWithGaps: string, right: string, wrong: string[]): Draft | null {
  if (new Set([right, ...wrong]).size !== wrong.length + 1 || wrong.length < 2) return null;
  return { type: 'fill-blank', title, body, textWithGaps, options: r.shuffle([right, ...wrong]), correctAnswers: [right] };
}

/** The right option gives itself away when it is the only longest one (options are shuffled, so position doesn't). */
export function leaks(d: Draft): boolean {
  const [right, options] = d.type === 'multiple-choice' ? [d.options[d.correctIndex], d.options]
    : d.type === 'fill-blank' ? [d.correctAnswers[0], d.options] : [undefined, []];
  return right !== undefined && options.every(o => o === right || o.length < right.length);
}

// ---------------------------------------------------------------------------
// Numbers

/**
 * The wrong numbers among `candidates` that make sense next to `right`: whole, positive, different,
 * and at most `factor` times bigger or smaller (check.ts holds every numeric option to 100).
 */
export function wrongs(right: number, candidates: number[], n: number, max = Infinity, factor = 10): number[] {
  const out: number[] = [];
  for (const c of candidates) {
    if (out.length === n) break;
    if (!Number.isInteger(c) || c <= 0 || c === right || c > max || out.includes(c)) continue;
    if (c > right * factor || c * factor < right) continue;
    out.push(c);
  }
  return out;
}

export const digits = (n: number) => String(n).split('').map(Number);
const fromDigits = (ds: number[]) => Number(ds.join(''));

/** a + b written column by column, forgetting every carry: 456 + 278 → 624. */
export function forgotCarry(a: number, b: number): number {
  const width = Math.max(String(a).length, String(b).length);
  const A = String(a).padStart(width, '0'), B = String(b).padStart(width, '0');
  return Number([...A].map((x, i) => (Number(x) + Number(B[i])) % 10).join(''));
}

/** a − b column by column, taking the smaller digit from the larger: 604 − 258 → 454. */
export function smallerFromLarger(a: number, b: number): number {
  const width = String(a).length;
  const A = String(a), B = String(b).padStart(width, '0');
  return Number([...A].map((x, i) => Math.abs(Number(x) - Number(B[i]))).join(''));
}

/** n × d (d one digit), forgetting every carry: 47 × 6 → 242 (7 × 6 = 42, writes 2; 4 × 6 = 24). */
export function forgotCarryTimes(n: number, d: number): number {
  const ds = digits(n);
  return fromDigits(ds.map((x, i) => (i === 0 ? x * d : (x * d) % 10)));
}

/** The numbers you get from n by swapping two of its digits (the first digit stays non-zero). */
export function swaps(n: number): number[] {
  const ds = digits(n);
  const out = new Set<number>();
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      if (ds[i] === ds[j]) continue;
      const s = [...ds];
      [s[i], s[j]] = [s[j], s[i]];
      if (s[0] !== 0) out.add(fromDigits(s));
    }
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Greek number words, as the books write them: «δύο χιλιάδες τριακόσια πέντε»,
// «τρία εκατομμύρια εκατό χιλιάδες», «είκοσι μία χιλιάδες». Thousands are feminine.

const UNITS = ['', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'εφτά', 'οχτώ', 'εννιά'];
const UNITS_F = ['', 'μία', 'δύο', 'τρεις', 'τέσσερις', 'πέντε', 'έξι', 'εφτά', 'οχτώ', 'εννιά'];
const TEENS = ['δέκα', 'έντεκα', 'δώδεκα', 'δεκατρία', 'δεκατέσσερα', 'δεκαπέντε', 'δεκαέξι', 'δεκαεφτά', 'δεκαοχτώ', 'δεκαεννιά'];
const TEENS_F = ['δέκα', 'έντεκα', 'δώδεκα', 'δεκατρείς', 'δεκατέσσερις', 'δεκαπέντε', 'δεκαέξι', 'δεκαεφτά', 'δεκαοχτώ', 'δεκαεννιά'];
const TENS = ['', '', 'είκοσι', 'τριάντα', 'σαράντα', 'πενήντα', 'εξήντα', 'εβδομήντα', 'ογδόντα', 'ενενήντα'];
const HUNDREDS = ['', 'εκατό', 'διακόσια', 'τριακόσια', 'τετρακόσια', 'πεντακόσια', 'εξακόσια', 'εφτακόσια', 'οχτακόσια', 'εννιακόσια'];
const HUNDREDS_F = ['', 'εκατό', 'διακόσιες', 'τριακόσιες', 'τετρακόσιες', 'πεντακόσιες', 'εξακόσιες', 'εφτακόσιες', 'οχτακόσιες', 'εννιακόσιες'];

function below1000(n: number, feminine: boolean): string[] {
  const h = Math.floor(n / 100), rest = n % 100, t = Math.floor(rest / 10), u = rest % 10;
  const out: string[] = [];
  if (h) out.push(h === 1 ? (rest ? 'εκατόν' : 'εκατό') : (feminine ? HUNDREDS_F : HUNDREDS)[h]);
  if (rest >= 10 && rest < 20) out.push((feminine ? TEENS_F : TEENS)[rest - 10]);
  else {
    if (t) out.push(TENS[t]);
    if (u) out.push((feminine ? UNITS_F : UNITS)[u]);
  }
  return out;
}

export function words(n: number): string {
  if (n === 0) return 'μηδέν';
  if (!Number.isInteger(n) || n < 0 || n >= 1e9) throw new Error(`words(${n})`);
  const m = Math.floor(n / 1e6), k = Math.floor((n % 1e6) / 1000), u = n % 1000;
  const out: string[] = [];
  if (m) out.push(...(m === 1 ? ['ένα', 'εκατομμύριο'] : [...below1000(m, false), 'εκατομμύρια']));
  if (k) out.push(...(k === 1 ? ['χίλια'] : [...below1000(k, true), 'χιλιάδες']));
  out.push(...below1000(u, false));
  return out.join(' ');
}

/** Words the item may show (match pairs stay short enough to read on one revealed line). */
export const wordCount = (s: string) => s.split(' ').length;
