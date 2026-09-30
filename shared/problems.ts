// Checking the two free steps of a problem: painting the story freehand and working
// it out her own way. The server checks with these; the screen uses the same code to
// say what she found as she goes. No imports, so the backend (CommonJS), the frontend
// (Vite) and tools/problem-gen (Node) can all load it.

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
}

export interface Painting { known: number[]; sought: number[] }

/** Words painted outside any phrase that are forgiven; beyond this, "too much". */
export const PAINT_SLACK = 3;
/** Words around a phrase that still count as part of it (a stroke is never exact). */
const MARGIN = 2;

/**
 * A painting is right when every needed fact has its core words painted "known", the
 * question its core words painted "sought", nothing unneeded is painted, and not much
 * else. `wrong` lists the targets to look at again; -1 means too much was painted.
 */
export function checkPaint(targets: PaintTarget[], words: number, value: unknown): { correct: boolean; wrong?: number[] } {
  const v = value as Painting;
  if (!v || !Array.isArray(v.known) || !Array.isArray(v.sought)) return { correct: false };
  const known = new Set(v.known.filter(i => Number.isInteger(i) && i >= 0 && i < words));
  const sought = new Set(v.sought.filter(i => Number.isInteger(i) && i >= 0 && i < words));
  const wrong: number[] = [];
  targets.forEach((t, i) => {
    if (t.role === 'extra') {
      if (t.words.some(w => known.has(w) || sought.has(w))) wrong.push(i);
    } else {
      const brush = t.role === 'known' ? known : sought;
      if (!t.words.every(w => brush.has(w))) wrong.push(i);
    }
  });
  // Strays: painted words that aren't near a phrase of their colour
  const near = (w: number, role: 'known' | 'sought') =>
    targets.some(t => t.role === role && w >= t.span[0] - MARGIN && w <= t.span[1] + MARGIN);
  const strays = [...known].filter(w => !near(w, 'known')).length + [...sought].filter(w => !near(w, 'sought')).length;
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
