// A prototype: problems from a small world model instead of from story templates.
//
// A world is a set of quantities and the relations between them (out = a op b). The
// story states some quantities, the question asks for one; which facts are needed is
// then not written by hand but computed: the stated quantities the solver uses to reach
// the sought one. The same world asks different questions, so the same sentence is
// needed in one problem and extra in the next, and nothing in the wording tells.
//
// Sentences are built from pieces that remember which quantity they state, so the
// generator also knows, word by word, where each fact is in the text (for painting it
// freehand), and the solver can say what any calculation a child makes means.

import type { ProblemStep } from '../../../shared/types.ts';
import { plainStory } from '../../../shared/problems.ts';
import { builder, cap, fmt, people, READ_PROMPT_G3, the, thing, type Person, type Rng, type Thing } from '../lib.ts';

export type Op = '+' | '−' | '×' | ':';

export interface Quantity {
  id: string;
  value: number;
  /** A name for a number row or for what a child's calculation found: "Αυτοκόλλητα τώρα". */
  label: string;
  unit: Thing;
}

/** out = a op b, usable in any direction: from any two, the third. */
export interface Relation { out: string; op: Op; a: string; b: string }

/** Text, or the words stating a quantity (core: the words a painting must cover). */
export type Piece = string | { q: string; text: string; core?: string };
export interface Sentence {
  /** The words, given the subject (or '' when the previous sentence had the same one). */
  say: (subj: string) => Piece[];
  subj?: Person;
  states: string[];
  /** Position in the story's time line. */
  at: number;
}

export interface World {
  qs: Map<string, Quantity>;
  rels: Relation[];
  /** Sentences stating quantities, chosen by what is stated. */
  sentences: (stated: Set<string>) => Sentence[];
  /** Questions: the ones the world can ask, with the words asking. */
  asks: Map<string, (subj: string) => string>;
  /** Who the questions are about (for leaving the name out). */
  hero: Person;
  title: string;
  /** Quantities that are stated unless asked (the inputs of the world). */
  base: string[];
  /** Asked for q, also state these (e.g. the end amount when the start is asked). */
  alsoState: (q: string) => string[];
}

// ---------------------------------------------------------------------------
// Solving

export interface Derivation { target: string; op: Op; x: string; y: string }

const inverse = (rel: Relation, target: 'out' | 'a' | 'b'): Derivation => {
  const { out, op, a, b } = rel;
  if (target === 'out') return { target: out, op, x: a, y: b };
  if (target === 'a') {
    const iop: Op = op === '+' ? '−' : op === '−' ? '+' : op === '×' ? ':' : '×';
    return { target: a, op: iop, x: out, y: b };
  }
  // b: out = a + b → b = out − a; out = a − b → b = a − out; × → out : a; : → a : out
  if (op === '+') return { target: b, op: '−', x: out, y: a };
  if (op === '−') return { target: b, op: '−', x: a, y: out };
  if (op === '×') return { target: b, op: ':', x: out, y: a };
  return { target: b, op: ':', x: a, y: out };
};

export const apply = (op: Op, x: number, y: number) =>
  op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y;

/** Everything the stated quantities give, and how (the first way found). */
export function solve(w: World, stated: Set<string>) {
  const how = new Map<string, Derivation>();
  const known = new Set(stated);
  for (let changed = true; changed;) {
    changed = false;
    for (const rel of w.rels) {
      const missing = (['out', 'a', 'b'] as const).filter(k => !known.has(rel[k]));
      if (missing.length !== 1) continue;
      const d = inverse(rel, missing[0]);
      known.add(d.target);
      how.set(d.target, d);
      changed = true;
      break; // from the first relation again: the book's way, in the story's order
    }
  }
  return { known, how };
}

/** The steps from the stated quantities to q, in order, and the stated ones they use. */
export function chain(how: Map<string, Derivation>, q: string) {
  const steps: Derivation[] = [];
  const used = new Set<string>();
  const walk = (id: string) => {
    const d = how.get(id);
    if (!d) { used.add(id); return; }
    walk(d.x); walk(d.y);
    if (!steps.includes(d)) steps.push(d);
  };
  walk(q);
  return { steps, used };
}

/**
 * What a child's calculation means in this world: x op y with numbers she took from
 * the story or found before. The quantity it finds, or null when it means nothing here.
 */
export function meaning(w: World, x: number, op: Op, y: number): Quantity | null {
  const v = apply(op, x, y);
  for (const rel of w.rels) {
    for (const t of ['out', 'a', 'b'] as const) {
      const d = inverse(rel, t);
      const [dx, dy] = [w.qs.get(d.x)!.value, w.qs.get(d.y)!.value];
      const same = d.op === op && ((dx === x && dy === y) || ((op === '+' || op === '×') && dx === y && dy === x));
      if (same && w.qs.get(d.target)!.value === v) return w.qs.get(d.target)!;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Greek: numbers in words (2–12), for counts the books write in words

const WORDS: Record<number, [string, string, string]> = {
  2: ['δύο', 'δύο', 'δύο'], 3: ['τρεις', 'τρεις', 'τρία'], 4: ['τέσσερις', 'τέσσερις', 'τέσσερα'],
  5: ['πέντε', 'πέντε', 'πέντε'], 6: ['έξι', 'έξι', 'έξι'], 7: ['επτά', 'επτά', 'επτά'], 8: ['οκτώ', 'οκτώ', 'οκτώ'],
  9: ['εννέα', 'εννέα', 'εννέα'], 10: ['δέκα', 'δέκα', 'δέκα'], 12: ['δώδεκα', 'δώδεκα', 'δώδεκα'],
};
const g3 = (t: Thing) => (t.g === 'm' ? 0 : t.g === 'f' ? 1 : 2);
export const inWords = (n: number, t: Thing) => WORDS[n]?.[g3(t)];

const EURO = thing('ευρώ', 'ευρώ', 'n');
const WEEK = thing('εβδομάδα', 'εβδομάδες', 'f');

interface Coll { t: Thing; where: string; Where: string; box: Thing; boxWhere: string }
const COLLECTIONS: Coll[] = [
  { t: thing('αυτοκόλλητο', 'αυτοκόλλητα', 'n'), where: 'στο άλμπουμ', Where: 'Στο άλμπουμ', box: thing('φακελάκι', 'φακελάκια', 'n'), boxWhere: 'στα φακελάκια' },
  { t: thing('κάρτα', 'κάρτες', 'f'), where: 'στη συλλογή', Where: 'Στη συλλογή', box: thing('πακέτο', 'πακέτα', 'n'), boxWhere: 'στα πακέτα' },
  { t: thing('βόλος', 'βόλοι', 'm', 'βόλους'), where: 'στη σακουλίτσα', Where: 'Στη σακουλίτσα', box: thing('σακουλάκι', 'σακουλάκια', 'n'), boxWhere: 'στα σακουλάκια' },
  { t: thing('χάντρα', 'χάντρες', 'f'), where: 'στο κουτάκι', Where: 'Στο κουτάκι', box: thing('σακουλάκι', 'σακουλάκια', 'n'), boxWhere: 'στα σακουλάκια' },
  { t: thing('γραμματόσημο', 'γραμματόσημα', 'n'), where: 'στο άλμπουμ', Where: 'Στο άλμπουμ', box: thing('φάκελος', 'φάκελοι', 'm', 'φακέλους'), boxWhere: 'στους φακέλους' },
];

const ITEMS = [
  ['ένα παζλ', 'το παζλ', 'του παζλ'], ['μια μπάλα', 'η μπάλα', 'της μπάλας'], ['ένα βιβλίο με παραμύθια', 'το βιβλίο', 'του βιβλίου'],
  ['μια κασετίνα', 'η κασετίνα', 'της κασετίνας'], ['ένα επιτραπέζιο', 'το επιτραπέζιο', 'του επιτραπέζιου'],
  ['ένα σακίδιο', 'το σακίδιο', 'του σακιδίου'], ['μια κούκλα', 'η κούκλα', 'της κούκλας'], ['ένα αυτοκινητάκι', 'το αυτοκινητάκι', 'του αυτοκινήτου'],
];
const RELATIVES = [['τη γιαγιά', 'η γιαγιά'], ['τον παππού', 'ο παππούς'], ['τη νονά', 'η νονά'], ['τον θείο', 'ο θείος']];
// with the possessive after them: «στον ξάδερφό του» (enclitic accent)
const SIBLINGS = [['τον αδερφό', 'τον αδερφό'], ['την αδερφή', 'την αδερφή'], ['τον ξάδερφο', 'τον ξάδερφό'], ['την ξαδέρφη', 'την ξαδέρφη']];

const adj = (t: Thing, stem: string) => `${stem}${t.g === 'n' ? 'α' : t.g === 'f' ? 'ες' : 'ους'}`;
const pos = (t: Thing) => (t.g === 'n' ? 'πόσα' : t.g === 'f' ? 'πόσες' : 'πόσους');
const posNom = (t: Thing) => (t.g === 'n' ? 'πόσα' : t.g === 'f' ? 'πόσες' : 'πόσοι');

// ---------------------------------------------------------------------------
// The world of a stock that changes: a child's money or collection, one or two
// events, and maybe a friend who has more, or less, or twice as many.

export function stockWorld(r: Rng): World | null {
  const [P, F, R, Z] = people(r, 4);
  const money = r.chance(0.45);
  const coll = r.pick(COLLECTIONS);
  const T = money ? EURO : coll.t;
  const qs = new Map<string, Quantity>();
  const rels: Relation[] = [];
  const add = (id: string, value: number, label: string, unit = T) => {
    if (!Number.isInteger(value) || value <= 0) throw new Bad();
    qs.set(id, { id, value, label, unit });
  };
  const n = (id: string, acc = true, words = r.chance(0.3)) => {
    const q = qs.get(id)!;
    const w = words ? inWords(q.value, q.unit) : undefined;
    const noun = q.value === 1 ? q.unit.one : acc ? q.unit.manyAcc : q.unit.many;
    return { q: id, text: `${w ?? fmt(q.value)} ${noun}`, core: w ?? fmt(q.value) };
  };
  const cl = P.his; // "της" as an indirect object: "της χάρισε"
  const Things = cap(T.many);
  const sentences: ((stated: Set<string>) => Sentence | null)[] = [];
  const asks = new Map<string, (subj: string) => string>();
  const say = (s: string) => (s ? `${s} ` : '');
  // The friend in a gift has a collection too, changed by the same gift
  const friendStock = (e: string, op: Op, at: number) => {
    if (qs.has('g0') || !r.chance(0.45)) return;
    add('g0', r.int(15, 90), `${Things} ${F.gen} στην αρχή`);
    add('g1', apply(op, qs.get('g0')!.value, qs.get(e)!.value), `${Things} ${F.gen} τώρα`);
    rels.push({ out: 'g1', op, a: 'g0', b: e });
    sentences.push(st => st.has('g0') ? { at: at - 0.5, subj: F, states: ['g0'], say: () => [`${F.Nom} είχε `, n('g0'), '.'] } : null);
    sentences.push(st => st.has('g1') ? { at: at + 0.3, subj: F, states: ['g1'], say: () => [`Τώρα ${F.nom} έχει `, n('g1'), '.'] } : null);
    asks.set('g1', () => `${pos(T)} ${T.manyAcc} έχει τώρα ${F.nom}`);
    asks.set('g0', () => `${pos(T)} ${T.manyAcc} είχε ${F.nom} στην αρχή`);
  };

  try {
    add('s0', money ? r.int(15, 90) : r.int(12, 95), `${Things} ${P.gen} στην αρχή`);
    sentences.push(st => st.has('s0') ? {
      at: 0, subj: P, states: ['s0'],
      say: money
        ? r.pick([
          (S: string) => [say(S), 'είχε ', n('s0'), ` στον κουμπαρά ${P.his}.`],
          () => [`Στον κουμπαρά ${P.gen} υπήρχαν `, n('s0', false), '.'],
        ])
        : r.pick([
          (S: string) => [say(S), 'είχε ', n('s0'), ` ${coll.where} ${P.his}.`],
          () => [`${coll.Where} ${P.gen} υπήρχαν `, n('s0', false), '.'],
        ]),
    } : null);
    asks.set('s0', S => `${pos(T)} ${T.manyAcc} είχε ${S ? `${S} ` : ''}στην αρχή`);

    // One or two events, each changing the stock
    const kinds = money ? ['buy', 'gift', 'give', 'save'] : ['gift', 'give', 'packs', 'lose'];
    const events = r.sample(kinds, r.chance(0.55) ? 2 : 1);
    let cur = 's0';
    const afters: string[] = [];
    events.forEach((kind, i) => {
      const e = `e${i + 1}`, next = `s${i + 1}`, at = i + 1;
      const have = qs.get(cur)!.value;
      let op: Op = '+', after = '';
      if (kind === 'buy') {
        const [a, the, of] = r.pick(ITEMS);
        add(e, r.int(5, Math.min(60, have - 3)), `Τιμή ${of}`);
        op = '−'; after = `${Things} μετά την αγορά`;
        const form = r.int(0, 1);
        sentences.push(st => st.has(e) ? {
          at, subj: P, states: [e],
          say: S => form ? [say(S), `αγόρασε ${a} που κόστιζε `, n(e), '.'] : [say(S), 'ξόδεψε ', n(e), ` για ${a}.`],
        } : { at, subj: P, states: [], say: S => [say(S), `αγόρασε ${a}.`] });
        asks.set(e, () => `πόσο κόστιζε ${the}`);
      } else if (kind === 'gift') {
        if (money) {
          const [acc, nom] = r.pick(RELATIVES);
          add(e, r.step(5, 30, 5), `${Things} από ${acc}`);
          sentences.push(st => st.has(e) ? {
            at, subj: P, states: [e], say: S => [say(S), 'πήρε ', n(e), ` δώρο από ${acc} ${P.his}.`],
          } : { at, subj: P, states: [], say: S => [say(S), `πήρε χρήματα δώρο από ${acc} ${P.his}.`] });
          asks.set(e, () => `${pos(T)} ${T.manyAcc} ${cl} έδωσε ${nom} ${P.his}`);
        } else {
          add(e, r.int(3, 25), `${Things} από ${F.acc}`);
          const form = r.int(0, 1);
          sentences.push(st => st.has(e) ? (form
            ? { at, subj: P, states: [e], say: S => [say(S), 'πήρε ', n(e), ` από ${F.acc}.`] }
            : { at, subj: F, states: [e], say: () => [`${F.Nom} ${cl} χάρισε `, n(e), '.'] })
            : { at, subj: F, states: [], say: () => [`${F.Nom} ${cl} χάρισε μερικ${T.g === 'n' ? 'ά' : T.g === 'f' ? 'ές' : 'ούς'} ${T.manyAcc}.`] });
          asks.set(e, () => `${pos(T)} ${T.manyAcc} ${cl} χάρισε ${F.nom}`);
          friendStock(e, '−', at);
        }
        after = `${Things} μετά το δώρο`;
      } else if (kind === 'give' || kind === 'lose') {
        add(e, r.int(2, Math.max(2, Math.floor(have * 0.6))), kind === 'lose' ? `${Things} που χάθηκαν` : `${Things} που έδωσε`);
        op = '−';
        if (kind === 'lose') {
          sentences.push(st => st.has(e) ? { at, subj: P, states: [e], say: S => [say(S), 'έχασε ', n(e), ' στο διάλειμμα.'] }
            : { at, subj: P, states: [], say: S => [say(S), `έχασε μερικ${T.g === 'n' ? 'ά' : T.g === 'f' ? 'ές' : 'ούς'} στο διάλειμμα.`] });
          asks.set(e, S => `${pos(T)} ${T.manyAcc} έχασε${S ? ` ${S}` : ''}`);
          after = `${Things} αφού έχασε`;
        } else if (money) {
          const sib = r.pick(SIBLINGS)[1];
          sentences.push(st => st.has(e) ? { at, subj: P, states: [e], say: S => [say(S), 'έδωσε ', n(e), ` σ${sib} ${P.his}.`] }
            : { at, subj: P, states: [], say: S => [say(S), `έδωσε χρήματα σ${sib} ${P.his}.`] });
          asks.set(e, S => `${pos(T)} ${T.manyAcc} έδωσε${S ? ` ${S}` : ''} σ${sib} ${P.his}`);
          after = `${Things} αφού έδωσε`;
        } else {
          sentences.push(st => st.has(e) ? { at, subj: P, states: [e], say: S => [say(S), 'χάρισε ', n(e), ` σ${F.acc}.`] }
            : { at, subj: P, states: [], say: S => [say(S), `χάρισε μερικ${T.g === 'n' ? 'ά' : T.g === 'f' ? 'ές' : 'ούς'} σ${F.acc}.`] });
          asks.set(e, S => `${pos(T)} ${T.manyAcc} χάρισε${S ? ` ${S}` : ''} σ${F.acc}`);
          friendStock(e, '+', at);
          after = `${Things} αφού χάρισε`;
        }
      } else {
        // packs or weekly savings: the change itself is count × each
        const box = money ? WEEK : coll.box;
        const k = `${e}n`, each = `${e}m`;
        add(k, r.int(2, money ? 6 : 5), cap(box.many), box);
        add(each, money ? r.int(2, 9) : r.int(3, 10), money ? 'Ευρώ κάθε εβδομάδα' : `${Things} σε κάθε ${box.one}`);
        add(e, qs.get(k)!.value * qs.get(each)!.value, money ? 'Ευρώ που έβαλε συνολικά' : `${Things} ${coll.boxWhere}`);
        rels.push({ out: e, op: '×', a: k, b: each });
        const words = r.chance(0.8);
        sentences.push(st => {
          const sk = st.has(k), sm = st.has(each);
          if (money) {
            if (sk && sm) return { at, subj: P, states: [k, each], say: S => [say(S), `έβαλε στον κουμπαρά `, n(each), ` κάθε εβδομάδα, για `, n(k, true, words), '.'] };
            if (sk) return { at, subj: P, states: [k], say: S => [say(S), `έβαλε στον κουμπαρά τα ίδια χρήματα κάθε εβδομάδα, για `, n(k, true, words), '.'] };
            if (sm) return { at, subj: P, states: [each], say: S => [say(S), `έβαλε στον κουμπαρά `, n(each), ` κάθε εβδομάδα, για μερικές εβδομάδες.`] };
            return st.has(e) ? { at, subj: P, states: [e], say: S => [say(S), 'έβαλε στον κουμπαρά άλλα ', n(e), '.'] } : null;
          }
          if (sk && sm) return { at, subj: P, states: [k, each], say: S => [say(S), 'αγόρασε ', n(k, true, words), ' με ', n(each), ' το καθένα.'] };
          if (sk) return { at, subj: P, states: [k], say: S => [say(S), 'αγόρασε ', n(k, true, words), ` με ${T.manyAcc}, όλα με τον ίδιο αριθμό.`] };
          if (sm) return { at, subj: P, states: [each], say: S => [say(S), `αγόρασε μερικά ${box.manyAcc} με `, n(each), ' το καθένα.'] };
          return st.has(e) ? { at, subj: P, states: [e], say: S => [say(S), 'αγόρασε άλλα ', n(e), '.'] } : null;
        });
        if (money) {
          asks.set(k, S => `για πόσες εβδομάδες έβαλε χρήματα${S ? ` ${S}` : ''}`);
          asks.set(each, S => `πόσα ευρώ έβαλε${S ? ` ${S}` : ''} κάθε εβδομάδα`);
          asks.set(e, S => `πόσα ευρώ έβαλε${S ? ` ${S}` : ''} στον κουμπαρά όλες αυτές τις εβδομάδες`);
        } else {
          asks.set(k, S => `${pos(box)} ${box.manyAcc} αγόρασε${S ? ` ${S}` : ''}`);
          asks.set(each, () => `${pos(T)} ${T.manyAcc} είχε κάθε ${box.one}`);
          asks.set(e, S => `${posNom(T)} ${T.many} ήταν ${coll.boxWhere} που αγόρασε${S ? ` ${S}` : ''}`);
        }
        after = money ? 'Ευρώ μετά τις εβδομάδες' : `${Things} μετά ${the(box)} ${box.manyAcc}`;
      }
      afters.push(after);
      add(next, apply(op, have, qs.get(e)!.value), after);
      rels.push({ out: next, op, a: cur, b: e });
      cur = next;
    });
    const last = cur, k = events.length;
    // Two changes can also be taken the other way round (71 + 24 = 95 with the savings
    // first, 95 − 88 = 7 given away), and two the same way together (50 − 36 = 14 left
    // in all, 14 − 9 = 5 lost): quantities of their own, so those ways read back too
    const ops = rels.filter(rel => /^s\d$/.test(rel.out)).map(rel => rel.op);
    if (k === 2) {
      const [e1, e2] = ['e1', 'e2'];
      const alt = apply(ops[1], qs.get('s0')!.value, qs.get(e2)!.value);
      if (alt > 0) {
        add('alt', alt, afters[1]);
        rels.push({ out: 'alt', op: ops[1], a: 's0', b: e2 }, { out: last, op: ops[0], a: 'alt', b: e1 });
      }
      if (ops[0] === ops[1]) {
        add('net', qs.get(e1)!.value + qs.get(e2)!.value, ops[0] === '−' ? `${Things} που έφυγαν συνολικά` : `${Things} που ήρθαν συνολικά`);
        rels.push({ out: 'net', op: '+', a: e1, b: e2 }, { out: last, op: ops[0], a: 's0', b: 'net' });
      }
    }
    if (qs.get(last)!.value > (money ? 150 : 200)) return null;
    sentences.push(st => st.has(last) ? {
      at: k + 0.5, subj: P, states: [last],
      say: S => (S ? [`Τώρα ${P.nom} έχει `, n(last), '.'] : [`Τώρα έχει `, n(last), '.']),
    } : null);
    asks.set(last, S => `${pos(T)} ${T.manyAcc} έχει τώρα${S ? ` ${S}` : ''}`);

    // After the first of two events, sometimes the story says what she had then:
    // everything before it stops mattering for what comes after.
    if (k === 2 && r.chance(0.2)) {
      sentences.push(st => st.has('s1') ? { at: 1.5, subj: P, states: ['s1'], say: () => ['Τότε είχε ', n('s1'), '.'] } : null);
    }

    // A friend compared with her now: more, fewer, twice as many, half
    if (r.chance(0.4)) {
      const how = r.pick(['more', 'fewer', 'double', 'half'] as const);
      const now = qs.get(last)!.value;
      if (how === 'more' || how === 'fewer') {
        add('d', r.int(2, Math.max(2, Math.floor(now * 0.5))), `Διαφορά`);
        add('f', how === 'more' ? now + qs.get('d')!.value : now - qs.get('d')!.value, `${Things} ${R.gen}`);
        rels.push(how === 'more' ? { out: 'f', op: '+', a: last, b: 'd' } : { out: 'f', op: '−', a: last, b: 'd' });
        const word = adj(T, how === 'more' ? 'περισσότερ' : 'λιγότερ');
        sentences.push(st => st.has('d') ? {
          at: k + 1, subj: R, states: ['d'],
          say: () => [`${R.Nom} έχει `, { q: 'd', text: `${fmt(qs.get('d')!.value)} ${word} ${T.manyAcc}`, core: fmt(qs.get('d')!.value) }, ` από ${P.acc}.`],
        } : null);
        asks.set('d', () => `${pos(T)} ${T.manyAcc} ${word} έχει ${R.nom}`);
      } else {
        add('d', 2, how === 'double' ? 'Φορές' : 'Μέρη', thing('φορά', 'φορές', 'f'));
        if (how === 'half' && now % 2) return null;
        add('f', how === 'double' ? now * 2 : now / 2, `${Things} ${R.gen}`);
        rels.push(how === 'double' ? { out: 'f', op: '×', a: last, b: 'd' } : { out: 'f', op: ':', a: last, b: 'd' });
        sentences.push(st => st.has('d') ? {
          at: k + 1, subj: R, states: ['d'],
          say: () => how === 'double'
            ? [`${R.Nom} έχει `, { q: 'd', text: adj(T, 'διπλάσι'), core: adj(T, 'διπλάσι') }, ` ${T.manyAcc} από ${P.acc}.`]
            : [`${R.Nom} έχει `, { q: 'd', text: 'τα μισά', core: 'μισά' }, ` από όσ${T.g === 'n' ? 'α' : T.g === 'f' ? 'ες' : 'ους'} ${T.manyAcc} έχει ${P.nom}.`],
        } : null);
      }
      sentences.push(st => st.has('f') ? { at: k + 1.2, subj: R, states: ['f'], say: () => [`${R.Nom} έχει `, n('f'), '.'] } : null);
      asks.set('f', () => `${pos(T)} ${T.manyAcc} έχει ${R.nom}`);
    }

    // Someone else's stock of the same thing, related to nothing
    if (r.chance(0.5)) {
      add('z', money ? r.int(10, 90) : r.int(10, 95), `${Things} ${Z.gen}`);
      const at = r.pick([0.2, 1.2, k + 0.7]);
      sentences.push(st => st.has('z') ? { at, subj: Z, states: ['z'], say: () => [`${Z.Nom} έχει `, n('z'), '.'] } : null);
    }
    // A fact of another kind, related to nothing
    if (r.chance(0.35)) {
      type Noise = readonly [string, string, number, number];
      const noise: Noise = r.pick<Noise>(money
        ? [['age', 'χρονών', 8, 9], ['shelf', 'παιχνίδια', 15, 60], ['hour', 'το πρωί', 9, 11]] as const
        : [['age', 'χρονών', 8, 9], ['pages', 'σελίδες', 12, 40], ['kids', 'παιδιά', 18, 26]] as const);
      const [kind, word, lo, hi] = noise;
      add('x', r.int(lo, hi), cap(word), thing(word, word, 'n'));
      const v = fmt(qs.get('x')!.value);
      const piece = { q: 'x', text: `${v} ${word}`, core: v };
      const at = r.pick([0.1, 0.6, k + 0.8]);
      sentences.push(st => st.has('x') ? {
        at, subj: kind === 'age' ? P : undefined, states: ['x'],
        say: S => kind === 'age' ? [say(S), 'είναι ', piece, '.']
          : kind === 'shelf' ? ['Στο ράφι του μαγαζιού υπήρχαν ', piece, '.']
            : kind === 'hour' ? ['Το μαγαζί άνοιγε στις ', { q: 'x', text: `${v} το πρωί`, core: v }, '.']
              : kind === 'pages' ? [`Το άλμπουμ ${P.gen} έχει `, piece, '.']
                : [`Στην τάξη ${P.gen} είναι `, piece, '.'],
      } : null);
    }

    const values = [...qs.values()].map(q => q.value);
    if (new Set(values).size < values.length) return null;
    const base = [...qs.keys()].filter(id => !rels.some(rel => rel.out === id));
    return {
      qs, rels, asks, hero: P, base,
      title: money ? r.pick(['Ο κουμπαράς', 'Τα χρήματα', 'Λογαριασμοί']) : r.pick(['Η συλλογή', 'Ανταλλαγές', 'Μετράμε']),
      alsoState: q => (q === 's0' || /^e\d/.test(q) ? [last] : q === 'd' ? ['f'] : q === 'g0' ? ['g1'] : []),
      sentences: st => sentences.map(f => f(st)).filter((s): s is Sentence => !!s),
    };
  } catch (e) {
    if (e instanceof Bad) return null;
    throw e;
  }
}
class Bad extends Error {}

// ---------------------------------------------------------------------------
// A problem from a world: pick the question, state the rest, find what is needed.

export interface Painted { text: string; role?: 'known' | 'sought' | 'extra'; q?: string; core?: string }

export interface Made {
  world: World;
  sought: string;
  stated: Set<string>;
  needed: Set<string>;
  pieces: Painted[];
  story: string;
  steps: ProblemStep[];
  derivation: Derivation[];
}

export function problem(r: Rng, w: World, opts: { calc?: boolean } = {}): Made | null {
  const askable = [...w.asks.keys()];
  const sought = r.pick(askable);
  const stated = new Set(w.base.filter(q => q !== sought));
  if (!solve(w, stated).known.has(sought)) for (const q of w.alsoState(sought)) stated.add(q);
  // A stated intermediate (Τότε είχε…) is kept when there is a sentence for it
  if (w.sentences(new Set(['s1'])).some(s => s.states.includes('s1')) && sought !== 's1' && sought !== 's0') stated.add('s1');
  const { known, how } = solve(w, stated);
  if (!known.has(sought) || stated.has(sought)) return null;
  const { steps: derivation, used } = chain(how, sought);
  // Needed must be the only way: without any needed fact, the answer can't be found
  for (const q of used) {
    const without = new Set(stated); without.delete(q);
    if (solve(w, without).known.has(sought)) return null;
  }
  if (derivation.length > 3) return null;
  // Γ΄: division only within the tables
  for (const d of derivation) {
    if (d.op === ':' && (w.qs.get(d.y)!.value > 10 || w.qs.get(d.target)!.value > 10) && w.qs.get(d.y)!.value !== 2) return null;
  }

  const sents = w.sentences(stated).sort((a, b) => a.at - b.at);
  const where = r.pick(['end', 'end', 'end-imp', 'first', 'wonder'] as const);
  const hero = w.hero;
  const out: Painted[] = [];
  let prev: Person | undefined;
  const push = (ps: Piece[]) => {
    for (const p of ps) {
      if (typeof p === 'string') out.push({ text: p });
      else out.push({ text: p.text, q: p.q, core: p.core, role: used.has(p.q) ? 'known' : 'extra' });
    }
    out.push({ text: ' ' });
  };
  const ask = (subj: string) => w.asks.get(sought)!(subj);
  const soughtPiece = (text: string): Painted => ({ text, role: 'sought', q: sought });
  if (where === 'first') { out.push({ text: 'Θέλουμε να βρούμε ' }, soughtPiece(ask(hero.nom)), { text: '. ' }); }
  sents.forEach((s, i) => {
    // pro-drop: the subject stays out when the sentence before had the same one
    push(s.say(s.subj && s.subj === prev ? '' : (s.subj?.Nom ?? '')));
    prev = s.subj;
    if (where === 'wonder' && i === 0) {
      out.push({ text: prev === hero ? 'Αναρωτιέται ' : `${hero.Nom} αναρωτιέται ` }, soughtPiece(ask('')), { text: '. ' });
      prev = hero;
    }
  });
  if (where === 'end') out.push(soughtPiece(cap(ask(prev === hero ? '' : hero.nom))), { text: ';' });
  if (where === 'end-imp') out.push({ text: 'Να βρεις ' }, soughtPiece(ask(prev === hero ? '' : hero.nom)), { text: '.' });

  // Capitals after full stops, one space between words
  let story = '', plain = '';
  const pieces: Painted[] = [];
  for (const p of out) {
    let text = p.text.replace(/ +/g, ' ');
    const cur = plain;
    if ((cur === '' || /[.;]\s*$/.test(cur)) && /^\s*\S/.test(text)) text = text.replace(/^(\s*)(\S)/, (_, s, c) => s + c.toUpperCase());
    if (cur.endsWith(' ') && text.startsWith(' ')) text = text.slice(1);
    if (!text) continue;
    plain += text;
    pieces.push({ ...p, text });
    story += p.role ? `[${text}|${p.role}]` : text;
  }
  story = story.trim().replace(/ ([.;,])/g, '$1');

  // Steps: paint the story, work it out (her own way, or row by row), check the last calculation
  const b = builder(r, READ_PROMPT_G3);
  const val = (id: string) => w.qs.get(id)!.value;
  const targets = paintTargets(story, pieces);
  const facts = targets.filter(t => t.role === 'known').length;
  const steps: ProblemStep[] = [{
    kind: 'paint', phase: 'read',
    prompt: r.chance(0.5)
      ? `Βρες ${facts === 1 ? 'αυτό που χρειαζόμαστε' : `τα ${facts} που χρειαζόμαστε`} και την ερώτηση.`
      : 'Βάψε ό,τι χρειαζόμαστε και την ερώτηση.',
    hint: 'Διάβασε πρώτα την ερώτηση. Μετά ψάξε ποια από όσα λέει η ιστορία αλλάζουν την απάντηση.',
    targets,
  }];
  if (opts.calc) {
    steps.push({
      kind: 'calc', phase: 'solve', prompt: 'Λύσε το με τον δικό σου τρόπο.',
      hint: 'Διάλεξε δύο αριθμούς που ξέρουμε και μια πράξη. Τι βρίσκεις;',
      quantities: [...w.qs.values()].map(q => ({ id: q.id, value: q.value, label: q.label, unit: q.unit.many })),
      relations: w.rels, given: [...stated], sought,
    });
  } else {
    steps.push(b.numbers('solve', 'Λύνουμε.', derivation.map(d => ({
      label: w.qs.get(d.target)!.label, answer: val(d.target), unit: w.qs.get(d.target)!.unit.many,
    }))));
  }
  // Checking a change in her stock: the answer back in the story, from the start to now
  // («15 − 7 − 5 = 3»), whichever way she worked it out
  const chainRels = w.rels.filter(rel => /^s\d$/.test(rel.out) && /^s\d$/.test(rel.a) && /^e\d$/.test(rel.b));
  const chainIds = new Set(chainRels.flatMap(rel => [rel.out, rel.a, rel.b]));
  const chainStated = [...chainIds].filter(id => stated.has(id));
  if (chainRels.length && chainStated.every(id => used.has(id)) &&
    (chainIds.has(sought) || [...chainIds].some(id => w.asks.has(sought) && sought.startsWith(id)))) {
    const last = chainRels[chainRels.length - 1].out;
    // A change asked by its parts shows them, so the check holds her answer: 37 + (6 × 3) = 55
    const term = (e: string) => (w.qs.has(`${e}n`) && sought.startsWith(e) && sought !== e
      ? `(${fmt(val(`${e}n`))} × ${fmt(val(`${e}m`))})` : fmt(val(e)));
    const terms = chainRels.map(rel => `${rel.op} ${term(rel.b)}`).join(' ');
    const right = `${fmt(val('s0'))} ${terms} = ${fmt(val(last))}`;
    const flip = (op: Op) => (op === '+' ? '−' : '+');
    const flipped = chainRels.map((rel, i) => ({ op: i === 0 ? flip(rel.op) : rel.op, v: val(rel.b), t: term(rel.b) }));
    const flippedValue = flipped.reduce((acc, t) => apply(t.op, acc, t.v), val('s0'));
    const wrongs = [
      ...(flippedValue > 0 ? [`${fmt(val('s0'))} ${flipped.map(t => `${t.op} ${t.t}`).join(' ')} = ${fmt(flippedValue)}`] : []),
      `${fmt(val(last))} ${terms} = ${fmt(chainRels.reduce((acc, rel) => apply(rel.op, acc, val(rel.b)), val(last)))}`,
    ].filter(o => o !== right && !/= [-−]/.test(o));
    if (wrongs.length) {
      steps.push(b.choice('check', 'Πώς ελέγχουμε; Βάλε την απάντηση μέσα στην ιστορία.', right, wrongs));
      return { world: w, sought, stated, needed: used, pieces, story, steps, derivation };
    }
  }
  const lastD = derivation[derivation.length - 1];
  const back: Op = lastD.op === '+' ? '−' : lastD.op === '−' ? '+' : lastD.op === '×' ? ':' : '×';
  const checkRight = `${fmt(val(lastD.target))} ${back} ${fmt(val(lastD.y))} = ${fmt(apply(back, val(lastD.target), val(lastD.y)))}`;
  const wrongChecks = [
    [lastD.op, val(lastD.target), val(lastD.y)],
    [back, val(lastD.x), val(lastD.y)],
  ].map(([op, x, y]) => [op as Op, x as number, y as number, apply(op as Op, x as number, y as number)] as const)
    .filter(([, , , v]) => Number.isInteger(v) && v > 0)
    .map(([op, x, y, v]) => `${fmt(x)} ${op} ${fmt(y)} = ${fmt(v)}`)
    .filter(o => o !== checkRight);
  if (wrongChecks.length) steps.push(b.choice('check', 'Πώς ελέγχουμε;', checkRight, [...new Set(wrongChecks)]));
  return { world: w, sought, stated, needed: used, pieces, story, steps, derivation };
}

// The marked phrases as words of the plain story (as storyWords splits it): the span of
// each, and the words a painting must cover: the number, or «πόσα ευρώ» of the question.
export function paintTargets(story: string, pieces: Painted[]) {
  const plain = plainStory(story);
  const words = [...plain.matchAll(/\S+/g)].map(m => ({ from: m.index!, to: m.index! + m[0].length, w: m[0] }));
  const marked = pieces.filter(p => p.role);
  const out: { role: 'known' | 'sought' | 'extra'; words: number[]; span: [number, number] }[] = [];
  let removed = 0, j = 0;
  for (const m of story.matchAll(/\[([^\]|]+)\|(known|sought|extra)\]/g)) {
    const from = m.index! - removed, to = from + m[1].length;
    removed += m[0].length - m[1].length;
    const inside = words.flatMap((x, i) => (x.to > from && x.from < to ? [i] : []));
    const piece = marked[j++];
    const bare = (i: number) => words[i].w.replace(/[.,;]+$/, '').toLowerCase();
    let core: number[];
    if (m[2] === 'sought') {
      const at = inside.find(i => /^πόσ/.test(bare(i)))!;
      core = [at, at + 1].filter(i => inside.includes(i));
    } else {
      const tokens = (piece.core ?? '').toLowerCase().split(' ');
      core = inside.filter(i => tokens.includes(bare(i)));
    }
    if (!core.length) throw new Error(`no core words in «${m[1]}»`);
    out.push({ role: m[2] as 'known' | 'sought' | 'extra', words: core, span: [inside[0], inside[inside.length - 1]] });
  }
  return out;
}
