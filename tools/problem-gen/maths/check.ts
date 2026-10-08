// The audit of the generated plain maths items (called from ../audit.ts, which checks every
// pool in one command). It re-solves each item from its own text, independently of the
// generator: each `skill` (generatorParams.skill) has a solver that reads the fixed wording
// its families use, and an item a solver can't read is an error. It reads only the pools,
// curriculum.ts (the committed TOC and range) and check-gender's word list.
//
// Errors:
//   - the key isn't the solver's answer; a multiple choice or fill-blank without exactly one right
//     option; a match pair whose sides differ; an ordering out of order;
//   - repeated options, pairs or items; the right option the only longest one (it gives itself away);
//     a numeric wrong option that isn't a whole number or is over 100 times off the right one;
//   - a number-input answer that isn't a whole number below 10.000 (the numpad has no grouping);
//     a fill-blank without exactly one gap or with fewer than 3 options;
//   - numbers past the grade's range (Γ΄ ≤ 3.000, a product past the tables, a division past them),
//     a fraction or a decimal, numbers not written as the books do (1.229), ÷, x or - for :, × and −;
//   - a gendered word (check-gender's list), template leftovers, doubled spaces, space before punctuation;
//     number words that don't agree (τρεις χιλιάδες, τρία εκατομμύρια, κέρμα/κέρματα);
//   - a source that isn't a chapter of the committed TOC within the grade's units; stars other than 1;
//     an id twice, not `<prefix>-math-<family>-NNN`, or with «-gen-»;
//   - per grade: fewer than 60 items; true-false or fill-blank over 10 % of them; true-false
//     answered «Σωστό» outside 40–60 %.
// Warnings: a family whose items share their answers, a family with fewer than 3 items.

import type { Exercise } from '../../../shared/types.ts';
import { genderedWords } from '../../../frontend/scripts/gendered.mjs';
import { CURRICULUM, chapterOf, type Grade } from './curriculum.ts';
import type { Rng } from '../lib.ts';

type Plain = Exclude<Exercise, { type: 'problem' }>;
type Pool = { file: string; grades: number[]; exercises: Exercise[] };

export const MIN_ITEMS = 60;
const PREFIX: Record<Grade, string> = { 3: 'g3', 5: 'e5' };

// ---------------------------------------------------------------------------
// Reading numbers and arithmetic, as the books write them

const NUM = String.raw`\d{1,3}(?:\.\d{3})+|\d+`;
const NUMG = `(?:${NUM})`;
const N = `(${NUM})`;
const toNumber = (s: string) => Number(s.replace(/\./g, ''));
const isNumber = (s: string) => new RegExp(`^(?:${NUM})$`).test(s.trim());

function evaluate(expr: string): number {
  const js = expr.replace(new RegExp(NUM, 'g'), m => String(toNumber(m))).replace(/−/g, '-').replace(/×/g, '*').replace(/:/g, '/');
  if (!/^[\d\s+\-*/()]+$/.test(js)) throw new Error(`not arithmetic: «${expr}»`);
  return Function(`"use strict"; return (${js});`)() as number;
}

/** «2.279 = 25 × 91 + 4»: both sides equal. */
function holds(equation: string): boolean {
  const sides = equation.split(' = ');
  if (sides.length !== 2) throw new Error(`not an equation: «${equation}»`);
  return Math.abs(evaluate(sides[0]) - evaluate(sides[1])) < 1e-9;
}

// ---------------------------------------------------------------------------
// Number words, read back (and checked for agreement: thousands are feminine, the rest neuter)

const SMALL: Record<string, [number, 'n' | 'f' | 'any']> = {
  'ένα': [1, 'n'], 'μία': [1, 'f'], 'μια': [1, 'f'], 'δύο': [2, 'any'], 'τρία': [3, 'n'], 'τρεις': [3, 'f'],
  'τέσσερα': [4, 'n'], 'τέσσερις': [4, 'f'], 'πέντε': [5, 'any'], 'έξι': [6, 'any'], 'εφτά': [7, 'any'], 'επτά': [7, 'any'],
  'οχτώ': [8, 'any'], 'οκτώ': [8, 'any'], 'εννιά': [9, 'any'], 'εννέα': [9, 'any'],
  'δέκα': [10, 'any'], 'έντεκα': [11, 'any'], 'δώδεκα': [12, 'any'], 'δεκατρία': [13, 'n'], 'δεκατρείς': [13, 'f'],
  'δεκατέσσερα': [14, 'n'], 'δεκατέσσερις': [14, 'f'], 'δεκαπέντε': [15, 'any'], 'δεκαέξι': [16, 'any'], 'δεκάξι': [16, 'any'],
  'δεκαεφτά': [17, 'any'], 'δεκαεπτά': [17, 'any'], 'δεκαοχτώ': [18, 'any'], 'δεκαοκτώ': [18, 'any'], 'δεκαεννιά': [19, 'any'], 'δεκαεννέα': [19, 'any'],
  'είκοσι': [20, 'any'], 'τριάντα': [30, 'any'], 'σαράντα': [40, 'any'], 'πενήντα': [50, 'any'], 'εξήντα': [60, 'any'],
  'εβδομήντα': [70, 'any'], 'ογδόντα': [80, 'any'], 'ενενήντα': [90, 'any'], 'εκατό': [100, 'any'], 'εκατόν': [100, 'any'],
};
for (const [stem, h] of [['διακόσι', 2], ['τριακόσι', 3], ['τετρακόσι', 4], ['πεντακόσι', 5], ['εξακόσι', 6], ['εφτακόσι', 7],
  ['επτακόσι', 7], ['οχτακόσι', 8], ['οκτακόσι', 8], ['εννιακόσι', 9], ['εννεακόσι', 9]] as [string, number][]) {
  SMALL[`${stem}α`] = [h * 100, 'n'];
  SMALL[`${stem}ες`] = [h * 100, 'f'];
}

/** «τρία εκατομμύρια εκατό χιλιάδες» → 3100000; throws on a word it doesn't know or that doesn't agree. */
export function wordsToNumber(text: string): number {
  const tokens = text.trim().split(/\s+/);
  let total = 0, group = 0, groupTokens: string[] = [];
  const close = (gender: 'n' | 'f', times: number) => {
    for (const t of groupTokens) {
      const g = SMALL[t][1];
      if (g !== 'any' && g !== gender) throw new Error(`«${t}» doesn't agree with ${gender === 'f' ? 'χιλιάδες' : 'its number'}`);
    }
    if (groupTokens.at(-1) === 'εκατόν') throw new Error('«εκατόν» with nothing after it');
    if (groupTokens.slice(0, -1).includes('εκατό')) throw new Error('«εκατό» before more of its number (εκατόν)');
    total += group * times;
    group = 0;
    groupTokens = [];
  };
  for (const t of tokens) {
    if (t in SMALL) { group += SMALL[t][0]; groupTokens.push(t); }
    else if (t === 'εκατομμύρια' || t === 'εκατομμύριο') {
      if ((t === 'εκατομμύριο') !== (group === 1)) throw new Error(`«${t}» after ${group}`);
      close('n', 1e6);
    } else if (t === 'χιλιάδες') {
      if (group < 2) throw new Error('«χιλιάδες» after one (it is «χίλια»)');
      close('f', 1e3);
    } else if (t === 'χίλια') {
      if (groupTokens.length) throw new Error('«χίλια» after a number');
      total += 1000;
    } else throw new Error(`unknown number word «${t}»`);
  }
  close('n', 1);
  return total;
}

// ---------------------------------------------------------------------------
// Solvers: what each skill's wording says the answer is

type Verdict = string[];   // errors

const one = <T>(xs: T[], right: (x: T) => boolean, key: number, what = 'option'): Verdict => {
  const rights = xs.map((x, i) => (right(x) ? i : -1)).filter(i => i >= 0);
  if (rights.length !== 1) return [`${rights.length} right ${what}s (${rights.map(i => `«${xs[i]}»`).join(', ') || 'none'})`];
  return rights[0] === key ? [] : [`the key is «${xs[key]}», the right ${what} is «${xs[rights[0]]}»`];
};

/** An item whose answer is a number: number-input compares its value, multiple choice its options. */
function byValue(ex: Plain, value: number): Verdict {
  if (ex.type === 'number-input') return ex.correctValue === value ? [] : [`key ${ex.correctValue}, solved ${value}`];
  if (ex.type === 'multiple-choice') return one(ex.options, o => isNumber(o) && toNumber(o) === value, ex.correctIndex);
  return [`a ${ex.type} can't answer with a number`];
}

const read = (text: string, re: RegExp) => {
  const m = text.match(re);
  if (!m) throw new Error(`can't read «${text}»`);
  return m;
};

const question = (ex: Plain) => ('question' in ex ? ex.question : '');

const SOLVERS: Record<string, (ex: Plain) => Verdict> = {
  calc(ex) {
    if (ex.type === 'match-pairs') return ex.pairs.flatMap(p => (evaluate(p.left) === toNumber(p.right) ? [] : [`«${p.left}» is not ${p.right}`]));
    return byValue(ex, evaluate(read(question(ex), /^Πόσο κάνει (.+);$/)[1]));
  },
  equation(ex) {
    if (ex.type !== 'fill-blank') return ['equation is a fill-blank'];
    return one(ex.options, o => holds(ex.textWithGaps.replace('{0}', o)), ex.options.indexOf(ex.correctAnswers[0]));
  },
  'div-rem'(ex) {
    if (ex.type !== 'multiple-choice') return ['div-rem is a multiple choice'];
    const [, a, b] = read(ex.question, new RegExp(`^Πόσο κάνει ${N} : ${N};$`)).map(toNumber);
    const errs: string[] = [];
    const right = (o: string) => {
      const m = read(o, /^(\d+) και (περισσεύει|περισσεύουν) (\d+)$/);
      if ((m[2] === 'περισσεύει') !== (m[3] === '1')) errs.push(`«${o}»: περισσεύει with 1, περισσεύουν with more`);
      return Number(m[1]) === Math.floor(a / b) && Number(m[3]) === a % b;
    };
    return [...one(ex.options, right, ex.correctIndex), ...errs];
  },
  'division-part'(ex) {
    const m = read(question(ex), new RegExp(`^Βρες το (πηλίκο|υπόλοιπο) της διαίρεσης ${N} : ${N}\\.$`));
    const [a, b] = [toNumber(m[2]), toNumber(m[3])];
    return byValue(ex, m[1] === 'πηλίκο' ? Math.floor(a / b) : a % b);
  },
  dividend(ex) {
    const [, d, q, r] = read(question(ex), new RegExp(`^Σε μια διαίρεση ο διαιρέτης είναι ${N}, το πηλίκο ${N} και το υπόλοιπο ${N}\\. Βρες τον διαιρετέο\\.$`)).map(toNumber);
    return [...(r < d ? [] : [`remainder ${r} is not smaller than the divisor ${d}`]), ...byValue(ex, d * q + r)];
  },
  'div-check'(ex) {
    if (ex.type !== 'true-false') return ['div-check is a true-false'];
    const [, a, b, q, r] = read(ex.question, new RegExp(`^Στη διαίρεση ${N} : ${N} το πηλίκο είναι ${N} και το υπόλοιπο ${N}\\.$`)).map(toNumber);
    const truth = q === Math.floor(a / b) && r === a % b;
    return ex.correctValue === truth ? [] : [`key ${ex.correctValue}, solved ${truth}`];
  },
  'bad-remainder'(ex) {
    if (ex.type !== 'multiple-choice') return ['bad-remainder is a multiple choice'];
    const d = toNumber(read(ex.question, new RegExp(`^Μια διαίρεση έχει διαιρέτη ${N}\\. Κύκλωσε τον αριθμό που δεν μπορεί να είναι το υπόλοιπό της\\.$`))[1]);
    return one(ex.options, o => toNumber(o) >= d, ex.correctIndex);
  },
  neighbour(ex) {
    const m = read(question(ex), new RegExp(`^(?:Γράψε|Κύκλωσε) τον αμέσως (επόμενο|προηγούμενο) αριθμό του ${N}\\.$`));
    return byValue(ex, toNumber(m[2]) + (m[1] === 'επόμενο' ? 1 : -1));
  },
  words(ex) {
    if (ex.type === 'match-pairs') return ex.pairs.flatMap(p => (wordsToNumber(p.left) === toNumber(p.right) ? [] : [`«${p.left}» is not ${p.right}`]));
    return byValue(ex, wordsToNumber(read(question(ex), /^Πώς γράφεται με ψηφία ο αριθμός «(.+)»;$/)[1]));
  },
  'group-count'(ex) {
    const m = read(question(ex), new RegExp(`^Πόσες (δεκάδες|εκατοντάδες) έχει συνολικά το ${N};$`));
    return byValue(ex, Math.floor(toNumber(m[2]) / (m[1] === 'δεκάδες' ? 10 : 100)));
  },
  'digit-value'(ex) {
    const m = read(question(ex), new RegExp(`^Ποια είναι η αξία του ψηφίου (\\d) στον αριθμό ${N};$`));
    const ds = String(toNumber(m[2]));
    const at = [...ds].map((c, i) => (c === m[1] ? i : -1)).filter(i => i >= 0);
    if (at.length !== 1) return [`the digit ${m[1]} is ${at.length} times in ${m[2]}`];
    return byValue(ex, Number(m[1]) * 10 ** (ds.length - 1 - at[0]));
  },
  'digits-extreme'(ex) {
    const m = read(question(ex), /^Γράψε τον (μεγαλύτερο|μικρότερο) τριψήφιο αριθμό με τα ψηφία (\d), (\d) και (\d), από μία φορά το καθένα\.$/);
    const ds = [m[2], m[3], m[4]];
    if (new Set(ds).size !== 3) return ['the digits repeat'];
    const all = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(p => p.map(i => ds[i]))
      .filter(p => p[0] !== '0').map(p => Number(p.join('')));
    return byValue(ex, m[1] === 'μεγαλύτερο' ? Math.max(...all) : Math.min(...all));
  },
  compare(ex) {
    if (ex.type !== 'true-false') return ['compare is a true-false'];
    const m = read(ex.question, new RegExp(`^Το ${N} είναι (μεγαλύτερο|μικρότερο) από το ${N}\\.$`));
    const [a, b] = [toNumber(m[1]), toNumber(m[3])];
    const truth = m[2] === 'μεγαλύτερο' ? a > b : a < b;
    return ex.correctValue === truth ? [] : [`key ${ex.correctValue}, solved ${truth}`];
  },
  extreme(ex) {
    if (ex.type !== 'multiple-choice') return ['extreme is a multiple choice'];
    const m = read(ex.question, /^Κύκλωσε τον (μεγαλύτερο|μικρότερο) αριθμό\.$/);
    const values = ex.options.map(toNumber);
    const want = m[1] === 'μεγαλύτερο' ? Math.max(...values) : Math.min(...values);
    return one(ex.options, o => toNumber(o) === want, ex.correctIndex);
  },
  order(ex) {
    if (ex.type !== 'ordering') return ['order is an ordering'];
    const m = read(ex.body ?? '', /^Βάλε τους αριθμούς στη σειρά, από τον (μικρότερο στον μεγαλύτερο|μεγαλύτερο στον μικρότερο)\.$/);
    const up = m[1].startsWith('μικρότερο');
    const v = ex.items.map(i => toNumber(i.content));
    return v.every((x, i) => i === 0 || (up ? x > v[i - 1] : x < v[i - 1])) ? [] : [`not ${m[1]}: ${ex.items.map(i => i.content).join(', ')}`];
  },
  round(ex) {
    const m = read(question(ex), new RegExp(`^Στρογγυλοποίησε το ${N} (στην πλησιέστερη (δεκάδα χιλιάδων|εκατοντάδα χιλιάδων|δεκάδα|εκατοντάδα|χιλιάδα)|στο πλησιέστερο εκατομμύριο)\\.$`));
    const unit = { 'δεκάδα': 10, 'εκατοντάδα': 100, 'χιλιάδα': 1e3, 'δεκάδα χιλιάδων': 1e4, 'εκατοντάδα χιλιάδων': 1e5 }[m[3]] ?? 1e6;
    const n = toNumber(m[1]);
    return byValue(ex, Math.floor(n / unit + 0.5) * unit);
  },
  'count-by'(ex) {
    const m = read(question(ex), /^(?:Συνέχισε το μοτίβο: (.+), … Γράψε τον επόμενο αριθμό\.|Κύκλωσε τον επόμενο αριθμό του μοτίβου: (.+), …)$/);
    const seq = (m[1] ?? m[2]).split(', ').map(toNumber);
    const step = seq[1] - seq[0];
    if (seq.length < 3 || step === 0 || seq.some((x, i) => i && x - seq[i - 1] !== step)) return [`not a pattern with one step: ${seq.join(', ')}`];
    return byValue(ex, seq.at(-1)! + step);
  },
  'fact-family'(ex) {
    if (ex.type !== 'multiple-choice') return ['fact-family is a multiple choice'];
    const m = read(ex.question, new RegExp(`^Κύκλωσε την πράξη που ανήκει στην ίδια οικογένεια με την (${NUMG} × ${NUMG} = ${NUMG})\\.$`));
    const stem = m[1];
    if (!holds(stem)) return [`«${stem}» is false`];
    const numbers = (eq: string) => (eq.match(new RegExp(NUM, 'g')) ?? []).map(toNumber).sort((a, b) => a - b).join(',');
    return one(ex.options, o => /^\S+ [×:] \S+ = \S+$/.test(o) && holds(o) && numbers(o) === numbers(stem) && o !== stem, ex.correctIndex);
  },
  length(ex) {
    const m = read(question(ex), /^Πόσα (χιλιοστά|εκατοστά) είναι (.+);$/);
    const MM: Record<string, number> = { 'μέτρο': 1000, 'μέτρα': 1000, 'εκατοστό': 10, 'εκατοστά': 10, 'χιλιοστό': 1, 'χιλιοστά': 1 };
    let mm = 0;
    for (const part of m[2].split(' και ')) {
      const p = read(part, new RegExp(`^${N} (μέτρο|μέτρα|εκατοστό|εκατοστά|χιλιοστό|χιλιοστά)$`));
      if ((toNumber(p[1]) === 1) !== /ο$/.test(p[2])) return [`«${part}»: the noun doesn't agree with the number`];
      mm += toNumber(p[1]) * MM[p[2]];
    }
    return byValue(ex, mm / (m[1] === 'χιλιοστά' ? 1 : 10));
  },
  money(ex) {
    const m = read(question(ex), /^Έχεις (.+)\. Πόσα (ευρώ|λεπτά) έχεις;$/);
    const parts = m[1].split(/, | και /);
    const NOTES = [5, 10, 20, 50, 100, 200, 500], EURO_COINS = [1, 2], CENT_COINS = [1, 2, 5, 10, 20, 50];
    let total = 0;
    const errs: string[] = [];
    for (const part of parts) {
      const p = read(part, new RegExp(`^${N} (χαρτονόμισμα|χαρτονομίσματα|κέρμα|κέρματα) (του|των) ${N} (ευρώ|λεπτού|λεπτών)$`));
      const [count, value] = [toNumber(p[1]), toNumber(p[4])];
      const note = p[2].startsWith('χαρτο'), euro = p[5] === 'ευρώ';
      if ((count === 1) !== (p[2] === 'χαρτονόμισμα' || p[2] === 'κέρμα')) errs.push(`«${part}»: the noun doesn't agree with ${count}`);
      if ((value === 1) !== (p[3] === 'του') || (!euro && (value === 1) !== (p[5] === 'λεπτού'))) errs.push(`«${part}»: the article doesn't agree with ${value}`);
      if (!(note ? euro && NOTES.includes(value) : (euro ? EURO_COINS : CENT_COINS).includes(value))) errs.push(`«${part}»: there is no such ${note ? 'note' : 'coin'}`);
      if (euro !== (m[2] === 'ευρώ')) errs.push(`«${part}»: euros and cents mixed`);
      total += count * value;
    }
    return [...errs, ...byValue(ex, total)];
  },
  multiple(ex) {
    if (ex.type !== 'multiple-choice') return ['multiple is a multiple choice'];
    const m = read(ex.question, new RegExp(`^Κύκλωσε τον αριθμό που είναι (πολλαπλάσιο|διαιρέτης) του ${N}\\.$`));
    const n = toNumber(m[2]);
    return one(ex.options, o => (m[1] === 'πολλαπλάσιο' ? toNumber(o) % n === 0 : n % toNumber(o) === 0), ex.correctIndex);
  },
  lcm(ex) {
    const m = read(question(ex), new RegExp(`^Βρες το Ε\\.Κ\\.Π\\. των ((?:${NUMG}, )*${NUMG}) και ${N}\\.$`));
    const xs = [...m[1].split(', '), m[2]].map(toNumber);
    let v = 1;
    while (xs.some(x => v % x !== 0)) v++;
    return byValue(ex, v);
  },
  divisible(ex) {
    if (ex.type === 'true-false') {
      const [, n, d] = read(ex.question, new RegExp(`^Το ${N} διαιρείται με το ${N}\\.$`)).map(toNumber);
      return ex.correctValue === (n % d === 0) ? [] : [`key ${ex.correctValue}, solved ${n % d === 0}`];
    }
    if (ex.type !== 'multiple-choice') return ['divisible is a true-false or a multiple choice'];
    const d = toNumber(read(ex.question, new RegExp(`^Κύκλωσε τον αριθμό που διαιρείται με το ${N}\\.$`))[1]);
    return one(ex.options, o => toNumber(o) % d === 0, ex.correctIndex);
  },
};

// ---------------------------------------------------------------------------
// What the screens show: every text of an item, and the line «Δείξε μου» reveals
// (the same as frontend/src/components/exercises/answerText.ts)

function texts(ex: Plain): [string, string][] {
  const out: [string, string][] = [['title', ex.title]];
  if (ex.body) out.push(['body', ex.body]);
  if ('question' in ex) out.push(['question', ex.question]);
  if (ex.type === 'multiple-choice') ex.options.forEach((o, i) => out.push([`option ${i}`, o]));
  if (ex.type === 'fill-blank') { out.push(['text', ex.textWithGaps]); ex.options.forEach((o, i) => out.push([`option ${i}`, o])); }
  if (ex.type === 'match-pairs') ex.pairs.forEach((p, i) => out.push([`pair ${i} left`, p.left], [`pair ${i} right`, p.right]));
  if (ex.type === 'ordering') ex.items.forEach((it, i) => out.push([`item ${i}`, it.content]));
  return out;
}

// What «Η σωστή απάντηση: …» shows, as frontend/src/components/exercises/answerText.ts writes it (#72): a
// no-break space before every «→», a match one pair per line.
export function revealed(ex: Plain): string {
  switch (ex.type) {
    case 'multiple-choice': return ex.options[ex.correctIndex];
    case 'true-false': return ex.correctValue ? 'Σωστό' : 'Λάθος';
    case 'number-input': return ex.correctValue.toLocaleString('el-GR');
    case 'fill-blank': return ex.textWithGaps.replace(/\{(\d+)\}/g, (_, i) => ex.correctAnswers[Number(i)] ?? '…');
    case 'ordering': return ex.items.map(i => i.content).join('\u00a0→ ');
    case 'match-pairs': return ex.pairs.map(p => `${p.left}\u00a0→ ${p.right}`).join('\n');
  }
}
/**
 * What «Η σωστή απάντηση: …» may show. Since #72 the card holds the answer until «Εντάξει» (no reading
 * timer), on «Δείξε μου» (forgiving) and after the last try (unforgiving), and a match is one pair per line.
 * The caps are measured on that card (`.feedback-overlay.answer` in frontend AssignmentPlayer.tsx) with
 * tools/evidence/scenarios/reveal-fit.mjs, which puts test answers into its answer span: a change to the
 * card's font, padding or width means measuring again. What it found:
 * - 1280×800: 40 px, about 31 characters of words a line, 6 lines before the card scrolls;
 * - 800×480: 24 px, about 52 a line, 4 lines;
 * - 390×844: 24 px, about 22 a line, 13 lines.
 * A run of answers (anything but a match) at 120 characters takes at most 5 lines at 1280×800, 3 at 800×480
 * and 8 at 390×844, even in long words, so nothing scrolls and «Εντάξει» stays in sight. An ordering's items
 * have no spaces (a no-break space before every «→»), so it breaks only between them.
 */
export const REVEAL_MAX = 120;
/**
 * A match's line, «a → b»: 22 characters fit on one line at 390×844, the narrowest of the three, so a pair
 * never wraps. Numbers in words don't fit: «εξακόσια σαράντα εννιά → 649» (28) takes two lines there, and
 * «δύο εκατομμύρια δύο χιλιάδες → 2.002.000» (40) at 1280×800 too.
 */
export const REVEAL_PAIR_MAX = 21;
/**
 * A match's pairs: the held card shows 4 lines at 800×480 before it scrolls. That is the card's limit; the
 * match screen's own is tighter: at 800×480 three rows already put «Έλεγχος Ζευγαριών» half off the
 * screen, so the families ask for 3 (g3.ts tables-match-a, -b).
 */
export const REVEAL_PAIRS = 4;

/** Why «Δείξε μου» would not fit the held card, or null when it fits. */
export function revealTooLong(ex: Plain): string | null {
  const shown = revealed(ex);
  if (ex.type === 'match-pairs') {
    if (ex.pairs.length > REVEAL_PAIRS) return `«Δείξε μου» would show ${ex.pairs.length} pairs: the card shows ${REVEAL_PAIRS} at most`;
    const line = shown.split('\n').find(l => l.length > REVEAL_PAIR_MAX);
    return line ? `«Δείξε μου» line «${line}» is ${line.length} characters: a pair keeps to ${REVEAL_PAIR_MAX}, one line on a phone` : null;
  }
  return shown.length > REVEAL_MAX ? `«Δείξε μου» would show ${shown.length} characters («${shown}»): keep it to ${REVEAL_MAX} at most` : null;
}

function textErrors(where: string, text: string, grade: Grade): string[] {
  const c = CURRICULUM[grade];
  const errs: string[] = [];
  if (/undefined|NaN|null|\[object|\$\{|\bInfinity\b/.test(text)) errs.push(`${where}: template leftovers in «${text}»`);
  if (/ {2}|^ | $/.test(text)) errs.push(`${where}: stray spaces in «${text}»`);
  if (/ [,.;·!]/.test(text)) errs.push(`${where}: space before punctuation in «${text}»`);
  if (/÷|\d\s*[xX*]\s*\d|\d\s*\/\s*\d|\d -|- \d/.test(text)) errs.push(`${where}: «${text}» writes ÷, x, * , / or - where the books write :, × and −`);
  if (/\d,\d/.test(text)) errs.push(`${where}: «${text}» has a decimal`);
  if (/\d{4,}/.test(text)) errs.push(`${where}: «${text}» writes a number without its dots (1.229)`);
  for (const n of text.match(new RegExp(NUM, 'g')) ?? []) {
    if (toNumber(n) > c.maxNumber) errs.push(`${where}: ${n} is past the ${c.label} range (${c.maxNumber.toLocaleString('el-GR')})`);
  }
  if (c.maxTable) {
    for (const m of text.matchAll(new RegExp(`${N} ([×:]) ${N}`, 'g'))) {
      const [a, b] = [toNumber(m[1]), toNumber(m[3])];
      if (m[2] === '×' && Math.min(a, b) > c.maxTable) errs.push(`${where}: ${m[0]} is past the ${c.label} tables`);
      if (m[2] === ':' && b > c.maxTable) errs.push(`${where}: ${m[0]} divides past the ${c.label} tables`);
    }
  }
  for (const w of genderedWords(text)) errs.push(`${where}: «${text}» says «${w}»: say it the same way to every child`);
  return errs;
}

// ---------------------------------------------------------------------------

export interface MathsAudit {
  errors: string[];
  warnings: string[];
  report: string[];
}

/** The generated maths items of these pools: the ones in Μαθηματικά with a skill (language/check.ts audits the Γλώσσα ones). */
export const generated = (pools: Pool[]) => pools.flatMap(p => p.exercises.map(ex => ({ pool: p, ex })))
  .filter((x): x is { pool: Pool; ex: Plain } => x.ex.type !== 'problem' && x.ex.category === 'Μαθηματικά' && typeof x.ex.generatorParams?.skill === 'string');

export function auditMaths(pools: Pool[]): MathsAudit {
  const errors: string[] = [], warnings: string[] = [], report: string[] = [];
  const allIds = new Map<string, number>();
  for (const p of pools) for (const ex of p.exercises) allIds.set(ex.id, (allIds.get(ex.id) ?? 0) + 1);
  const items = generated(pools);
  const questions = new Set<string>();

  for (const grade of Object.keys(CURRICULUM).map(Number) as Grade[]) {
    const mine = items.filter(x => x.pool.grades.includes(grade));
    if (!mine.length) continue;
    const c = CURRICULUM[grade];
    const families = new Map<string, { n: number; answers: Set<string>; type: Set<string>; chapter: string }>();
    const types = new Map<string, number>();
    let trues = 0;

    for (const { pool, ex } of mine) {
      const err = (msg: string) => errors.push(`${ex.id}: ${msg}`);
      if (pool.grades.length !== 1) err(`its pool ${pool.file} is for grades ${pool.grades.join(', ')}: one grade per maths pool`);
      const fam = String(ex.generatorParams.family ?? '');
      // Who it is
      if ((allIds.get(ex.id) ?? 0) > 1) err('duplicate id');
      if (!new RegExp(`^${PREFIX[grade]}-math-${fam.replace(/[-]/g, '\\-')}-\\d{3}$`).test(ex.id)) err(`id is not ${PREFIX[grade]}-math-${fam}-NNN`);
      if (ex.id.includes('-gen-')) err('«-gen-» in the id (the evidence helpers read it as a problem)');
      if (ex.stars !== 1) err(`⭐${ex.stars}: a maths item pays ⭐1`);
      const chapter = ex.source ? chapterOf(grade, ex.source) : undefined;
      if (!chapter) err(`source «${ex.source ?? ''}» is not a chapter of the ${c.label} book (curriculum.ts)`);
      else {
        if (!c.units.includes(chapter.unit)) err(`source «${ex.source}» is in unit ${chapter.unit}, past units ${c.units.join(', ')}`);
        if (ex.generatorParams.unit !== chapter.unit) err(`generatorParams.unit ${ex.generatorParams.unit}, the chapter is in unit ${chapter.unit}`);
      }

      // What it shows
      for (const [where, text] of texts(ex)) errors.push(...textErrors(where, text, grade).map(e => `${ex.id}: ${e}`));
      if (!/^[Α-ΩΆΈΉΊΌΎΏ]/.test(ex.title)) err('title does not start with a capital');
      const ask = ex.type === 'match-pairs' || ex.type === 'ordering' || ex.type === 'fill-blank' ? ex.body ?? '' : question(ex);
      if (!/^[Α-ΩΆΈΉΊΌΎΏ\d(]/.test(ask)) err(`«${ask}» does not start with a capital`);
      if (!/[.;;…]$/.test(ask)) err(`«${ask}» does not end with punctuation`);
      const key = JSON.stringify([ask, 'textWithGaps' in ex ? ex.textWithGaps : '', ex.type === 'match-pairs' ? ex.pairs : '',
        ex.type === 'ordering' ? ex.items.map(i => i.content).sort() : '', 'options' in ex ? [...ex.options].sort() : '']);
      if (questions.has(key)) err('the same item as another one');
      questions.add(key);

      // How it is answered
      types.set(ex.type, (types.get(ex.type) ?? 0) + 1);
      if (ex.type === 'number-input' && !(Number.isInteger(ex.correctValue) && ex.correctValue >= 0 && ex.correctValue < 10_000)) {
        err(`answer ${ex.correctValue}: a number-input answer is a whole number below 10.000 (no digit grouping on the numpad); make it a multiple choice`);
      }
      if (ex.type === 'number-input' && ex.correctValue > c.maxNumber) err(`answer ${ex.correctValue} is past the ${c.label} range (${c.maxNumber.toLocaleString('el-GR')})`);
      if (ex.type === 'true-false' && ex.correctValue) trues++;
      const choice = ex.type === 'multiple-choice' ? { options: ex.options, right: ex.options[ex.correctIndex] }
        : ex.type === 'fill-blank' ? { options: ex.options, right: ex.correctAnswers[0] } : undefined;
      if (choice) {
        const { options, right } = choice;
        if (new Set(options.map(o => o.trim())).size !== options.length) err(`repeated options ${JSON.stringify(options)}`);
        if (options.length < (ex.type === 'fill-blank' ? 3 : 2) || options.length > 5) err(`${options.length} options`);
        if (right === undefined || !options.includes(right)) err('the key is not one of the options');
        else if (options.every(o => o === right || o.length < right.length)) err(`the right option «${right}» is the only longest one: it gives itself away`);
        if (right !== undefined && isNumber(right)) {
          const r = toNumber(right);
          for (const o of options) {
            if (o === right) continue;
            if (!isNumber(o)) { err(`option «${o}» is not a number like the right one`); continue; }
            const v = toNumber(o);
            if (v > 0 && r > 0 && (v > r * 100 || v * 100 < r)) err(`option «${o}» is over 100 times off «${right}»: not a plausible mistake`);
          }
        }
      }
      if (ex.type === 'fill-blank' && ((ex.textWithGaps.match(/\{\d+\}/g) ?? []).length !== 1 || !ex.textWithGaps.includes('{0}') || ex.correctAnswers.length !== 1)) {
        err('a maths fill-blank has exactly one gap, {0} (the screen submits on the last gap, #50)');
      }
      if (ex.type === 'match-pairs') {
        if (new Set(ex.pairs.map(p => p.left)).size !== ex.pairs.length || new Set(ex.pairs.map(p => p.right)).size !== ex.pairs.length) err('repeated pairs');
        if (ex.pairs.length < 3 || ex.pairs.length > 5) err(`${ex.pairs.length} pairs`);
      }
      if (ex.type === 'ordering' && (new Set(ex.items.map(i => i.content)).size !== ex.items.length || ex.items.length < 3)) err('repeated or too few items');
      const shown = revealed(ex);
      const tooLong = revealTooLong(ex);
      if (tooLong) err(tooLong);

      // Solved again from its text
      const solve = SOLVERS[ex.generatorParams.skill];
      if (!solve) err(`no solver for skill «${ex.generatorParams.skill}»`);
      else {
        try {
          for (const e of solve(ex)) err(e);
        } catch (e) {
          err((e as Error).message);
        }
      }

      const f = families.get(fam) ?? { n: 0, answers: new Set<string>(), type: new Set<string>(), chapter: chapter?.ch ?? '?' };
      f.n++;
      f.answers.add(shown);
      f.type.add(ex.type);
      families.set(fam, f);
    }

    // The grade's set
    const total = mine.length;
    const tfs = types.get('true-false') ?? 0, fills = types.get('fill-blank') ?? 0;
    if (total < MIN_ITEMS) errors.push(`grade ${grade}: ${total} maths items, fewer than ${MIN_ITEMS}`);
    if (tfs > total / 10) errors.push(`grade ${grade}: ${tfs} true-false items, over 10 % of ${total}`);
    if (fills > total / 10) errors.push(`grade ${grade}: ${fills} fill-blank items, over 10 % of ${total}`);
    if (tfs && (trues / tfs < 0.4 || trues / tfs > 0.6)) errors.push(`grade ${grade}: ${trues} of ${tfs} true-false items are «Σωστό», outside 40–60 %`);
    for (const [id, f] of families) {
      if (f.n < 3) warnings.push(`maths ${grade}:${id}: only ${f.n} items`);
      if (!f.type.has('true-false') && f.answers.size < f.n / 2) warnings.push(`maths ${grade}:${id}: ${f.n} items share ${f.answers.size} answers`);
    }
    report.push(`\nGrade ${grade} maths: ${total} items in ${families.size} families; ${[...types].map(([t, n]) => `${t} ${n}`).join(', ')}; true-false «Σωστό» ${trues}/${tfs}`);
    for (const [id, f] of families) report.push(`  ${id.padEnd(22)} ${String(f.n).padStart(3)} items  κεφ. ${f.chapter.padEnd(5)} ${[...f.type].join(', ')}`);
  }
  return { errors, warnings, report };
}

/** n random items per grade as she sees them, with the right answer, for reading. */
export function mathsSample(pools: Pool[], r: Rng, n: number): string {
  let md = '\n# Plain maths to read\n';
  for (const grade of Object.keys(CURRICULUM).map(Number) as Grade[]) {
    const all = generated(pools).filter(x => x.pool.grades.includes(grade)).map(x => x.ex);
    if (!all.length) continue;
    md += `\n## Grade ${grade} (${Math.min(n, all.length)} of ${all.length})\n`;
    for (const ex of r.sample(all, n)) {
      md += `\n- **${ex.title}** · ${ex.id} · ${ex.type} · ${ex.source}\n`;
      if (ex.body) md += `  - ${ex.body}\n`;
      if ('question' in ex) md += `  - ${ex.question}\n`;
      if (ex.type === 'multiple-choice') md += `  - ${ex.options.map((o, i) => (i === ex.correctIndex ? `**${o}**` : o)).join(' · ')}\n`;
      if (ex.type === 'fill-blank') md += `  - ${ex.textWithGaps} · ${ex.options.join(' · ')}\n`;
      md += `  - ✔ ${revealed(ex).replace(/\n/g, '\n    ')}\n`;
    }
  }
  return md;
}
