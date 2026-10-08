// Ε΄ maths families: units 1–2 of the Ε΄ book (natural numbers into the millions, place value,
// comparing and ordering, rounding; the four operations, multiples and divisors, divisibility,
// Euclidean division). No fractions or decimals: those are unit 3 on. Each is modelled on its
// chapter's workbook exercises (10-0240).

import type { Rng } from '../lib.ts';
import {
  digits, fill, fmt, forgotCarry, mc, num, order, smallerFromLarger, swaps, tf, words, wrongs,
  type MathsFamily,
} from './lib.ts';

const e5 = (f: Omit<MathsFamily, 'grade'>): MathsFamily => ({ grade: 5, ...f });
const MAX = 999_999_999;

/** True, false, true, …: shared by the grade's true/false families, so the grade's set is half and half. */
const nextTruth = (() => {
  let k = 0;
  return () => k++ % 2 === 0;
})();
const compareTruth = nextTruth, divisibleTruth = nextTruth, divisionTruth = nextTruth;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

/** A seven-digit number whose digits are all different. */
function sevenDigits(r: Rng): number {
  const ds = r.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 7);
  if (ds[0] === 0) [ds[0], ds[1]] = [ds[1], ds[0]];
  return Number(ds.join(''));
}

// «στην πλησιέστερη εκατοντάδα»: the places the book rounds to, by power of ten
const ROUND_TO: [number, string][] = [
  [1, 'στην πλησιέστερη δεκάδα'], [2, 'στην πλησιέστερη εκατοντάδα'], [3, 'στην πλησιέστερη χιλιάδα'],
  [4, 'στην πλησιέστερη δεκάδα χιλιάδων'], [5, 'στην πλησιέστερη εκατοντάδα χιλιάδων'], [6, 'στο πλησιέστερο εκατομμύριο'],
];
const roundTo = (n: number, p: number) => Math.round(n / 10 ** p) * 10 ** p;

function rounding(r: Rng, n: number, p: number) {
  const unit = 10 ** p;
  if (n % unit === 0 || n < unit) return null;
  const right = roundTo(n, p);
  // the other way (up instead of down), and the place next to it
  const other = right > n ? right - unit : right + unit;
  return { right, wrong: wrongs(right, r.shuffle([other, ...(p > 1 ? [roundTo(n, p - 1)] : []), roundTo(n, p + 1)]), 3) };
}

export const E5_MATHS: MathsFamily[] = [
  // ---- 1.4 Natural numbers ------------------------------------------------------
  e5({
    id: 'words-digits', chapter: '1.4', topic: 'Αριθμοί', skill: 'words',
    make(r) {
      const m = r.chance(0.7) ? r.int(1, 9) : r.int(10, 99);
      const k = r.pick([0, r.int(1, 9), r.step(10, 90, 10), r.step(100, 900, 100), r.int(101, 999)]);
      const u = r.pick([0, r.int(1, 9), r.step(10, 90, 10), r.step(100, 900, 100), r.int(101, 999)]);
      if (!k && !u) return null;
      const n = m * 1e6 + k * 1e3 + u;
      if (words(n).split(' ').length > 8) return null;
      // the groups in the wrong place: thousands and units swapped, a group ten times too big or small
      const candidates = r.shuffle([m * 1e6 + u * 1e3 + k, m * 1e6 + k * 10 * 1e3 + u, m * 1e6 + (k / 10) * 1e3 + u,
        m * 1e6 + k * 1e3 + u * 10, m * 1e6 + k * 1e3 + u / 10, m * 1e5 + k * 1e3 + u])
        .filter(c => Number.isInteger(c) && Math.floor(c / 1e6) === m && c % 1e6 < 1e6);
      const wrong = wrongs(n, candidates, 3, MAX);
      return mc(r, 'Οι φυσικοί αριθμοί', `Πώς γράφεται με ψηφία ο αριθμός «${words(n)}»;`, fmt(n), wrong.map(fmt));
    },
  }),
  e5({
    id: 'words-places', chapter: '1.4', topic: 'Αριθμοί', skill: 'words',
    make(r) {
      // The same digit in different places: «διακόσιες χιλιάδες», «δύο εκατομμύρια δύο χιλιάδες»;
      // the options are the same digit in the other places. Not a match (#72): the workbook has her
      // write them in a table (Τετράδιο Εργασιών Α΄, σ. 13, 3η Άσκηση), and a pair in words
      // («δύο εκατομμύρια δύο χιλιάδες → 2.002.000», 40) wraps on «Δείξε μου» (check.ts REVEAL_PAIR_MAX).
      const a = r.int(2, 9);
      const all = [a * 1e3, a * 1e4, a * 1e5, a * 1e6, a * 1e7, a * 1e6 + a * 1e3, a * 1e4 + a, a * 1e3 + a * 10, a * 1e5 + a * 100];
      const n = r.pick(all);
      const wrong = wrongs(n, r.shuffle(all), 3, MAX);
      return mc(r, 'Οι φυσικοί αριθμοί', `Πώς γράφεται με ψηφία ο αριθμός «${words(n)}»;`, fmt(n), wrong.map(fmt));
    },
  }),

  // ---- 1.5 Place value ---------------------------------------------------------
  e5({
    id: 'digit-value', chapter: '1.5', topic: 'Αριθμοί', skill: 'digit-value',
    make(r) {
      const n = sevenDigits(r);
      const ds = digits(n);
      const p = r.int(2, 5);   // hundreds to hundred thousands
      const d = ds[ds.length - 1 - p];
      if (d === 0) return null;
      const right = d * 10 ** p;
      const wrong = [d * 10 ** (p + 1), d * 10 ** (p - 1), r.chance(0.5) ? d * 10 ** (p + 2) : d * 10 ** (p - 2)];
      return mc(r, 'Αξία θέσης ψηφίου', `Ποια είναι η αξία του ψηφίου ${d} στον αριθμό ${fmt(n)};`, fmt(right), wrongs(right, wrong, 3, MAX, 100).map(fmt));
    },
  }),

  // ---- 1.6 Comparing and ordering ---------------------------------------------
  e5({
    id: 'neighbours', chapter: '1.6', topic: 'Αριθμοί', skill: 'neighbour',
    make(r) {
      const next = r.chance(0.5);
      const base = r.pick([r.step(1e6, 9e6, 1e5), r.step(100_000, 990_000, 10_000), r.step(1e6, 9e6, 1e6)]);
      const n = next ? base - 1 : base;
      const right = next ? n + 1 : n - 1;
      // the other neighbour, and a step of 10 or 100 instead of 1
      const wrong = wrongs(right, [next ? n - 1 : n + 1, next ? n + 10 : n - 10, next ? n + 100 : n - 100], 3, MAX);
      return mc(r, 'Προηγούμενος και επόμενος', `Κύκλωσε τον αμέσως ${next ? 'επόμενο' : 'προηγούμενο'} αριθμό του ${fmt(n)}.`, fmt(right), wrong.map(fmt));
    },
  }),
  e5({
    id: 'compare', chapter: '1.6', topic: 'Αριθμοί', skill: 'compare', weight: 0.6,
    make(r) {
      const a = sevenDigits(r);
      const b = r.pick(swaps(a));
      const truth = compareTruth();
      const bigger = r.chance(0.5);
      const holds = bigger ? a > b : a < b;
      const [x, y] = holds === truth ? [a, b] : [b, a];
      return tf('Σύγκριση αριθμών', `Το ${fmt(x)} είναι ${bigger ? 'μεγαλύτερο' : 'μικρότερο'} από το ${fmt(y)}.`, truth);
    },
  }),
  e5({
    id: 'largest', chapter: '1.6', topic: 'Αριθμοί', skill: 'extreme',
    make(r) {
      const n = sevenDigits(r);
      const set = [n, ...r.sample(swaps(n), 3)];
      const big = r.chance(0.5);
      const right = big ? Math.max(...set) : Math.min(...set);
      return mc(r, 'Σύγκριση αριθμών', `Κύκλωσε τον ${big ? 'μεγαλύτερο' : 'μικρότερο'} αριθμό.`, fmt(right), set.filter(x => x !== right).map(fmt));
    },
  }),
  e5({
    id: 'order', chapter: '1.6', topic: 'Αριθμοί', skill: 'order',
    make(r) {
      const n = r.chance(0.5) ? sevenDigits(r) : Math.floor(sevenDigits(r) / 10);
      const set = [n, ...r.sample(swaps(n), 3)];
      const up = r.chance(0.5);
      return order('Βάλε τους αριθμούς στη σειρά', `Βάλε τους αριθμούς στη σειρά, από τον ${up ? 'μικρότερο στον μεγαλύτερο' : 'μεγαλύτερο στον μικρότερο'}.`,
        [...set].sort((x, y) => (up ? x - y : y - x)).map(fmt));
    },
  }),
  e5({
    id: 'count-by', chapter: '1.6', topic: 'Αριθμοί', skill: 'count-by',
    make(r) {
      // «2.400.000, 2.600.000, 2.800.000, …», «660.000, 659.500, 659.000, …», «25.795, 25.895, 25.995, …»
      const step = r.pick([100, 500, 1_000, 10_000, 25_000, 50_000, 200_000]);
      const up = r.chance(0.7);
      const start = r.step(step * 5, step * 400, step) + (r.chance(0.5) ? r.int(1, 9) * step / 4 : 0);
      if (!Number.isInteger(start)) return null;
      const seq = [0, 1, 2].map(i => start + (up ? i : -i) * step);
      const last = seq[2], next = last + (up ? step : -step);
      // the carry forgotten (25.995 + 100 → 25.095), one step too many, a step ten times too small
      const slip = up ? forgotCarry(last, step) : smallerFromLarger(last, step);
      const wrong = wrongs(next, r.shuffle([slip, next + (up ? step : -step), last + (up ? step / 10 : -step / 10)]).filter(x => !seq.includes(x)), 3, MAX);
      return mc(r, 'Αριθμητικά μοτίβα', `Κύκλωσε τον επόμενο αριθμό του μοτίβου: ${seq.map(fmt).join(', ')}, …`, fmt(next), wrong.map(fmt));
    },
  }),

  // ---- 1.7 Rounding --------------------------------------------------------------
  e5({
    id: 'round', chapter: '1.7', topic: 'Αριθμοί', skill: 'round',
    make(r) {
      const n = r.pick([sevenDigits(r), r.int(10_000, 999_999)]);
      const [p, where] = r.pick(ROUND_TO.filter(([q]) => 10 ** (q + 1) < n));
      const made = rounding(r, n, p);
      if (!made) return null;
      return mc(r, 'Στρογγυλοποίηση', `Στρογγυλοποίησε το ${fmt(n)} ${where}.`, fmt(made.right), made.wrong.map(fmt));
    },
  }),
  e5({
    id: 'round-small', chapter: '1.7', topic: 'Αριθμοί', skill: 'round',
    make(r) {
      const n = r.int(1_000, 9_499);
      const [p, where] = r.pick(ROUND_TO.slice(0, 3));
      const right = roundTo(n, p);
      if (n % 10 ** p === 0 || right >= 10_000) return null;
      return num('Στρογγυλοποίηση', `Στρογγυλοποίησε το ${fmt(n)} ${where}.`, right);
    },
  }),

  // ---- 2.8 Addition and subtraction -------------------------------------------------
  e5({
    id: 'add-sub', chapter: '2.8', topic: 'Πρόσθεση', skill: 'calc',
    make(r) {
      if (r.chance(0.5)) {
        // «2.999 + 1.456», or any two four-digit numbers with a carry
        const a = r.chance(0.3) ? r.pick([1_999, 2_999, 3_999, 4_998]) : r.int(1_000, 6_000);
        const b = r.int(1_000, 9_999 - a);
        if (forgotCarry(a, b) === a + b) return null;
        return num('Πρόσθεση', `Πόσο κάνει ${fmt(a)} + ${fmt(b)};`, a + b);
      }
      const a = r.chance(0.3) ? r.pick([5_000, 7_000, 8_000, 10_000 - 1]) : r.int(3_000, 9_999);
      const b = r.int(1_000, a - 500);
      if (smallerFromLarger(a, b) === a - b) return null;
      return num('Αφαίρεση', `Πόσο κάνει ${fmt(a)} − ${fmt(b)};`, a - b);
    },
  }),
  e5({
    id: 'add-sub-big', chapter: '2.8', topic: 'Πρόσθεση', skill: 'calc',
    make(r) {
      const add = r.chance(0.5);
      const a = r.int(12_000, 900_000), b = r.int(5_000, add ? 900_000 : a - 1_000);
      const right = add ? a + b : a - b;
      const slip = add ? forgotCarry(a, b) : smallerFromLarger(a, b);
      if (slip === right) return null;
      const wrong = wrongs(right, r.shuffle([slip, right + 1_000, right - 1_000, right + 10, right - 10]), 3, MAX);
      return mc(r, add ? 'Πρόσθεση' : 'Αφαίρεση', `Πόσο κάνει ${fmt(a)} ${add ? '+' : '−'} ${fmt(b)};`, fmt(right), wrong.map(fmt));
    },
  }),

  // ---- 2.9 Multiplication -------------------------------------------------------------
  e5({
    id: 'times-10', chapter: '2.9', topic: 'Πολλαπλασιασμός', skill: 'calc',
    make(r) {
      const [a, f] = r.chance(0.6) ? [r.int(12, 9_999), r.pick([10, 100, 1_000])] : [r.step(20, 90, 10), r.step(200, 900, 100)];
      const right = a * f;
      if (right > MAX) return null;
      // a zero too few or too many
      return mc(r, 'Πολλαπλασιασμός', `Πόσο κάνει ${fmt(a)} × ${fmt(f)};`, fmt(right), r.shuffle(wrongs(right, [right / 10, right * 10], 2)).map(fmt));
    },
  }),
  e5({
    id: 'times-2d', chapter: '2.9', topic: 'Πολλαπλασιασμός', skill: 'calc',
    make(r) {
      const a = r.int(13, 99), b = r.int(12, 99);
      if (a * b >= 10_000) return null;
      return num('Πολλαπλασιασμός', `Πόσο κάνει ${a} × ${b};`, a * b);
    },
  }),
  e5({
    id: 'times-3x2', chapter: '2.9', topic: 'Πολλαπλασιασμός', skill: 'calc',
    make(r) {
      const a = r.int(123, 987), b = r.int(23, 98);
      const right = a * b;
      if (right < 10_000 || b % 10 === 0) return null;
      // the tens' partial product not moved one place left; one group too few; ten too many
      const noShift = a * Math.floor(b / 10) + a * (b % 10);
      const wrong = wrongs(right, r.shuffle([noShift, right - a, right + 10 * a]), 3);
      return mc(r, 'Πολλαπλασιασμός', `Πόσο κάνει ${fmt(a)} × ${b};`, fmt(right), wrong.map(fmt));
    },
  }),

  // ---- 2.10 Multiples and divisors -----------------------------------------------------
  e5({
    id: 'multiples', chapter: '2.10', topic: 'Πολλαπλασιασμός', skill: 'multiple',
    make(r) {
      if (r.chance(0.5)) {
        const n = r.int(3, 12), right = n * r.int(4, 12);
        const wrong = r.sample([right - 1, right + 1, right - 2, right + 2, right + n / 2, right - n / 2]
          .filter(x => Number.isInteger(x) && x > 0 && x % n !== 0), 3);
        return mc(r, 'Πολλαπλάσια', `Κύκλωσε τον αριθμό που είναι πολλαπλάσιο του ${n}.`, fmt(right), wrong.map(fmt));
      }
      const n = r.pick([12, 18, 24, 30, 36, 40, 42, 48, 54, 56, 60, 63, 72, 84, 90, 96]);
      const divisors = Array.from({ length: n / 2 - 1 }, (_, i) => i + 2).filter(x => n % x === 0);
      const right = r.pick(divisors.filter(x => x > 2));
      const wrong = r.sample(Array.from({ length: 12 }, (_, i) => right - 6 + i).filter(x => x > 1 && n % x !== 0), 3);
      return mc(r, 'Διαιρέτες', `Κύκλωσε τον αριθμό που είναι διαιρέτης του ${n}.`, fmt(right), wrong.map(fmt));
    },
  }),
  e5({
    id: 'lcm', chapter: '2.10', topic: 'Πολλαπλασιασμός', skill: 'lcm',
    make(r) {
      if (r.chance(0.3)) {
        const [a, b, c] = r.sample([2, 3, 4, 5, 6, 8, 9, 10], 3).sort((x, y) => x - y);
        const v = lcm(lcm(a, b), c);
        if (v > 180) return null;
        return num('Ε.Κ.Π.', `Βρες το Ε.Κ.Π. των ${a}, ${b} και ${c}.`, v);
      }
      const [a, b] = r.sample([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15], 2).sort((x, y) => x - y);
      const v = lcm(a, b);
      if (v > 120 || (b % a === 0 && r.chance(0.8))) return null;   // mostly pairs where the bigger one isn't the answer
      return num('Ε.Κ.Π.', `Βρες το Ε.Κ.Π. των ${a} και ${b}.`, v);
    },
  }),

  // ---- 2.11 Divisibility -------------------------------------------------------------
  e5({
    id: 'divisible', chapter: '2.11', topic: 'Διαίρεση', skill: 'divisible', weight: 0.6,
    make(r) {
      const d = r.pick([2, 3, 5, 9, 10]);
      const truth = divisibleTruth();
      for (let i = 0; i < 200; i++) {
        const n = r.int(100, 99_999);
        // a false one that nearly is: by 9 but only by 3, by 10 but only by 5, by 3 one away
        const near = d === 9 ? n % 3 === 0 : d === 10 ? n % 5 === 0 : true;
        if ((n % d === 0) === truth && (truth || near)) return tf('Κριτήρια διαιρετότητας', `Το ${fmt(n)} διαιρείται με το ${d}.`, truth);
      }
      return null;
    },
  }),
  e5({
    id: 'divisible-choice', chapter: '2.11', topic: 'Διαίρεση', skill: 'divisible',
    make(r) {
      const d = r.pick([3, 9, 5, 2]);
      const pool = Array.from({ length: 400 }, () => r.int(1_000, 9_999));
      const right = pool.find(n => n % d === 0);
      const wrong = [...new Set(pool.filter(n => n % d !== 0 && (d !== 9 || n % 3 === 0)))].slice(0, 3);
      if (right === undefined || wrong.length < 3) return null;
      return mc(r, 'Κριτήρια διαιρετότητας', `Κύκλωσε τον αριθμό που διαιρείται με το ${d}.`, fmt(right), wrong.map(fmt));
    },
  }),

  // ---- 2.12 Division -----------------------------------------------------------------
  e5({
    id: 'division', chapter: '2.12', topic: 'Διαίρεση', skill: 'division-part',
    make(r) {
      const d = r.chance(0.6) ? r.int(3, 9) : r.int(12, 48);
      const q = r.int(d < 10 ? 101 : 12, d < 10 ? 999 : 199), rem = r.chance(0.4) ? 0 : r.int(1, d - 1);
      const n = d * q + rem;
      if (n > 9_999) return null;
      const part = rem === 0 || r.chance(0.5) ? 'πηλίκο' : 'υπόλοιπο';
      return num('Η διαίρεση', `Βρες το ${part} της διαίρεσης ${fmt(n)} : ${d}.`, part === 'πηλίκο' ? q : rem);
    },
  }),
  e5({
    id: 'dividend', chapter: '2.12', topic: 'Διαίρεση', skill: 'dividend',
    make(r) {
      const d = r.int(6, 60), q = r.int(3, 40), rem = r.int(1, d - 1);
      return num('Ευκλείδεια διαίρεση', `Σε μια διαίρεση ο διαιρέτης είναι ${d}, το πηλίκο ${q} και το υπόλοιπο ${rem}. Βρες τον διαιρετέο.`, d * q + rem);
    },
  }),
  e5({
    id: 'euclid-gap', chapter: '2.12', topic: 'Διαίρεση', skill: 'equation',
    make(r) {
      // Δ = δ × π + υ with one of them missing
      const d = r.int(4, 25), q = r.int(12, 95), rem = r.int(1, d - 1);
      const n = d * q + rem;
      const missing = r.pick(['π', 'υ', 'Δ'] as const);
      const text = missing === 'π' ? `${fmt(n)} = ${d} × {0} + ${rem}` : missing === 'υ' ? `${fmt(n)} = ${d} × ${q} + {0}` : `{0} = ${d} × ${q} + ${rem}`;
      const right = missing === 'π' ? q : missing === 'υ' ? rem : n;
      const candidates = missing === 'π' ? [q + 1, q - 1, Number(String(q).split('').reverse().join(''))]
        : missing === 'υ' ? [rem + 1, rem + d, rem > 1 ? rem - 1 : rem + 2]
          : [n - rem, n + 1, n + d];
      const wrong = wrongs(right, candidates, 3);
      return fill(r, 'Ευκλείδεια διαίρεση', 'Συμπλήρωσε τον αριθμό που λείπει.', text, fmt(right), wrong.map(fmt));
    },
  }),
  e5({
    id: 'bad-remainder', chapter: '2.12', topic: 'Διαίρεση', skill: 'bad-remainder',
    make(r) {
      const d = r.int(4, 15);
      const right = r.pick([d, d + 1, d + 2]);
      const wrong = r.sample([0, ...Array.from({ length: d - 1 }, (_, i) => i + 1)], 3);
      if (!wrong.includes(d - 1) && r.chance(0.6)) wrong[0] = d - 1;
      return mc(r, 'Το υπόλοιπο της διαίρεσης', `Μια διαίρεση έχει διαιρέτη ${d}. Κύκλωσε τον αριθμό που δεν μπορεί να είναι το υπόλοιπό της.`, String(right), wrong.map(String));
    },
  }),
  e5({
    id: 'division-check', chapter: '2.12', topic: 'Διαίρεση', skill: 'div-check', weight: 0.6,
    make(r) {
      const d = r.int(3, 12), q = r.int(8, 40), rem = r.int(1, d - 1);
      const n = d * q + rem;
      const truth = divisionTruth();
      // false: a quotient one too small and the rest left over (Δ = δ × π + υ still holds, but υ ≥ δ), or a remainder off by one
      const [sq, sr] = truth ? [q, rem] : r.pick([[q - 1, rem + d], [q, rem + 1], [q, rem - 1]].filter(([, y]) => y >= 0));
      return tf('Ευκλείδεια διαίρεση', `Στη διαίρεση ${fmt(n)} : ${d} το πηλίκο είναι ${sq} και το υπόλοιπο ${sr}.`, truth);
    },
  }),
];
