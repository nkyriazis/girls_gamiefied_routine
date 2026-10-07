import type { ProblemCalcStep } from '@shared/types';
import { calcSlip, nextCalculation, readLines, runLabel, usefulToAnswer, type CalcLine, type CalcOp, type PaintTarget } from '@shared/problems';

// What the free steps of a problem say back to her (ProblemFreeSteps.tsx draws them).

export type Brush = 'known' | 'sought' | 'extra';
/** One brush (or none) per word of the story. */
export type PaintValue = (Brush | null)[];

/** What to say after a wrong painting: which kind of mistake, in her words. */
export function paintFeedback(targets: PaintTarget[], words: string[], wrong: number[], painted: PaintValue): string {
  const say: string[] = [];
  const knowns = targets.filter(t => t.role === 'known');
  const missed = targets.filter((t, i) => t.role === 'known' && wrong.includes(i)).length;
  const phrase = (t: PaintTarget) => words.slice(t.span[0], t.span[1] + 1).join(' ').replace(/[.,;]$/, '');
  const extras = targets.filter((t, i) => t.role === 'extra' && wrong.includes(i));
  const asNeeded = (t: PaintTarget) => t.words.some(w => painted[w] === 'known' || painted[w] === 'sought');
  if (targets.some((t, i) => t.role === 'sought' && wrong.includes(i))) say.push('Ποια είναι η ερώτηση; Βάψ’ τη με το 🟡.');
  if (missed) say.push(`Βρήκες ${knowns.length - missed} από τα ${knowns.length} που χρειαζόμαστε.`);
  for (const t of extras.filter(asNeeded)) say.push(`Το «${phrase(t)}» δεν το χρειαζόμαστε.`);
  // "paint-all": an unneeded fact left unpainted (without saying which)
  const left = extras.filter(t => !asNeeded(t)).length;
  if (left) say.push(left === 1 ? 'Κάτι που δεν χρειαζόμαστε έμεινε άβαφο: βάψ’ το με το ⚪.' : `${left} πράγματα που δεν χρειαζόμαστε έμειναν άβαφα: βάψ’ τα με το ⚪.`);
  if (wrong.includes(-1)) say.push('Έβαψες πολλά: βάψε μόνο ό,τι χρειάζεται.');
  return say.join(' ');
}

export interface CalcValue {
  lines: (CalcLine & { label: string; onPath: boolean })[];
  slips: number;
  x: number | null;
  op: CalcOp | null;
  y: number | null;
  result: string;
}
export const emptyCalc = (): CalcValue => ({ lines: [], slips: 0, x: null, op: null, y: null, result: '' });

export type CalcNote = { kind: 'math' | 'order' | 'nothing' | 'found' | 'off-path' | 'answer'; text: string };

export const lower = (s: string) => s[0].toLowerCase() + s.slice(1);
export const fmt = (n: number) => n.toLocaleString('el-GR');

/** Read the calculation she built: a mistake, nothing, or what it found (a quantity, or a run's step). */
export function readLine(step: ProblemCalcStep, v: CalcValue, path: Set<string>): { note: CalcNote; value: CalcValue } {
  const { x, op, y } = v;
  const result = Number(v.result);
  if (x === null || op === null || y === null) return { note: { kind: 'nothing', text: '' }, value: v };
  const slip = (kind: CalcNote['kind'], text: string) => ({ note: { kind, text }, value: { ...v, slips: v.slips + 1 } });
  // What is wrong with it, as the server reads it too (calcSlip): the smaller number first
  // (whatever the result says), a wrong result, or a right one that means nothing here
  const wrong = calcSlip(step, v.lines, { x, op, y, result });
  if (wrong === 'order') {
    return slip('order', op === '−'
      ? `Δεν μπορούμε να βγάλουμε ${fmt(y)} από το ${fmt(x)}: στην αφαίρεση ο μεγαλύτερος αριθμός πάει πρώτος.`
      : `Δεν μπορούμε να διαιρέσουμε το ${fmt(x)} με το ${fmt(y)}: στη διαίρεση ο μεγαλύτερος αριθμός πάει πρώτος.`);
  }
  if (wrong === 'math') return slip('math', `Ξαναμέτρα: ${fmt(x)} ${op} ${fmt(y)} δεν κάνει ${fmt(result)}.`);
  const read = readLines(step, [...v.lines, { x, op, y, result }]).lines.at(-1);
  if (wrong === 'nothing' || !read) return slip('nothing', `Σωστός λογαριασμός, αλλά στην ιστορία δεν σημαίνει κάτι. Ποιοι αριθμοί πάνε μαζί;`);
  const done = (line: CalcValue['lines'][number]) => ({ ...v, lines: [...v.lines, line], x: null, op: null, y: null, result: '' });
  // A step of a run (58 − 9 − 9): its label is what she did so far
  if (read.kind === 'run') {
    const label = runLabel(read.run, fmt), onPath = path.has(read.run.target.id);
    const value = done({ x, op, y, result, label, onPath });
    if (!onPath) return { note: { kind: 'off-path', text: `Σωστά: ${label} = ${fmt(result)}. Εμείς όμως ψάχνουμε κάτι άλλο: ξαναδιάβασε την ερώτηση.` }, value };
    return { note: { kind: 'found', text: `✔ Σωστά: ${label} = ${fmt(result)}. Συνέχισε!` }, value };
  }
  const q = read.q;
  const line = { x, op, y, result, label: q.label, onPath: path.has(q.id) };
  const value = done(line);
  if (q.id === step.sought) return { note: { kind: 'answer', text: `Αυτό ψάχναμε: ${lower(q.label)}!` }, value };
  if (!line.onPath) {
    return { note: { kind: 'off-path', text: `Σωστά, βρήκες: ${lower(q.label)}. Εμείς όμως ψάχνουμε κάτι άλλο: ξαναδιάβασε την ερώτηση.` }, value };
  }
  return { note: { kind: 'found', text: `✔ Βρήκες: ${lower(q.label)}. Συνέχισε!` }, value };
}

/** The lines whose result is hers to use (a chip): all but a run's steps it has moved on from. */
export function liveLines(step: ProblemCalcStep, v: CalcValue): boolean[] {
  const read = readLines(step, v.lines);
  const latest = new Set(read.runs.map(r => r.at));
  return read.lines.map((r, i) => r?.kind !== 'run' || latest.has(i));
}

/**
 * After a few slips, when the last calculation meant nothing, say which one to try (not its
 * result): the next step of her run when she is in the middle of one that helps (40 − 9),
 * else the book's next calculation.
 */
export function calcNudge(step: ProblemCalcStep, v: CalcValue): string | null {
  if (v.slips < 3) return null;
  const read = readLines(step, v.lines);
  const useful = usefulToAnswer(step);
  const run = read.runs.filter(r => useful.has(r.target.id) && !read.have.has(r.target.value)).sort((a, b) => b.at - a.at)[0];
  if (run) return `Δοκίμασε: ${fmt(run.value)} ${run.op} ${fmt(run.m)}`;
  const next = nextCalculation(step, read.have);
  return next ? `Δοκίμασε: ${fmt(next.x)} ${next.op} ${fmt(next.y)}` : null;
}
