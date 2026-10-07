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
// only tell left. At both ends no option stands out by length: the longest at most 30 % longer
// than the next, in code points, or at most 5 longer («Δεν τους χρειαζόμαστε» beside «Τους
// προσθέτουμε» doesn't show), and the shortest at most 30 % or 5 shorter than the next. The right
// one is never the only longest. Options that are all numbers («12», «1.229 €») are compared by
// their digits instead: the right one is never the only one with the most digits. builder.choice
// flags a choice that breaks this, gen.ts drops the draft, and audit.ts fails it in every pool.
// The other end can't be a rule per choice (never the only longest nor the only shortest would
// make the right one the middle one, every time): audit.ts fails a family whose right option is
// the only shortest in more than half the choices of one prompt (onlyShortest).

export const STAND_OUT = 1.3;
const STAND_OUT_MIN = 6;
const NUMERIC_OPTION = /^\d{1,3}(?:\.\d{3})*(?:\s+[^\d\s]+){0,2}$/;
const codePoints = (s: string) => [...s].length;

/** What gives the right option away by its length, or null. */
export function lengthTell(options: string[], correctIndex: number): string | null {
  const opts = options.map(o => o.trim());
  if (opts.every(o => NUMERIC_OPTION.test(o))) {
    const d = opts.map(o => o.replace(/\D/g, '').length);
    return d.every((x, j) => j === correctIndex || x < d[correctIndex])
      ? `the right number «${opts[correctIndex]}» is the only one with ${d[correctIndex]} digits` : null;
  }
  const L = opts.map(codePoints);
  const others = L.filter((_, j) => j !== correctIndex);
  if (others.every(x => x < L[correctIndex])) return `the right option «${opts[correctIndex]}» is the only longest (${L[correctIndex]} code points, the next ${Math.max(...others)})`;
  const [first, second] = [...L].sort((a, b) => b - a);
  if (first > STAND_OUT * second && first - second >= STAND_OUT_MIN) return `«${opts[L.indexOf(first)]}» stands out by its length (${first} code points, the next ${second})`;
  const [low, low2] = [...L].sort((a, b) => a - b);
  if (low2 > STAND_OUT * low && low2 - low >= STAND_OUT_MIN) return `«${opts[L.indexOf(low)]}» stands out by its shortness (${low} code points, the next ${low2})`;
  return null;
}

/** Whether the right option is the only shortest (code points): fine once, a tell when a family's prompt always does it. */
export function onlyShortest(options: string[], correctIndex: number): boolean {
  const L = options.map(o => codePoints(o.trim()));
  return L.every((x, j) => j === correctIndex || x > L[correctIndex]);
}

/** The most a family's prompt may have its right option as the only shortest: half its choices. */
export const SHORTEST_SHARE = 0.5;
/** A family's prompt counts from this many choices on. */
export const SHORTEST_MIN_CHOICES = 3;

// ---------------------------------------------------------------------------
// Hints that fit their numbers: how to start a calculation, without its result. b.numbers
// writes one from its rows when the family gives none (a row's equation is its label's
// «76 − 35 =», or `eq` for a row that only names its quantity).

const NUMBER = String.raw`\d{1,3}(?:\.\d{3})+|\d+`;
const EXPRESSION = new RegExp(String.raw`\(?(?:${NUMBER})\)?(?:\s+[+−×:]\s+\(?(?:${NUMBER})\)?)+`);
const toNumber = (s: string) => Number(s.replace(/\./g, ''));
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
  // A round number taken away: count up from it, to the next round number and then to the other
  const p = 10 ** String(b).length;
  const next = Math.ceil((b + 1) / p) * p;
  if (b >= 10 && next < a) return `Μετράμε από το ${fmt(b)} ως το ${fmt(a)}: πρώτα ως το ${fmt(next)}, και μετά ως το ${fmt(a)}.`;
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
    const z = trailingZeros(m);
    return `${first(k, m / 10 ** z)} = ${fmt(k * m / 10 ** z)}, και μετά βάζουμε ${zeros(z)}.`;
  }
  const [za, zb] = [trailingZeros(a), trailingZeros(b)];
  if (za + zb) return `${fmt(a / 10 ** za)} × ${fmt(b / 10 ** zb)} = ${fmt((a / 10 ** za) * (b / 10 ** zb))}, και μετά βάζουμε ${zeros(za + zb)}.`;
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

/** Every hint workHint could give for `expr`, the preferred first (rowsHint takes the first that keeps the answers back). */
function workHints(expr: string): string[] {
  const h = workHint(expr);
  if (!h) return [];
  const m = expr.match(EXPRESSION)!;
  const tokens = m[0].replace(/[()]/g, '').trim().split(/\s+/);
  const ops = tokens.filter((_, i) => i % 2 === 1);
  if (ops.length > 1 && !/\(/.test(m[0]) && !(ops.some(o => o === '×' || o === ':') && ops.some(o => o === '+' || o === '−'))) {
    return chainHints(tokens.filter((_, i) => i % 2 === 0).map(toNumber), ops);
  }
  return [h];
}

/** The hint b.numbers writes from its rows: how to start the first row it can say something about. */
export function rowsHint(rows: { label: string; answer: number; eq?: string }[]): string | null {
  const answers = new Set(rows.map(r => r.answer));
  const numbersIn = (s: string) => [...s.matchAll(new RegExp(NUMBER, 'g'))].map(x => toNumber(x[0]));
  // A hint that states a row's answer gives it away: after «=», or anywhere else unless it is a
  // number of the calculation or a part of one («23 − 10 = 13, και μετά βγάζουμε 3 ακόμα» when
  // 23 − 13 is 10), not a trial («Δοκιμάζουμε 5 × 500» when 2.502 : 5 is 500). A digit is a step
  // of the way («13 − 3 = 10, και μετά βγάζουμε 5 ακόμα» for 13 − 8).
  const fair = (expr: string) => (h: string) => {
    const given = new Set(numbersIn(expr).flatMap(n => [n, ...topSplit(n), n % 10, n - (n % 10)]));
    return ![...h.matchAll(new RegExp(String.raw`=\s*(${NUMBER})`, 'g'))].some(x => answers.has(toNumber(x[1])))
      && !numbersIn(h).some(n => n >= 10 && answers.has(n) && !given.has(n));
  };
  const hints = rows.map(r => workHints(r.eq ?? r.label).find(fair(r.eq ?? r.label))).filter((h): h is string => !!h);
  return hints[0] ?? null;
}

// ---------------------------------------------------------------------------
// Steps. Choices are shuffled here, so a family lists the right answer first.

export interface Row { label: string; answer: number; unit?: string; /** how it is worked out («27 + 36»), when the label doesn't say */ eq?: string }

export interface Builder {
  tag(prompt?: string, hint?: string): ProblemTagStep;
  choice(phase: ProblemPhase, prompt: string, right: string, wrong: string[], hint?: string, story?: string): ProblemChoiceStep;
  /** Without `hint`, one is written from the rows' equations (rowsHint); a step it can't write one for throws. */
  numbers(phase: ProblemPhase, prompt: string, rows: Row[], hint?: string): ProblemNumbersStep;
  order(phase: ProblemPhase, prompt: string, items: string[], hint?: string): ProblemOrderStep;
  /** What the choices give away (lengthTell), or options repeated: gen.ts drops such a draft. */
  tells: string[];
}

export const READ_PROMPT_G3 = 'Τι ξέρουμε και τι ψάχνουμε;';
export const READ_PROMPT_E5 = 'Τι προσπαθούμε να βρούμε; Τι γνωρίζουμε;';

export function builder(r: Rng, readPrompt: string): Builder {
  const tells: string[] = [];
  return {
    tells,
    tag: (prompt = readPrompt, hint) => ({ kind: 'tag', phase: 'read', prompt, ...(hint ? { hint } : {}) }),
    choice: (phase, prompt, right, wrong, hint, story) => {
      const options = r.shuffle([right, ...wrong]);
      const tell = new Set(options).size !== options.length ? `repeated options ${JSON.stringify(options)}` : lengthTell(options, options.indexOf(right));
      if (tell) tells.push(`${prompt} ${tell}`);
      return {
        kind: 'choice', phase, prompt, options, correctIndex: options.indexOf(right),
        ...(hint ? { hint } : {}), ...(story ? { story } : {}),
      };
    },
    numbers: (phase, prompt, rows, hint) => {
      const h = hint ?? rowsHint(rows);
      if (!h) throw new Error(`numbers step «${prompt}» (${rows.map(row => row.label).join(' | ')}): no hint, and no equation to write one from`);
      return {
        kind: 'numbers', phase, prompt,
        rows: rows.map(row => ({ label: row.label, answer: row.answer, ...(row.unit ? { unit: row.unit } : {}) })),
        hint: h,
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
