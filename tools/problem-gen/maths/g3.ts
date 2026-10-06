// Γ΄ maths families: units 1–3 of «Μαθηματικά της Φύσης και της Ζωής» (numbers to 1.000 and
// then 3.000, addition and subtraction, the tables, division within them, 2-digit × 1-digit,
// lengths, money). Each is modelled on its chapter's workbook exercises (10-0060, 10-0061).

import type { Rng } from '../lib.ts';
import {
  digits, fill, fmt, forgotCarry, forgotCarryTimes, match, mc, num, order, smallerFromLarger, swaps, tf, words, wrongs,
  type Draft, type MathsFamily,
} from './lib.ts';

const g3 = (f: Omit<MathsFamily, 'grade'>): MathsFamily => ({ grade: 3, ...f });
const MAX = 3_000;

/** Alternates true and false, so a true/false family is half and half. */
function alternate() {
  let k = 0;
  return () => k++ % 2 === 0;
}
const compareTruth = alternate();

const tensWord = (n: number, unit: 'δεκάδες' | 'εκατοντάδες') => unit === 'δεκάδες' ? Math.floor(n / 10) : Math.floor(n / 100);

/** A four-digit number to 3.000 with a zero somewhere in its last three digits. */
function withZero(r: Rng): number {
  const t = r.int(1, 2);
  const shape = r.pick(['h0u', '0tu', '00u', 'ht0', '0t0']);
  const d = () => r.int(1, 9);
  const [h, te, u] = [...shape].map(c => (c === '0' ? 0 : d()));
  return t * 1000 + h * 100 + te * 10 + u;
}

export const G3_MATHS: MathsFamily[] = [
  // ---- Unit 1 -----------------------------------------------------------------
  g3({
    id: 'words-match', chapter: '1', skill: 'words',
    make(r) {
      // Four numbers from the same digits, as the workbook's «Γράφω τους αριθμούς με ψηφία»
      const [a, b] = r.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 2);
      const c = r.chance(0.5) ? 0 : r.int(1, 9);
      if (c === a || c === b) return null;
      const all = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]]
        .filter(ds => ds[0] !== 0).map(ds => Number(ds.join('')));
      const picked = r.sample([...new Set(all)], 4);
      if (picked.length < 4) return null;
      return match('Αριθμοί μέχρι το 1.000', 'Σύνδεσε κάθε αριθμό με λέξεις με τον ίδιο αριθμό με ψηφία.',
        picked.map(n => [words(n), fmt(n)]));
    },
  }),
  g3({
    id: 'tens-in', chapter: '1', skill: 'group-count',
    make(r) {
      const n = r.int(120, 999);
      if (n % 10 === 0) return null;
      return num('Δεκάδες και μονάδες', `Πόσες δεκάδες έχει συνολικά το ${fmt(n)};`, tensWord(n, 'δεκάδες'));
    },
  }),
  g3({
    id: 'add-mental', chapter: '2', skill: 'calc',
    make(r) {
      // «34 + 6 + 20», «45 + 5 + 34»: a pair that makes a ten, then the rest
      const a = r.int(12, 78), b = 10 - (a % 10), c = r.step(10, 60, 10);
      if (a % 10 === 0) return null;
      const terms = r.pick([[a, b, c], [a, c, b], [c, a, b]]);
      return num('Πρόσθεση με το μυαλό', `Πόσο κάνει ${terms.map(fmt).join(' + ')};`, a + b + c);
    },
  }),
  g3({
    id: 'money', chapter: '2', skill: 'money',
    make(r) {
      if (r.chance(0.5)) {
        // Euros: notes and coins, «Πόσα ευρώ είναι όλα τα χαρτονομίσματα μαζί;»
        const kinds = r.sample([[50, 'χαρτονόμισμα', 'χαρτονομίσματα'], [20, 'χαρτονόμισμα', 'χαρτονομίσματα'], [10, 'χαρτονόμισμα', 'χαρτονομίσματα'],
          [5, 'χαρτονόμισμα', 'χαρτονομίσματα'], [2, 'κέρμα', 'κέρματα'], [1, 'κέρμα', 'κέρματα']] as const, 3).sort((x, y) => y[0] - x[0]);
        const counts = kinds.map(() => r.int(1, 6));
        const parts = kinds.map(([v, one, many], i) => `${counts[i]} ${counts[i] === 1 ? one : many} ${v === 1 ? 'του' : 'των'} ${v} ευρώ`);
        const total = kinds.reduce((s, [v], i) => s + v * counts[i], 0);
        return num('Τα χρήματα', `Έχεις ${parts.slice(0, -1).join(', ')} και ${parts.at(-1)}. Πόσα ευρώ έχεις;`, total);
      }
      // Cents: «68 λεπτά», «89 λεπτά»
      const kinds = r.sample([50, 20, 10, 5, 2, 1], 3).sort((x, y) => y - x);
      const counts = kinds.map(() => r.int(1, 4));
      const total = kinds.reduce((s, v, i) => s + v * counts[i], 0);
      if (total >= 200) return null;
      const parts = kinds.map((v, i) => `${counts[i]} ${counts[i] === 1 ? 'κέρμα' : 'κέρματα'} ${v === 1 ? 'του 1 λεπτού' : `των ${v} λεπτών`}`);
      return num('Τα χρήματα', `Έχεις ${parts.slice(0, -1).join(', ')} και ${parts.at(-1)}. Πόσα λεπτά έχεις;`, total);
    },
  }),
  g3({
    id: 'tables-match-a', chapter: '4', skill: 'calc',
    make(r) {
      const t = r.pick([2, 3, 4, 5, 10]);
      const ks = r.sample([2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
      return match(`Προπαίδεια του ${t}`, 'Σύνδεσε κάθε πολλαπλασιασμό με το αποτέλεσμά του.',
        ks.map(k => (r.chance(0.5) ? [`${t} × ${k}`, fmt(t * k)] : [`${k} × ${t}`, fmt(t * k)])));
    },
  }),
  g3({
    id: 'tables-match-b', chapter: '5', skill: 'calc',
    make(r) {
      const t = r.pick([6, 7, 8, 9]);
      const ks = r.sample([2, 3, 4, 5, 6, 7, 8, 9, 10], 4);
      return match(`Προπαίδεια του ${t}`, 'Σύνδεσε κάθε πολλαπλασιασμό με το αποτέλεσμά του.',
        ks.map(k => (r.chance(0.5) ? [`${t} × ${k}`, fmt(t * k)] : [`${k} × ${t}`, fmt(t * k)])));
    },
  }),
  g3({
    id: 'table-gap', chapter: '6', skill: 'equation',
    make(r) {
      // «6 × _ = 42», «_ × 7 = 56», «42 : _ = 6»: the other number of the family
      const a = r.int(3, 9), b = r.int(3, 9);
      if (a === b) return null;
      const p = a * b;
      const shape = r.int(0, 2);
      const text = shape === 0 ? `${a} × {0} = ${p}` : shape === 1 ? `{0} × ${b} = ${p}` : `${p} : {0} = ${a}`;
      const right = shape === 1 ? a : b;
      const wrong = wrongs(right, [right + 1, right - 1, right + 2, right - 2], 3).map(String);
      return fill(r, 'Πολλαπλασιασμός και διαίρεση', 'Συμπλήρωσε τον αριθμό που λείπει.', text, String(right), wrong);
    },
  }),
  g3({
    id: 'divide', chapter: '6', skill: 'calc',
    make(r) {
      const d = r.int(2, 9), q = r.int(2, 10);
      return num('Διαίρεση', `Πόσο κάνει ${fmt(d * q)} : ${d};`, q);
    },
  }),
  g3({
    id: 'fact-family', chapter: '6', skill: 'fact-family',
    make(r) {
      const a = r.int(3, 9), b = r.int(3, 9);
      if (a === b) return null;
      const p = a * b;
      const right = r.pick([`${p} : ${a} = ${b}`, `${p} : ${b} = ${a}`, `${b} × ${a} = ${p}`]);
      // True sums and differences of the same numbers (another family), and a division that is off by one
      const wrong = r.sample([`${p} − ${a} = ${p - a}`, `${a} + ${b} = ${a + b}`, `${p} : ${a} = ${b + 1}`, `${p} − ${b} = ${p - b}`], 3);
      return mc(r, 'Η οικογένεια των πράξεων', `Κύκλωσε την πράξη που ανήκει στην ίδια οικογένεια με την ${a} × ${b} = ${p}.`, right, wrong);
    },
  }),

  // ---- Unit 2 -----------------------------------------------------------------
  g3({
    id: 'length', chapter: '8', skill: 'length',
    make(r) {
      switch (r.int(0, 3)) {
        case 0: { const cm = r.int(2, 30); return num('Εκατοστά και χιλιοστά', `Πόσα χιλιοστά είναι ${cm} εκατοστά;`, cm * 10); }
        case 1: { const cm = r.int(2, 20), mm = r.int(2, 9); return num('Εκατοστά και χιλιοστά', `Πόσα χιλιοστά είναι ${cm} εκατοστά και ${mm} χιλιοστά;`, cm * 10 + mm); }
        case 2: { const m = r.int(2, 9); return num('Μέτρα και εκατοστά', `Πόσα εκατοστά είναι ${m} μέτρα;`, m * 100); }
        default: { const m = r.int(2, 9), cm = r.int(2, 99); return num('Μέτρα και εκατοστά', `Πόσα εκατοστά είναι ${m} μέτρα και ${cm} εκατοστά;`, m * 100 + cm); }
      }
    },
  }),
  g3({
    id: 'subtract', chapter: '10', skill: 'calc',
    make(r) {
      const a = r.int(200, 999), b = r.int(r.chance(0.4) ? 15 : 101, a - 20);
      // with borrowing: a digit of b is larger than the one above it
      const A = String(a), B = String(b).padStart(3, '0');
      if (![...A].some((x, i) => Number(B[i]) > Number(x))) return null;
      return num('Αφαίρεση', `Πόσο κάνει ${fmt(a)} − ${fmt(b)};`, a - b);
    },
  }),
  g3({
    id: 'times-2x1', chapter: '11', skill: 'calc',
    make(r) {
      const a = r.int(12, 49), d = r.int(2, 9);
      if ((a % 10) * d < 10) return null;   // with a carry
      return num('Πολλαπλασιασμός', `Πόσο κάνει ${a} × ${d};`, a * d);
    },
  }),
  g3({
    id: 'table-11', chapter: '11', skill: 'calc',
    make(r) {
      const k = r.int(2, 10);
      const [x, y] = r.chance(0.5) ? [11, k] : [k, 11];
      return num('Προπαίδεια του 11', `Πόσο κάνει ${x} × ${y};`, 11 * k);
    },
  }),

  // ---- Unit 3 -----------------------------------------------------------------
  g3({
    id: 'words-digits', chapter: '14', skill: 'words',
    make(r) {
      const n = withZero(r);
      if (n > MAX) return null;
      const right = fmt(n);
      const wrong = r.sample(swaps(n).filter(m => Math.floor(m / 1000) === Math.floor(n / 1000)), 3).map(fmt);
      return mc(r, 'Αριθμοί μέχρι το 3.000', `Πώς γράφεται με ψηφία ο αριθμός «${words(n)}»;`, right, wrong);
    },
  }),
  g3({
    id: 'neighbours', chapter: '14', skill: 'neighbour',
    make(r) {
      // Around the tens, hundreds and thousands, where the digits change
      const base = r.pick([r.step(110, 2_990, 10), r.step(200, 2_900, 100), r.pick([1_000, 2_000, 3_000])]);
      const next = r.chance(0.5);
      const n = next ? base - 1 : base;
      if (n + 1 > MAX) return null;
      return num('Προηγούμενος και επόμενος', `Γράψε τον αμέσως ${next ? 'επόμενο' : 'προηγούμενο'} αριθμό του ${fmt(n)}.`, next ? n + 1 : n - 1);
    },
  }),
  g3({
    id: 'hundreds-in', chapter: '14', skill: 'group-count',
    make(r) {
      const n = r.int(1_010, MAX);
      if (n % 100 === 0) return null;
      return num('Εκατοντάδες', `Πόσες εκατοντάδες έχει συνολικά το ${fmt(n)};`, tensWord(n, 'εκατοντάδες'));
    },
  }),
  g3({
    id: 'digit-value', chapter: '14', skill: 'digit-value',
    make(r) {
      const n = r.int(1_023, 2_987);
      const ds = digits(n);
      if (new Set(ds).size !== 4) return null;
      const at = r.int(0, 2);   // thousands, hundreds or tens: the units digit's value is itself
      const value = ds[at] * 10 ** (3 - at);
      return num('Η αξία του ψηφίου', `Ποια είναι η αξία του ψηφίου ${ds[at]} στον αριθμό ${fmt(n)};`, value);
    },
  }),
  g3({
    id: 'digits-extreme', chapter: '14', skill: 'digits-extreme',
    make(r) {
      const ds = r.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 3);
      const big = r.chance(0.5);
      const sorted = [...ds].sort((x, y) => (big ? y - x : x - y));
      if (!big && sorted[0] === 0) [sorted[0], sorted[1]] = [sorted[1], sorted[0]];   // a three-digit number can't start with 0
      const list = `${ds[0]}, ${ds[1]} και ${ds[2]}`;
      return num('Φτιάχνω αριθμούς', `Γράψε τον ${big ? 'μεγαλύτερο' : 'μικρότερο'} τριψήφιο αριθμό με τα ψηφία ${list}, από μία φορά το καθένα.`, Number(sorted.join('')));
    },
  }),
  g3({
    id: 'compare', chapter: '14', skill: 'compare', weight: 0.9,
    make(r) {
      const a = r.int(1_000, MAX);
      const b = r.pick(swaps(a).filter(x => x <= MAX && x !== a));
      if (b === undefined) return null;
      const truth = compareTruth();
      const bigger = r.chance(0.5);
      // the statement «a is bigger/smaller than b», made true or false as wanted
      const holds = bigger ? a > b : a < b;
      const [x, y] = holds === truth ? [a, b] : [b, a];
      return tf('Σύγκριση αριθμών', `Το ${fmt(x)} είναι ${bigger ? 'μεγαλύτερο' : 'μικρότερο'} από το ${fmt(y)}.`, truth);
    },
  }),
  g3({
    id: 'order', chapter: '14', skill: 'order',
    make(r) {
      const n = r.int(1_000, MAX);
      const set = [n, ...r.sample(swaps(n).filter(x => x <= MAX), 3)];
      if (set.length < 4) return null;
      const up = r.chance(0.5);
      const sorted = [...set].sort((x, y) => (up ? x - y : y - x)).map(fmt);
      return order('Βάλε τους αριθμούς στη σειρά', `Βάλε τους αριθμούς στη σειρά, από τον ${up ? 'μικρότερο στον μεγαλύτερο' : 'μεγαλύτερο στον μικρότερο'}.`, sorted);
    },
  }),
  g3({
    id: 'expanded', chapter: '14', skill: 'calc',
    make(r) {
      // «(2 × 1.000) + (5 × 100) + 8», some places empty
      const n = withZero(r);
      if (n > MAX) return null;
      const [t, h, te, u] = digits(n);
      const terms = [`(${t} × ${fmt(1000)})`, h ? `(${h} × 100)` : '', te ? `(${te} × 10)` : '', u ? `${u}` : ''].filter(Boolean);
      if (terms.length < 3) return null;
      return num('Ανάλυση αριθμού', `Πόσο κάνει ${terms.join(' + ')};`, n);
    },
  }),
  g3({
    id: 'count-by', chapter: '14', skill: 'count-by',
    make(r) {
      const step = r.pick([10, 50, 100, 200, 250, 500]);
      const up = r.chance(0.7);
      const start = r.step(100, 2_400, step >= 100 ? 50 : 10);
      const seq = [0, 1, 2, 3].map(i => start + (up ? i : -i) * step);
      const next = start + (up ? 4 : -4) * step;
      if (seq.some(x => x <= 0) || next <= 0 || Math.max(...seq, next) > MAX) return null;
      return num('Μετράω ανά…', `Συνέχισε το μοτίβο: ${seq.map(fmt).join(', ')}, … Γράψε τον επόμενο αριθμό.`, next);
    },
  }),
  g3({
    id: 'add-sub-choice', chapter: '15', skill: 'calc',
    make(r): Draft | null {
      const add = r.chance(0.5);
      if (add) {
        const a = r.int(150, 1_800), b = r.int(120, 999);
        const right = a + b;
        const slip = forgotCarry(a, b);
        if (right > MAX || slip === right) return null;
        const wrong = wrongs(right, [slip, right + 10, right - 10, right + 100, right - 100], 3);
        return mc(r, 'Πρόσθεση', `Πόσο κάνει ${fmt(a)} + ${fmt(b)};`, fmt(right), wrong.map(fmt));
      }
      const a = r.int(400, MAX), b = r.int(120, Math.min(999, a - 50));
      const right = a - b;
      const slip = smallerFromLarger(a, b);
      if (slip === right) return null;
      const wrong = wrongs(right, [slip, right + 10, right - 10, right + 100, right - 100], 3);
      return mc(r, 'Αφαίρεση', `Πόσο κάνει ${fmt(a)} − ${fmt(b)};`, fmt(right), wrong.map(fmt));
    },
  }),
  g3({
    id: 'add', chapter: '15', skill: 'calc',
    make(r) {
      const a = r.int(105, 1_900), b = r.int(15, 999);
      if (a + b > MAX || forgotCarry(a, b) === a + b) return null;   // with a carry
      return num('Πρόσθεση', `Πόσο κάνει ${fmt(a)} + ${fmt(b)};`, a + b);
    },
  }),
  g3({
    id: 'times-choice', chapter: '17', skill: 'calc',
    make(r) {
      const a = r.int(13, 99), d = r.int(3, 9);
      const right = a * d;
      const slip = forgotCarryTimes(a, d);
      if (slip === right) return null;
      const wrong = wrongs(right, [slip, right + 10, right - 10, right + d, right - d], 3);
      return mc(r, 'Πολλαπλασιασμός', `Πόσο κάνει ${a} × ${d};`, fmt(right), wrong.map(fmt));
    },
  }),
  g3({
    id: 'divide-remainder', chapter: '18', skill: 'div-rem',
    make(r) {
      const d = r.int(3, 9), q = r.int(2, 9), rem = r.int(1, d - 1);
      const n = d * q + rem;
      const say = (x: number, y: number) => `${x} και ${y === 1 ? 'περισσεύει' : 'περισσεύουν'} ${y}`;
      const candidates: [number, number][] = [[q, rem + 1], [q, rem - 1], [q - 1, rem + d], [q + 1, d - rem]];
      const wrong = candidates.filter(([x, y]) => x > 0 && y > 0 && !(x === q && y === rem)).map(([x, y]) => say(x, y));
      return mc(r, 'Διαίρεση με υπόλοιπο', `Πόσο κάνει ${n} : ${d};`, say(q, rem), r.sample([...new Set(wrong)], 3));
    },
  }),
];
