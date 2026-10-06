// Checking the two free steps of a problem: painting the story freehand and working
// it out her own way. The server checks with these; the screen uses the same code to
// say what she found as she goes. No runtime imports, so the backend (CommonJS), the
// frontend (Vite) and tools/problem-gen (Node) can all load it.

import type { ProblemExercise, ProblemReading } from './types';

// ---------------------------------------------------------------------------
// The story as words

const MARK = /\[([^\]|]+)\|(known|sought|extra)\]/g;

/** The story without its marks: what she reads. */
export const plainStory = (story: string) => story.replace(MARK, '$1');

/** The words she paints, in order (punctuation stays on its word). */
export const storyWords = (story: string) => plainStory(story).split(/\s+/).filter(Boolean);

// ---------------------------------------------------------------------------
// Painting freehand

export interface PaintTarget {
  role: 'known' | 'sought' | 'extra';
  /** The words a painting must cover: the number («25», «τρία», «διπλάσια»), or «πόσα ευρώ». */
  words: number[];
  /** First and last word of the whole phrase. */
  span: [number, number];
  /** How many of `words` must be painted (all when absent): a fact without a number
   * («θα έχουν τον ίδιο αριθμό») is found by any two of its words. */
  need?: number;
}

export interface Painting { known: number[]; sought: number[]; extra?: number[] }

// Words that carry a fact without digits: numbers in words, «διπλάσια», «τα μισά»
const FACT_WORD = /^(δύο|τρία|τρεις|τέσσερα|τέσσερις|πέντε|έξι|επτά|εφτά|οκτώ|οχτώ|εννέα|εννιά|δέκα|έντεκα|δώδεκα|είκοσι|τριάντα|σαράντα|πενήντα|εκατό|διπλάσι\S*|τριπλάσι\S*|τετραπλάσι\S*|μισ\S*|ζευγάρι\S*|ντουζίν\S*|δωδεκάδ\S*)$/;
const QUESTION_WORD = /^(πόσ|ποι|πότε|πού|τι$)/;

/**
 * Paint targets from a story's marks, for problems written before painting (their
 * steps have no targets): the core of a fact is its number, digits or words (the whole
 * phrase if it has none, of which any two words will do); of a question, «πόσα ευρώ»
 * (the question word and the next).
 */
export function targetsFromMarks(story: string): PaintTarget[] {
  const plain = plainStory(story);
  const words = [...plain.matchAll(/\S+/g)].map(m => ({ from: m.index!, to: m.index! + m[0].length, w: m[0] }));
  const bare = (i: number) => words[i].w.replace(/[.,;:!«»()]+/g, '').toLowerCase();
  const out: PaintTarget[] = [];
  let removed = 0;
  for (const m of story.matchAll(MARK)) {
    const from = m.index! - removed, to = from + m[1].length;
    removed += m[0].length - m[1].length;
    const inside = words.flatMap((x, i) => (x.to > from && x.from < to ? [i] : []));
    const role = m[2] as PaintTarget['role'];
    let core: number[];
    if (role === 'sought') {
      const at = inside.find(i => QUESTION_WORD.test(bare(i)));
      core = at !== undefined ? [at, at + 1].filter(i => inside.includes(i)) : [];
    } else {
      core = inside.filter(i => /\d/.test(bare(i)) || FACT_WORD.test(bare(i)));
    }
    const span: [number, number] = [inside[0], inside[inside.length - 1]];
    if (core.length) out.push({ role, words: core, span });
    else out.push({ role, words: inside, span, ...(inside.length > 2 ? { need: 2 } : {}) });
  }
  return out;
}

/** Words painted outside any phrase that are forgiven; beyond this, "too much". */
export const PAINT_SLACK = 3;
/** Words around a phrase that still count as part of it (a stroke is never exact). */
const MARGIN = 2;

/**
 * A painting is right when every needed fact has its core words painted "known", the
 * question its core words painted "sought", nothing unneeded is painted, and not much
 * else. `wrong` lists the targets to look at again; -1 means too much was painted.
 */
export function checkPaint(
  targets: PaintTarget[], words: number, value: unknown, opts: { unneeded?: boolean } = {}
): { correct: boolean; wrong?: number[] } {
  const v = value as Painting;
  if (!v || !Array.isArray(v.known) || !Array.isArray(v.sought)) return { correct: false };
  const valid = (xs: unknown) => new Set((Array.isArray(xs) ? xs : []).filter(i => Number.isInteger(i) && i >= 0 && i < words) as number[]);
  const known = valid(v.known), sought = valid(v.sought), extra = valid(v.extra);
  const wrong: number[] = [];
  targets.forEach((t, i) => {
    if (t.role === 'extra') {
      // Painted as needed is wrong; on "paint-all", left unpainted is too
      if (t.words.some(w => known.has(w) || sought.has(w))) wrong.push(i);
      else if (opts.unneeded && t.words.filter(w => extra.has(w)).length < (t.need ?? t.words.length)) wrong.push(i);
    } else {
      const brush = t.role === 'known' ? known : sought;
      if (t.words.filter(w => brush.has(w)).length < (t.need ?? t.words.length)) wrong.push(i);
    }
  });
  // Strays: painted words that aren't near a phrase of their colour (an unneeded fact
  // painted is its own mistake, above, not also "too much")
  const inExtra = (w: number) => targets.some(t => t.role === 'extra' && w >= t.span[0] && w <= t.span[1]);
  const near = (w: number, role: PaintTarget['role']) =>
    inExtra(w) || targets.some(t => t.role === role && w >= t.span[0] - MARGIN && w <= t.span[1] + MARGIN);
  const strays = [...known].filter(w => !near(w, 'known')).length + [...sought].filter(w => !near(w, 'sought')).length
    + [...extra].filter(w => !near(w, 'extra')).length;
  if (strays > PAINT_SLACK) wrong.push(-1);
  return wrong.length ? { correct: false, wrong } : { correct: true };
}

// ---------------------------------------------------------------------------
// Working it out her own way

export type CalcOp = '+' | '−' | '×' | ':';

export interface CalcQuantity { id: string; value: number; label: string; unit?: string }
/** out = a op b, and so any one of the three from the other two. */
export interface CalcRelation { out: string; op: CalcOp; a: string; b: string }
export interface CalcWorld {
  quantities: CalcQuantity[];
  relations: CalcRelation[];
  /** What the story says. */
  given: string[];
  sought: string;
}
export interface CalcLine { x: number; op: CalcOp; y: number; result: number }

export const applyOp = (op: CalcOp, x: number, y: number) =>
  op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y;

interface Way { target: string; op: CalcOp; x: string; y: string }

/** The three ways to use a relation: for out, for a, for b. */
function ways(r: CalcRelation): Way[] {
  const back: CalcOp = r.op === '+' ? '−' : r.op === '−' ? '+' : r.op === '×' ? ':' : '×';
  return [
    { target: r.out, op: r.op, x: r.a, y: r.b },
    { target: r.a, op: back, x: r.out, y: r.b },
    r.op === '+' ? { target: r.b, op: '−', x: r.out, y: r.a }
      : r.op === '−' ? { target: r.b, op: '−', x: r.a, y: r.out }
        : r.op === '×' ? { target: r.b, op: ':', x: r.out, y: r.a }
          : { target: r.b, op: ':', x: r.a, y: r.out },
  ];
}

/** What x op y finds in this story, or null when it means nothing here. */
export function readCalculation(w: CalcWorld, x: number, op: CalcOp, y: number): CalcQuantity | null {
  const q = new Map(w.quantities.map(q => [q.id, q]));
  const v = applyOp(op, x, y);
  for (const r of w.relations) {
    for (const way of ways(r)) {
      if (way.op !== op || q.get(way.target)!.value !== v) continue;
      const [a, b] = [q.get(way.x)!.value, q.get(way.y)!.value];
      if ((a === x && b === y) || ((op === '+' || op === '×') && a === y && b === x)) return q.get(way.target)!;
    }
  }
  return null;
}

/** What the story's facts give, and how: the first relation that can, each time (the
 * relations come in the story's order, so this is the book's way). */
function derive(w: CalcWorld) {
  const known = new Set(w.given);
  const how = new Map<string, Way>();
  for (let found = true; found;) {
    found = false;
    for (const r of w.relations) {
      const missing = [r.out, r.a, r.b].filter(id => !known.has(id));
      if (missing.length !== 1) continue;
      const way = ways(r).find(x => x.target === missing[0])!;
      known.add(way.target);
      how.set(way.target, way);
      found = true;
      break;
    }
  }
  return { known, how };
}

/**
 * Everything that helps: the quantities that some way to the answer goes through. A
 * relation with the answer in it, whose other two can be had, makes those two useful,
 * and so on back (so 50 − 36 = 14 «left in all» helps as much as 36 + 9 = 45).
 */
export function usefulToAnswer(w: CalcWorld): Set<string> {
  const { known } = derive(w);
  const useful = new Set<string>([w.sought]);
  const todo = [w.sought];
  while (todo.length) {
    const t = todo.pop()!;
    for (const r of w.relations) {
      const all = [r.out, r.a, r.b];
      if (!all.includes(t)) continue;
      const others = all.filter(id => id !== t);
      if (!others.every(id => known.has(id) && id !== w.sought)) continue;
      for (const id of others) if (!useful.has(id) && !w.given.includes(id)) { useful.add(id); todo.push(id); }
    }
  }
  return useful;
}

/** The quantities on the book's way from what the story says to the answer (the answer too). */
export function pathToAnswer(w: CalcWorld): Set<string> {
  const { how } = derive(w);
  const path = new Set<string>();
  const walk = (id: string) => {
    const way = how.get(id);
    if (!way || path.has(id)) return;
    path.add(id);
    walk(way.x); walk(way.y);
  };
  walk(w.sought);
  return path;
}

/**
 * Her calculations, in order: each uses numbers the story gives or she found before,
 * is done right, and means something in the story; the last finds the answer.
 */
export function checkCalc(w: CalcWorld, lines: unknown): { correct: boolean; wrong?: number[] } {
  if (!Array.isArray(lines) || !lines.length) return { correct: false };
  const q = new Map(w.quantities.map(q => [q.id, q]));
  const have = new Set(w.given.map(id => q.get(id)?.value));
  const wrong: number[] = [];
  let found = false;
  (lines as CalcLine[]).forEach((l, i) => {
    const ok = l && have.has(l.x) && have.has(l.y) && ['+', '−', '×', ':'].includes(l.op) && applyOp(l.op, l.x, l.y) === l.result;
    const means = ok ? readCalculation(w, l.x, l.op, l.y) : null;
    if (!means) { wrong.push(i); return; }
    have.add(means.value);
    if (means.id === w.sought) found = true;
  });
  if (wrong.length) return { correct: false, wrong };
  return { correct: found };
}

/** A calculation that gets her closer to the answer from what she has, for when she's stuck. */
export function nextCalculation(w: CalcWorld, have: Set<number>): { x: number; op: CalcOp; y: number } | null {
  const q = new Map(w.quantities.map(q => [q.id, q]));
  // The book's way first, then any other way that helps
  const path = pathToAnswer(w);
  const useful = usefulToAnswer(w);
  for (const wanted of [path, useful]) for (const r of w.relations) {
    for (const way of ways(r)) {
      const [x, y, t] = [q.get(way.x)!, q.get(way.y)!, q.get(way.target)!];
      if (wanted.has(t.id) && !have.has(t.value) && have.has(x.value) && have.has(y.value)) return { x: x.value, op: way.op, y: y.value };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// A step shown worked («Δείξε μου», #48)

/** The calculations that find the answer from what the story gives, the book's way first. */
export function workedCalc(w: CalcWorld): CalcLine[] {
  const have = new Set(w.given.map(id => w.quantities.find(q => q.id === id)!.value));
  const lines: CalcLine[] = [];
  for (let n = 0; n < 20; n++) {
    const next = nextCalculation(w, have);
    if (!next) break;
    const line = { ...next, result: applyOp(next.op, next.x, next.y) };
    lines.push(line);
    have.add(line.result);
    if (readCalculation(w, line.x, line.op, line.y)?.id === w.sought) break;
  }
  return lines;
}

/**
 * The right answer to a step, as her screen sends it, on her rung: what «Δείξε μου» fills
 * in. The reading step as the marks' roles («marked») or as a painting of the facts' core
 * words (the unneeded ones too on «paint-all»); a calculation as the lines that find the answer.
 */
export function workedAnswer(exercise: ProblemExercise, stepIndex: number, reading: ProblemReading = 'marked'): unknown {
  const step = exercise.steps[stepIndex];
  switch (step.kind) {
    case 'tag':
    case 'paint': {
      if (reading === 'marked') return [...exercise.story.matchAll(MARK)].map(m => m[2]);
      const targets = step.kind === 'paint' ? step.targets : targetsFromMarks(exercise.story);
      const words = (role: string) => targets.filter(t => t.role === role).flatMap(t => t.words);
      return { known: words('known'), sought: words('sought'), extra: reading === 'paint-all' ? words('extra') : [] };
    }
    case 'choice': return step.correctIndex;
    case 'numbers': return step.rows.map(r => r.answer);
    case 'order': return step.items;
    case 'calc': return { lines: workedCalc(step), slips: 0 };
  }
}
